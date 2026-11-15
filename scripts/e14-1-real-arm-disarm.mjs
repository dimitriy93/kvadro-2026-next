/**
 * E14.1 — контролируемое испытание реальных команд arm/disarm GEORITM.
 *
 *   node scripts/e14-1-real-arm-disarm.mjs inventory
 *   node scripts/e14-1-real-arm-disarm.mjs arm     --object-id <N> --area <N> --yes
 *   node scripts/e14-1-real-arm-disarm.mjs disarm  --object-id <N> --area <N> --yes
 *
 * Отдельный диагностический скрипт, НЕ production-код. Секреты в исходном
 * тексте отсутствуют: GEORITM_BASE_URL / GEORITM_LOGIN / GEORITM_PASSWORD
 * читаются из окружения или .env.local и никогда не выводятся.
 *
 * Безопасность:
 *  - write-команды выполняются ТОЛЬКО в фазах arm/disarm и ТОЛЬКО с флагом
 *    --yes и явными --object-id/--area; ровно одна команда на прогон,
 *    автоматических повторов нет (в том числе при тайм-ауте);
 *  - перед write повторяются все проверки: объект в tree-set текущей
 *    учётной записи, IMEI только из серверных ответов, раздел из
 *    objects/obj-areas/, текущее состояние из objects/state/;
 *  - users/login/, Authorization, Basic, cookies не выводятся; ошибки
 *    печатаются только классифицированными (kind/status/короткий msg);
 *  - IMEI маскируется (последние 4 цифры, длина);
 *  - objects/obj-scan/ и прочие write-методы отсутствуют в скрипте.
 *
 * Подтверждение исполнения: переход состояния раздела в objects/state/ в
 * окне наблюдения (75 с, опрос каждые 5 с) + события журнала
 * alerts/history-on-obj/ за окно. {success:1} сам по себе не считается
 * исполнением.
 */

import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const REQUEST_TIMEOUT_MS = 10_000;
const OBSERVE_WINDOW_MS = 75_000;
const POLL_INTERVAL_MS = 5_000;
const FAILURE_CODES_ARM = new Set([9201, 4503]);
const FAILURE_CODES_DISARM = new Set([9201, 4501]);

// ——————————————————————————————————————————————————————————— ENV ————————

/** Читает .env.local (KEY=VALUE, # — комментарий, кавычки снимаются). */
const loadEnvFile = (filePath) => {
    const result = {};
    if (!existsSync(filePath)) {
        return result;
    }
    for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith('#')) {
            continue;
        }
        const eqIndex = line.indexOf('=');
        if (eqIndex <= 0) {
            continue;
        }
        const key = line.slice(0, eqIndex).trim();
        let value = line.slice(eqIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
};

const envFile = loadEnvFile(path.join(projectRoot, '.env.local'));
const readEnv = (name) => process.env[name]?.trim() || envFile[name]?.trim() || '';

const baseUrl = readEnv('GEORITM_BASE_URL').replace(/\/+$/, '');
const login = readEnv('GEORITM_LOGIN');
const password = readEnv('GEORITM_PASSWORD');

if (!baseUrl || !login || !password) {
    console.error('Параметры GEORITM_BASE_URL / GEORITM_LOGIN / GEORITM_PASSWORD не заданы. Остановка.');
    process.exit(2);
}

// —————————————————————————————————————————————————— Вызовы API ————————

class ApiCallError extends Error {
    constructor(kind, status, serverMessage) {
        super(serverMessage ? `${kind} ${status ?? ''}: ${serverMessage}` : `${kind} ${status ?? ''}`);
        this.kind = kind;
        this.status = status ?? null;
        this.serverMessage = serverMessage;
    }
}

/**
 * POST `<base>/restapi/<method>/json`. Ошибка содержит только kind, статус
 * и короткий msg/message из тела — сырое тело не сохраняется и не печатается.
 */
