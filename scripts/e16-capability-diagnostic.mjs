/**
 * E16 — read-only диагностика capability-полей двух реальных учётных записей
 * GEORITM и расчёт capability resolver кабинета для каждой учётной записи.
 *
 *   node scripts/e16-capability-diagnostic.mjs
 *
 * Секреты: GEORITM_BASE_URL / GEORITM_LOGIN_1 / GEORITM_PASSWORD_1 /
 * GEORITM_LOGIN_2 / GEORITM_PASSWORD_2 читаются из окружения или .env.local
 * и НИКОГДА не выводятся. IMEI маскируется (последние 4 цифры). Полные
 * ответы API не печатаются — извлекаются только capability-поля.
 *
 * БЕЗОПАСНОСТЬ — только read-only методы:
 *   users/login/, objects/objects-tree-set/, objects/obj/,
 *   objects/obj-details/ (callDevice=false), objects/obj-areas/,
 *   objects/state/.
 * Write-методы (objects/arm/, objects/disarm/, objects/obj-scan/ и прочие)
 * В СКРИПТЕ ОТСУТСТВУЮТ. GEORITM_CONTROL_ENABLED не читается и не меняется.
 */

import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const REQUEST_TIMEOUT_MS = 15_000;

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

const accounts = [1, 2].map((index) => ({
    index,
    login: readEnv(`GEORITM_LOGIN_${index}`),
    password: readEnv(`GEORITM_PASSWORD_${index}`),
}));

if (!baseUrl || accounts.some((account) => !account.login || !account.password)) {
    console.error('Параметры GEORITM_BASE_URL / GEORITM_LOGIN_i / GEORITM_PASSWORD_i не заданы. Остановка.');
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
        console.error(`  ${label}: ${error.kind}${error.status ? ` HTTP ${error.status}` : ''}${error.serverMessage ? ` — ${error.serverMessage}` : ''}`);
    } else {
        console.error(`  ${label}: внутренняя ошибка: ${error?.name ?? 'unknown'}`);
    }
};

// ————————————————————————————————————————————— Санитизация ————————

const maskImei = (imei) => {
    if (typeof imei !== 'string' || imei.length === 0) {
        return null;
    }
    return `***${imei.slice(-4)} (${imei.length} симв.)`;
};

/** Отображение произвольного capability-значения без утечки лишнего. */
const showRaw = (value) => {
    if (value === undefined) {
        return 'отсутствует';
    }
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
        return `${typeof value}: ${JSON.stringify(value)}`;
    }
    return `${typeof value}`;
};

const has = (record, key) => Boolean(record) && typeof record === 'object' && key in record;

// ——————————————————————————— Capability resolver (E12.2) ————————

/**
 * Точная реплика семантики computeControlAvailability (lib/account/
 * georitm-control.ts) для расчёта на реальных данных. Логика скопирована
 * 1:1 (чистая функция без зависимостей); любое расхождение с production
 * недопустимо и должно фиксироваться как дефект скрипта, не источник
 * «исправлений» resolver'а.
 */
const partitionGuarded = (value) => (value === 2 ? true : value === 1 ? false : null);

const computeAvailability = (action, inputs) => {
    if (!inputs.controlEnabled) {
        return 'disabled';
    }
    if (inputs.objType === '0') {
        return 'unsupported';
    }
    const hasPermission = inputs.permissions === undefined
        ? undefined
        : action === 'arm' ? inputs.permissions.arm : inputs.permissions.disarm;
    if (hasPermission === false || inputs.canArm === false || inputs.restricted === 1) {
        return 'no-permission';
    }
    if (hasPermission === undefined) {
        return 'unknown';
    }
    if (inputs.canArm !== true) {
        return 'unknown';
    }
    if (inputs.restricted !== undefined && inputs.restricted !== 0) {
        return 'unknown';
    }
    if (typeof inputs.imei !== 'string' || inputs.imei.trim().length === 0) {
        return 'unknown';
    }
    if (inputs.guarded === null) {
        return 'unknown';
    }
    return 'available';
};

// ——————————————————————————————————————————————— Общее ————————

const auth = async (account) => {
    const response = await callApi('users/login/', {login: account.login, password: account.password});
    const basic = typeof response?.basic === 'string' && response.basic.length > 0 ? response.basic : null;
    if (!basic) {
        throw new ApiCallError('shape', 200, null);
    }
    const actions = Array.isArray(response.allowedActions) ? response.allowedActions : null;
    return {
        basic,
        isAdmin: response.isAdmin === 1 ? 'да' : response.isAdmin === 0 ? 'нет' : 'отсутствует',
        isFromIDP: showRaw(response.isFromIDP),
        allowedActionsCount: actions ? actions.length : null,
        controlPermissions: actions
            ? {arm: actions.includes('objects.arm'), disarm: actions.includes('objects.disarm')}
            : undefined,
    };
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

const objectDetails = async (basic, objectId) =>
    callApi('objects/obj-details/', {objectId: [objectId], callDevice: false}, {basic});

const objectAreas = async (basic, objectId) => {
    const response = await callApi('objects/obj-areas/', {objectId}, {basic});
    const areas = Array.isArray(response) ? response : response?.areas;
    if (!Array.isArray(areas)) {
        throw new ApiCallError('shape', 200, null);
    }
    return areas;
};

const partitionsState = async (basic, imei) => callApi('objects/state/', {imei}, {basic});

// —————————————————————————————— Диагностика учётной записи ————————

const diagnoseAccount = async (account) => {
    console.log(`\n=========================== Учётная запись №${account.index} ===========================`);

    let session;
    try {
        session = await auth(account);
    } catch (error) {
        printError('Авторизация', error);
        return null;
    }

    console.log('Авторизация: OK');
    console.log(`  isAdmin: ${session.isAdmin}`);
    console.log(`  isFromIDP (users/login/): ${session.isFromIDP}`);
    console.log(`  allowedActions: ${session.allowedActionsCount === null ? 'отсутствует' : `${session.allowedActionsCount} шт.`}`);
    console.log(`  Проекция кабинета: arm=${session.controlPermissions.arm}, disarm=${session.controlPermissions.disarm}`);

    let treeObjects;
    try {
        treeObjects = await collectTree(session.basic);
    } catch (error) {
        printError('objects-tree-set/', error);
        return null;
    }
    console.log(`Объектов в tree-set (groupType=1): ${treeObjects.length}`);

    const results = [];

    for (const treeObject of treeObjects) {
        const label = typeof treeObject.name === 'string' && treeObject.name ? ` «${treeObject.name}»` : '';
        console.log(`\n— Объект id=${treeObject.id}${label} (objType=${showRaw(treeObject.objType)})`);

        const result = {
            objectId: treeObject.id,
            objType: treeObject.objType,
            // Сырые capability-значения — только в памяти, печатаются замаскированно.
            raw: {canArm: undefined, hasCanArmKey: false, restricted: undefined, hasRestrictedKey: false, imei: undefined},
            details: null,
            areas: null,
            state: {known: false},
        };

        // objects/obj/ — основной носитель capability-полей (E13).
        let objRecord = null;
        try {
            objRecord = await objectRecord(session.basic, treeObject.id);
            if (objRecord) {
                result.raw.hasCanArmKey = has(objRecord, 'canArm');
                result.raw.canArm = objRecord.canArm;
                result.raw.hasRestrictedKey = has(objRecord, 'restricted');
                result.raw.restricted = objRecord.restricted;
                result.raw.imei = typeof objRecord.imei === 'string' && objRecord.imei.trim().length > 0
                    ? objRecord.imei.trim()
                    : undefined;
                console.log(`  obj/: canArm=${showRaw(objRecord.canArm)}, restricted=${showRaw(objRecord.restricted)}, imei=${maskImei(objRecord.imei) ?? 'отсутствует'}, isFromIDP=${showRaw(objRecord.isFromIDP)}, devices=${Array.isArray(objRecord.devices) ? objRecord.devices.length : 0}`);
            } else {
                console.log('  obj/: запись целевого объекта отсутствует в ответе');
            }
        } catch (error) {
            printError('obj/', error);
        }

        // objects/obj-details/ — второй документированный носитель canArm.
        try {
            const details = await objectDetails(session.basic, treeObject.id);
            const devices = Array.isArray(details?.devices) ? details.devices : [];
            result.details = {
                canArm: has(details, 'canArm') ? showRaw(details.canArm) : 'ключ отсутствует',
                restricted: has(details, 'restricted') ? showRaw(details.restricted) : 'ключ отсутствует',
                imei: has(details, 'imei') ? maskImei(details.imei) ?? 'отсутствует' : 'ключ отсутствует',
                deviceImei: devices.length > 0 && has(devices[0], 'imei') ? maskImei(devices[0].imei) ?? 'отсутствует' : 'нет приборов/ключа',
            };
            console.log(`  obj-details/: canArm=${result.details.canArm}, restricted=${result.details.restricted}, imei=${result.details.imei}, device[0].imei=${result.details.deviceImei}`);
        } catch (error) {
            printError('obj-details/', error);
        }

        // objects/obj-areas/ — разрешённые разделы.
        try {
            const areas = await objectAreas(session.basic, treeObject.id);
            result.areas = areas
                .filter((area) => area && typeof area.num === 'number' && Number.isInteger(area.num) && area.num >= 0)
                .map((area) => ({
                    num: area.num,
                    name: typeof area.name === 'string' && area.name.trim().length > 0 ? area.name.trim() : null,
                }));
            const shown = areas.map((a) => `#${a?.num} (isGuarded=${showRaw(a?.isGuarded)})`).join(', ');
            console.log(`  obj-areas/: ${areas.length} шт. — ${shown || '(пусто)'}`);
        } catch (error) {
            printError('obj-areas/', error);
        }

        // objects/state/ по IMEI из objects/obj/ (IMEI только из серверных ответов).
        if (result.raw.imei) {
            try {
                const response = await partitionsState(session.basic, result.raw.imei);
                const state = response && typeof response === 'object' && response.state && typeof response.state === 'object'
                    ? response.state
                    : null;
                result.state = state ? {known: true, map: state} : {known: false};
                console.log(`  objects/state/: ${state ? `карта получена, ключи: ${Object.keys(state).join(', ') || '(пусто)'}` : 'карта состояний отсутствует в ответе'}`);
            } catch (error) {
                result.state = {known: false, error: true};
                printError('objects/state/', error);
            }
        } else {
            result.state = {known: false, reason: 'imei недоступен'};
            console.log('  objects/state/: пропущен — IMEI не разрешён');
        }

        // Расчёт capability resolver для каждого раздела (семантика E12.2).
        const permissions = session.controlPermissions;
        const partitionStates = [];
        for (const area of result.areas ?? []) {
            const raw = result.state.known ? result.state.map[String(area.num)] : undefined;
            const guarded = result.state.known ? partitionGuarded(raw) : null;
            const inputs = {
                controlEnabled: true, // расчёт для случая включённого gate (без его изменения)
                permissions,
                objType: typeof objRecord?.objType === 'string' ? objRecord.objType : treeObject.objType,
                canArm: result.raw.hasCanArmKey ? result.raw.canArm : undefined,
                restricted: result.raw.hasRestrictedKey ? result.raw.restricted : undefined,
                imei: result.raw.imei,
                guarded,
            };
            partitionStates.push({
                num: area.num,
                name: area.name ?? `Раздел ${area.num}`,
                guarded,
                arm: computeAvailability('arm', inputs),
                disarm: computeAvailability('disarm', inputs),
            });
        }
        result.partitions = partitionStates;
        if (partitionStates.length > 0) {
            for (const partition of partitionStates) {
                console.log(`  resolver: раздел ${partition.num} (${partition.name}) — guarded=${showRaw(partition.guarded)}, arm=${partition.arm}, disarm=${partition.disarm}`);
            }
        } else {
            console.log('  resolver: допустимых разделов нет (obj-areas пуст или недоступен)');
        }

        results.push(result);
    }

    return {session, results};
};

// ————————————————————————————————————————————— Сводные таблицы ————————

const summarize = (diagnostic) => {
    if (!diagnostic) {
        return null;
    }
    const {session, results} = diagnostic;
    const controlAllowed = (partition) => partition.arm === 'available' || partition.disarm === 'available';
    const allPartitions = results.flatMap((result) => result.partitions ?? []);
    const availableCount = allPartitions.filter(controlAllowed).length;
    const reasons = [...new Set(allPartitions.flatMap((partition) => [partition.arm, partition.disarm]))];
    const canArmValues = [...new Set(results.map((result) => showRaw(result.raw.canArm)))];
    const restrictedValues = [...new Set(results.map((result) => showRaw(result.raw.restricted)))];
    return {
        auth: 'OK',
        objectCount: results.length,
        canArm: canArmValues.join('; '),
        restricted: restrictedValues.join('; '),
        imeiAvailable: results.some((result) => Boolean(result.raw.imei)) ? 'есть' : 'нет',
        isFromIDP: session.isFromIDP,
        allowedActionsCount: session.allowedActionsCount,
        projectedPermissions: `arm=${session.controlPermissions.arm}, disarm=${session.controlPermissions.disarm}`,
        areaCount: allPartitions.length,
        resolver: reasons.length > 0 ? reasons.join(', ') : 'разделов нет',
        finalAvailability: availableCount > 0
            ? `доступно (${availableCount} из ${allPartitions.length} разделов)`
            : 'управление недоступно',
    };
};

const printComparison = (summaries) => {
    console.log('\n=============================== Сводная таблица ===============================');
    const rows = [
        ['Авторизация', 'auth'],
        ['Количество объектов', 'objectCount'],
        ['canArm (objects/obj/)', 'canArm'],
        ['restricted (objects/obj/)', 'restricted'],
        ['IMEI доступен', 'imeiAvailable'],
        ['isFromIDP', 'isFromIDP'],
        ['allowedActions (шт.)', 'allowedActionsCount'],
        ['Проекция allowedActions', 'projectedPermissions'],
        ['Количество разделов', 'areaCount'],
        ['Capability resolver', 'resolver'],
        ['Итоговая доступность управления', 'finalAvailability'],
    ];
    for (const [label, key] of rows) {
        const first = summaries[0] ? String(summaries[0][key]) : '— (диагностика не выполнена)';
        const second = summaries[1] ? String(summaries[1][key]) : '— (диагностика не выполнена)';
        console.log(`  ${label.padEnd(34)} | Акк 1: ${first} | Акк 2: ${second}`);
    }
    console.log('\nЗначения по объектам — в выводе диагностики выше (каждый объект отдельно).');
};

const run = async () => {
    console.log('E16 — read-only диагностика capability двух учётных записей GEORITM');
    console.log('Методы: users/login/, objects-tree-set/, obj/, obj-details/, obj-areas/, state/. Write-методы отсутствуют.');
    const summaries = [];
    for (const account of accounts) {
        summaries.push(summarize(await diagnoseAccount(account)));
    }
    printComparison(summaries);
};

run().catch((error) => {
    console.error('Непредвиденная ошибка:', error?.name ?? 'unknown');
    process.exit(1);
});