const callApi = async (method, body, {basic, timeoutMs = REQUEST_TIMEOUT_MS} = {}) => {
    const url = `${baseUrl}/restapi/${method}/json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: '*/*',
                ...(basic ? {Authorization: `Basic ${basic}`} : {}),
            },
            body: JSON.stringify(body ?? {}),
            signal: controller.signal,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new ApiCallError('timeout', null, null);
        }
        throw new ApiCallError('network', null, null);
    } finally {
        clearTimeout(timer);
    }

    const text = await response.text();
    if (response.status !== 200) {
        let serverMessage = null;
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object') {
                serverMessage = typeof parsed.msg === 'string' && parsed.msg
                    ? parsed.msg
                    : typeof parsed.message === 'string' && parsed.message
                        ? parsed.message
                        : null;
            }
        } catch {
            // не JSON — классифицируем по статусу
        }
        throw new ApiCallError('http', response.status, serverMessage);
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new ApiCallError('json', response.status, null);
    }
};

const printError = (label, error) => {
    if (error instanceof ApiCallError) {
        console.error(`${label}: ${error.kind}${error.status ? ` HTTP ${error.status}` : ''}${error.serverMessage ? ` — ${error.serverMessage}` : ''}`);
    } else {
        console.error(`${label}: внутренняя ошибка: ${error?.name ?? 'unknown'}`);
    }
};

// ————————————————————————————————————————————— Санитизация ————————

const maskImei = (imei) => {
    if (typeof imei !== 'string' || imei.length === 0) {
        return null;
    }
    return `***${imei.slice(-4)} (${imei.length} симв.)`;
};

const iso = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '') + ' UTC';

// ——————————————————————————————————————————————— Общее ————————

const auth = async () => {
    const started = Date.now();
    const response = await callApi('users/login/', {login, password});
    const basic = typeof response?.basic === 'string' && response.basic.length > 0 ? response.basic : null;
    if (!basic) {
        throw new ApiCallError('shape', 200, null);
    }
    console.log(`Авторизация: OK (${Date.now() - started} мс)`);
    console.log(`  isAdmin: ${response.isAdmin === 1 ? 'да' : response.isAdmin === 0 ? 'нет' : 'неизвестно'}`);
    if (Array.isArray(response.allowedActions)) {
        const relevant = response.allowedActions.filter((a) => typeof a === 'string' && /arm|disarm|objects/i.test(a));
        console.log(`  allowedActions (управление/объекты): ${relevant.length > 0 ? JSON.stringify(relevant) : '— не найдены права arm/disarm'}`);
        console.log(`  allowedActions (всего): ${response.allowedActions.length} шт.`);
    } else {
        console.log('  allowedActions: отсутствует');
    }
    return {basic, response};
};

const collectTree = async (basic) => {
    const response = await callApi('objects/objects-tree-set/', {groupType: 1, sort: 'name'}, {basic});
    const groups = Array.isArray(response) ? response : response?.groups;
    if (!Array.isArray(groups)) {
        throw new ApiCallError('shape', 200, null);
    }
    const objects = [];
    const seen = new Set();
    const walk = (nodes) => {
        for (const group of nodes) {
            for (const object of group.objs ?? []) {
                if (typeof object?.id === 'number' && !seen.has(object.id)) {
                    seen.add(object.id);
                    objects.push(object);
                }
            }
            if (Array.isArray(group.objsGroups)) {
                walk(group.objsGroups);
            }
        }
    };
    walk(groups);
    return objects;
};

/** Запись objects/obj/ для одного объекта: носитель imei/canArm/restricted. */
const objectRecord = async (basic, objectId) => {
    const response = await callApi('objects/obj/', {objectId: [objectId]}, {basic});
    const objects = Array.isArray(response) ? response : response?.objects;
    if (!Array.isArray(objects)) {
        throw new ApiCallError('shape', 200, null);
    }
    return objects.find((o) => o?.id === objectId) ?? null;
};

/** Наличие IMEI в objects/obj-details/ (без обращения к прибору). */
const detailsImei = async (basic, objectId) => {
    const response = await callApi('objects/obj-details/', {objectId: [objectId], callDevice: false}, {basic});
    let imei = null;
    const devices = response?.devices;
    if (Array.isArray(devices)) {
        for (const device of devices) {
            if (typeof device?.imei === 'string' && device.imei.length > 0) {
                imei = device.imei;
                break;
            }
        }
    }
    return {hasResponse: !!response, imei, objType: typeof response?.objType === 'string' ? response.objType : null};
};

const objectAreas = async (basic, objectId) => {
    const response = await callApi('objects/obj-areas/', {objectId}, {basic});
    const areas = Array.isArray(response) ? response : response?.areas;
    if (!Array.isArray(areas)) {
        throw new ApiCallError('shape', 200, null);
    }
    return areas;
};

const partitionsState = async (basic, imei) => {
    const response = await callApi('objects/state/', {imei}, {basic});
    return response?.state && typeof response.state === 'object' && !Array.isArray(response.state) ? response.state : null;
};

const historyOnObject = async (basic, objectId, fromMs, toMs) => {
    const response = await callApi('alerts/history-on-obj/', {objectId, from: fromMs, to: toMs}, {basic});
    const records = Array.isArray(response) ? response : response?.alerts ?? response?.history;
    return Array.isArray(records) ? records : null;
};

const describeBoolean = (v) => v === true ? 'true' : v === false ? 'false' : `отсутствует/некорректно (${JSON.stringify(v)})`;
const describeRestricted = (v) => v === 0 ? '0 (не ограничен)' : v === 1 ? '1 (ОГРАНИЧЕН)' : v === undefined ? 'отсутствует (условное поле)' : JSON.stringify(v);
const stateName = (v) => v === 1 ? '1 — снят' : v === 2 ? '2 — ПОД ОХРАНОЙ' : String(v);

// ——————————————————————————————————————————— Фаза inventory ————————

const runInventory = async () => {
    const {basic, response: loginResponse} = await auth();
    const treeObjects = await collectTree(basic);
    console.log(`\nДоступно объектов в tree-set: ${treeObjects.length}`);

    const inventory = [];
    for (const target of treeObjects) {
        const objectId = target.id;
        console.log(`\n— Объект id=${objectId}${target.name ? ` «${target.name}»` : ''} —`);
        console.log(`   tree-set: objType=${JSON.stringify(target.objType)}, objStatus=${JSON.stringify(target.objStatus)}`);
        console.log(`   tree-set поля: ${Object.keys(target).sort().join(', ')}`);

        let record = null;
        try {
            record = await objectRecord(basic, objectId);
        } catch (error) {
            printError('   objects/obj/', error);
        }
        let details = null;
        try {
            details = await detailsImei(basic, objectId);
        } catch (error) {
            printError('   objects/obj-details/', error);
        }

        const imeiObj = typeof record?.imei === 'string' && record.imei ? record.imei : null;
        console.log(`   objects/obj/: ${record ? 'есть запись' : 'ЗАПИСИ НЕТ'}, imei=${maskImei(imeiObj) ?? 'нет'}, canArm=${describeBoolean(record?.canArm)}, restricted=${describeRestricted(record?.restricted)}, isFromIDP=${JSON.stringify(record?.isFromIDP)}`);
        console.log(`   objects/obj-details/: ${details ? (details.hasResponse ? 'ответ есть' : 'нет') : 'нет'}, imei=${maskImei(details?.imei) ?? 'нет'}, objType=${JSON.stringify(details?.objType)}`);

        let areas = null;
        try {
            areas = await objectAreas(basic, objectId);
            for (const area of areas) {
                console.log(`   раздел ${area.num}: ${area.name ? `«${area.name}»` : '(без названия)'} isGuarded=${JSON.stringify(area.isGuarded)} hasFault=${JSON.stringify(area.hasFault)} hasAlarm=${JSON.stringify(area.hasAlarm)}`);
            }
        } catch (error) {
            printError('   objects/obj-areas/', error);
        }

        const imei = imeiObj ?? details?.imei;
        let state = null;
        if (imei) {
            try {
                state = await partitionsState(basic, imei);
                if (state) {
                    for (const [num, value] of Object.entries(state)) {
                        console.log(`   objects/state/: раздел ${num} → ${stateName(value)}`);
                    }
                } else {
                    console.log('   objects/state/: пусто или неожиданный формат');
                }
            } catch (error) {
                printError('   objects/state/', error);
            }
        } else {
            console.log('   objects/state/: не вызывался — IMEI не получен из серверных ответов');
        }

        inventory.push({objectId, name: target.name ?? null, record, details, areas, state});
    }

    // isFromIDP на уровне логина (если приходит).
    if (loginResponse && 'isFromIDP' in loginResponse) {
        console.log(`\nisFromIDP в ответе login: ${JSON.stringify(loginResponse.isFromIDP)}`);
    }
    console.log('\nИнвентаризация завершена (только read-методы). Команд не отправлялось.');
    return inventory;
};

// —————————————————————————————— Общая подготовка write-фазы ————————

const prepareTarget = async (basic, objectId, areaNum) => {
    // Владение: объект должен присутствовать в tree-set ТЕКУЩЕЙ учётной записи.
    const treeObjects = await collectTree(basic);
    const target = treeObjects.find((o) => o.id === objectId);
    if (!target) {
        throw new Error(`Объект id=${objectId} отсутствует в tree-set текущей учётной записи — остановка.`);
    }

    const record = await objectRecord(basic, objectId);
    const details = await detailsImei(basic, objectId);
    const imeiObj = typeof record?.imei === 'string' && record.imei ? record.imei : null;
    const imei = imeiObj ?? details?.imei;
    if (!imei) {
        throw new Error('IMEI не получен из серверных ответов (objects/obj/ и objects/obj-details/) — остановка.');
    }

    const areas = await objectAreas(basic, objectId);
    const area = areas.find((a) => a.num === areaNum);
    if (!area) {
        throw new Error(`Раздел ${areaNum} отсутствует среди разделов объекта (доступны: ${areas.map((a) => a.num).join(', ') || '—'}) — остановка.`);
    }

    const state = await partitionsState(basic, imei);
    const current = state ? state[String(areaNum)] : undefined;

    console.log(`Цель: объект id=${objectId}${target.name ? ` «${target.name}»` : ''}, раздел ${areaNum}${area.name ? ` «${area.name}»` : ''}`);
    console.log(`IMEI (серверный, замаскирован): ${maskImei(imei)}`);
    console.log(`canArm=${describeBoolean(record?.canArm)}, restricted=${describeRestricted(record?.restricted)}, isFromIDP=${JSON.stringify(record?.isFromIDP)}`);
    console.log(`Состояние раздела ${areaNum} (objects/state/): ${current === undefined ? 'НЕИЗВЕСТНО' : stateName(current)}`);

    return {target, record, imei, area, state, current};
};

const printEvents = async (basic, objectId, fromMs, toMs, areaNum) => {
    let records;
    try {
        records = await historyOnObject(basic, objectId, fromMs, toMs);
    } catch (error) {
        printError('  журнал (alerts/history-on-obj/)', error);
        return null;
    }
    const relevant = records
        .filter((r) => r?.type === 'ObjectAlert' && (r.area === areaNum || r.area === undefined))
        .sort((a, b) => (a.receivedAt ?? a.alertTs ?? 0) - (b.receivedAt ?? b.alertTs ?? 0));
    if (relevant.length === 0) {
        console.log('  Журнал: подтверждающих событий за окно не найдено.');
        return [];
    }
    console.log(`  Журнал: событий за окно (раздел ${areaNum} или без раздела): ${relevant.length}`);
    for (const event of relevant.slice(0, 20)) {
        const ts = event.receivedAt ?? event.alertTs;
        console.log(`    ${typeof ts === 'number' ? iso(ts) : '?'} код=${JSON.stringify(event.code)} area=${JSON.stringify(event.area)} zone=${JSON.stringify(event.areaZone)} — ${event.messageText ?? '(без текста)'}`);
    }
    return relevant;
};

const parseFailureCode = (code) => {
    if (typeof code !== 'string') {
        return undefined;
    }
    const value = Number.parseInt(code.replace('.', ''), 10);
    return Number.isFinite(value) ? value : undefined;
};

const observe = async (basic, objectId, imei, areaNum, action, sentAtMs) => {
    const targetState = action === 'arm' ? 2 : 1;
    const failureCodes = action === 'arm' ? FAILURE_CODES_ARM : FAILURE_CODES_DISARM;
    const deadline = sentAtMs + OBSERVE_WINDOW_MS;
    let poll = 0;
    let transitionAtMs = null;

    while (Date.now() < deadline) {
        poll += 1;
        let stateValue;
        try {
            const state = await partitionsState(basic, imei);
            stateValue = state ? state[String(areaNum)] : undefined;
        } catch (error) {
            printError(`  опрос ${poll} objects/state/`, error);
        }
        if (stateValue === targetState) {
            transitionAtMs = Date.now();
            console.log(`  Опрос ${poll} (${iso(transitionAtMs)}): раздел ${areaNum} → ${stateName(stateValue)} — ПЕРЕХОД ПОДТВЕРЖДЁН.`);
            break;
        }
        console.log(`  Опрос ${poll} (${iso(Date.now())}): раздел ${areaNum} → ${stateValue === undefined ? 'неизвестно' : stateName(stateValue)}`);
        if (Date.now() + POLL_INTERVAL_MS < deadline) {
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    }

    const windowFrom = sentAtMs - 60_000;
    const windowTo = Date.now() + 5_000;
    console.log(`\n  События журнала за окно (${iso(windowFrom)} … ${iso(windowTo)}):`);
    const events = await printEvents(basic, objectId, windowFrom, windowTo, areaNum);
    const failure = (events ?? []).find((e) => failureCodes.has(parseFailureCode(e.code)));

    if (transitionAtMs !== null) {
        return {result: 'PASS', transitionAtMs, failureEvent: failure ?? null};
    }
    if (failure) {
        return {result: 'REJECTED', transitionAtMs: null, failureEvent: failure};
    }
    return {result: 'UNKNOWN', transitionAtMs: null, failureEvent: failure ?? null};
};

// ——————————————————————————————————————— Фазы arm / disarm ————————

const runCommand = async (action, args) => {
    const objectId = args.objectId;
    const areaNum = args.area;
    if (!Number.isInteger(objectId) || !Number.isInteger(areaNum)) {
        console.error('Требуются целые --object-id <N> и --area <N>. Остановка.');
        process.exit(2);
    }
    if (!args.yes) {
        console.error('Требуется флаг --yes (явное подтверждение пользователя). Остановка.');
        process.exit(2);
    }
    if (action !== 'arm' && action !== 'disarm') {
        console.error('Неизвестное действие.');
        process.exit(2);
    }

    console.log(`=== Фаза ${action.toUpperCase()} — предпусковые проверки ===`);
    const {basic} = await auth();
    let prepared;
    try {
        prepared = await prepareTarget(basic, objectId, areaNum);
    } catch (error) {
        printError('Предпусковая проверка', error);
        console.error('Команда НЕ отправлялась.');
        process.exit(3);
    }

    const {imei, area, current} = prepared;
    // Целевое состояние команды: arm → 2 (под охраной), disarm → 1 (снят).
    // Пропуск нужен, когда раздел УЖЕ в целевом состоянии (повтор не отправляется).
    const targetCurrent = action === 'arm' ? 2 : 1;
    if (current === targetCurrent) {
        console.error(`Раздел уже в целевом состоянии — ${action} не требуется. Команда НЕ отправлялась.`);
        process.exit(3);
    }
    if (current === undefined || (current !== 1 && current !== 2)) {
        console.error('Состояние раздела неизвестно или неоднозначно. Команда НЕ отправлялась.');
        process.exit(3);
    }

    console.log(`\n=== Отправка ОДНОЙ команды objects/${action}/ (imei: masked, area=${areaNum}) ===`);
    const sentAtMs = Date.now();
    console.log(`Время отправки: ${iso(sentAtMs)}`);
    let commandResponse;
    try {
        commandResponse = await callApi(`objects/${action}/`, {imei, area: areaNum}, {basic});
    } catch (error) {
        printError(`objects/${action}/`, error);
        console.error('HTTP/сетевая ошибка. Автоматический повтор НЕ выполняется. Состояние объекта не менялось подтверждённо — проверьте objects/state/ вручную.');
        process.exit(4);
    }
    console.log(`HTTP 200, время ответа: ${iso(Date.now())} (${Date.now() - sentAtMs} мс)`);
    console.log(`success: ${JSON.stringify(commandResponse?.success)} — приём сервером, НЕ доказательство исполнения`);

    console.log(`\n=== Наблюдение: окно ${OBSERVE_WINDOW_MS / 1000} с, опрос каждые ${POLL_INTERVAL_MS / 1000} с ===`);
    const outcome = await observe(basic, objectId, imei, areaNum, action, sentAtMs);

    console.log('\n=== Итог ===');
    console.log(`Классификация: ${outcome.result}`);
    if (outcome.transitionAtMs) {
        console.log(`Переход состояния подтверждён через ${outcome.transitionAtMs - sentAtMs} мс после отправки.`);
    }
    if (outcome.failureEvent) {
        console.log(`Событие отказа: код=${JSON.stringify(outcome.failureEvent.code)} — ${outcome.failureEvent.messageText ?? ''}`);
    }
    console.log('\nАктуальное состояние всех разделов:');
    try {
        const finalState = await partitionsState(basic, imei);
        for (const [num, value] of Object.entries(finalState ?? {})) {
            console.log(`  раздел ${num} → ${stateName(value)}`);
        }
    } catch (error) {
        printError('финальный objects/state/', error);
    }
    process.exit(outcome.result === 'PASS' ? 0 : 1);
};

// ——————————————————————————————————————————————— Аргументы ————————

const args = {_: []};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--object-id') {
        args.objectId = Number.parseInt(argv[i + 1], 10);
        i += 1;
    } else if (argv[i] === '--area') {
        args.area = Number.parseInt(argv[i + 1], 10);
        i += 1;
    } else if (argv[i] === '--yes') {
        args.yes = true;
    } else {
        args._.push(argv[i]);
    }
}

const phase = args._[0];
try {
    if (phase === 'inventory') {
        await runInventory();
    } else if (phase === 'arm' || phase === 'disarm') {
        await runCommand(phase, args);
    } else {
        console.error('Использование: node scripts/e14-1-real-arm-disarm.mjs <inventory|arm|disarm> [--object-id N --area N --yes]');
        process.exit(2);
    }
} catch (error) {
    printError('Ошибка', error);
    process.exit(1);
}
