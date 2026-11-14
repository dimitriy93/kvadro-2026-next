/**
 * Диагностическая проверка GEORITM REST API (этап 0 интеграции).
 *
 * Только read-only методы документированного API (см. GEO RITM/REST-API-ANALYSIS.md,
 * раздел 5; план проверок — GEO RITM/INTEGRATION-TEST-PLAN.md, тесты 1–3, 4, 7).
 * Управляющие методы (arm/disarm/out-set/lock/set-control-command и прочие
 * write-методы) в скрипте отсутствуют намеренно.
 *
 * Параметры подключения читаются из `.env.local` (исключён из Git):
 *   GEORITM_BASE_URL   — адрес API с протоколом и портом, например http://IP:PORT
 *   GEORITM_LOGIN      — логин тестового пользователя-клиента
 *   GEORITM_PASSWORD   — пароль тестового пользователя
 * Названия согласованы с docs/development/12-georitm-integration.md:
 * GEORITM_SERVICE_LOGIN/PASSWORD там зарезервированы под сервисную схему,
 * которая не используется этим скриптом.
 *
 * Безопасность:
 *   - запросы выполняются только из Node.js;
 *   - пароль, заголовок Authorization и полные ответы users/login/ и
 *     objects/obj-card/ никогда не выводятся и не сохраняются в файлы;
 *   - выводится только безопасная сводка (статусы, количества, названия);
 *   - TLS-проверка сертификата не отключается.
 *
 * Запуск: npm run georitm:check [-- --skip-scan]
 *
 * Флаг --skip-scan исключает objects/obj-scan/ — асинхронное сканирование
 * запускает активный опрос прибора; вызывается только отдельным решением
 * (например, на этапе проверки зон по INTEGRATION-TEST-PLAN.md, тест 7).
 */

import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const REQUEST_TIMEOUT_MS = 10_000;
/** Число объектов в одном запросе objects/obj/ (массовые запросы не нужны). */
const MAX_OBJECTS_PER_REQUEST = 10;
/** Ограниченное число опросов асинхронного obj-scan; интервал не «оптимизируется». */
const OBJ_SCAN_MAX_ATTEMPTS = 3;
const OBJ_SCAN_RETRY_DELAY_MS = 2_000;

/** Расшифровка objStatus (GEO RITM/REST-API-ANALYSIS.md, раздел 5.5). */
const OBJ_STATUS_NAMES = {
    0: 'Не обслуживается',
    1: 'Обслуживается',
    2: 'Сервис',
    3: 'Отключен',
    4: 'Контроль',
};

/** Расшифровка scanState (там же). */
const OBJ_SCAN_STATE_NAMES = {
    0: 'в процессе',
    1: 'в процессе (продолжить с scanId)',
    2: 'ошибка',
    3: 'готово',
};

// ——————————————————————————————————————————————————————————— ENV ————————

/**
 * Читает `.env.local` (KEY=VALUE, # — комментарий, кавычки снимаются).
 * Значения не возвращаются наружу и не логируются.
 */
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

const printEnvInstruction = () => {
    console.error([
        'Параметры подключения к GEORITM не заданы.',
        '',
        'Добавьте в файл .env.local в корне проекта (исключён из Git):',
        '',
        '    GEORITM_BASE_URL=http://<IP>:<PORT>',
        '    GEORITM_LOGIN=<логин тестового пользователя>',
        '    GEORITM_PASSWORD=<пароль тестового пользователя>',
        '',
        'Реальные значения выдаёт поставщик (см. GEO RITM/QUESTIONS-FOR-PROVIDER.md, вопрос A3).',
        'Вымышленные адреса и учётные данные в файл не подставлять.',
    ].join('\n'));
};

// —————————————————————————————————————————————————— Вызовы API ————————

/**
 * Ошибка вызова API с классификацией причины. Содержимое тела ошибки
 * ограничено полями msg/hdr документированного формата — сырое тело не хранится.
 */
class ApiCallError extends Error {
    constructor(kind, status, message) {
        super(message);
        this.kind = kind; // 'network' | 'timeout' | 'http' | 'json' | 'shape'
        this.status = status ?? null;
    }
}

/**
 * Один POST-вызов `<base>/restapi/<method>/json`.
 * Заголовок Authorization передаётся, но никогда не выводится и не логируется.
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
                'Accept': '*/*',
                ...(basic ? {Authorization: `Basic ${basic}`} : {}),
            },
            body: JSON.stringify(body ?? {}),
            signal: controller.signal,
            // TLS-проверка сертификата остаётся включённой по умолчанию.
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new ApiCallError('timeout', null, `Тайм-аут ${timeoutMs} мс: ${method}`);
        }
        throw new ApiCallError('network', null, `Нет сетевого соединения: ${method} (${error?.cause?.code ?? error?.message ?? 'fetch failed'})`);
    } finally {
        clearTimeout(timer);
    }

    const text = await response.text();

    if (response.status !== 200) {
        // Документированный формат ошибки: {msg, hdr, data}. Выводим только msg/hdr.
        let msg = response.statusText || '';
        let hdr = '';
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object') {
                msg = typeof parsed.msg === 'string' ? parsed.msg : msg;
                hdr = typeof parsed.hdr === 'string' ? parsed.hdr : '';
            }
        } catch {
            // Тело не JSON — ограничиваемся HTTP-статусом.
        }
        const label = hdr ? `${hdr}: ${msg}` : msg;
        throw new ApiCallError('http', response.status, `HTTP ${response.status}: ${method}${label ? ` — ${label}` : ''}`);
    }

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new ApiCallError('json', response.status, `Некорректный JSON в ответе: ${method}`);
    }

    return parsed;
};

/** Проверка, что ответ — массив (иначе «неожиданный формат»). */
const expectArray = (value, method) => {
    if (!Array.isArray(value)) {
        throw new ApiCallError('shape', 200, `Неожиданный формат ответа (ожидался массив): ${method}`);
    }
    return value;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Безопасное форматирование buildTs. Единицы времени в документации
 * противоречивы (REST-API-ANALYSIS.md, 10.1): правило-эвристика — число
 * больше 1e12 считаем миллисекундами, иначе секундами; нечисловое значение
 * выводим как есть. Некорректная дата не роняет скрипт.
 */
const formatBuildTs = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
        return String(value);
    }
    const date = new Date(n > 1e12 ? n : n * 1000);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

// —————————————————————————————— Безопасные сводки ————————

/** Короткие поля объекта для вывода; imei маскируется (только последние 4 цифры). */
const safeObjectSummary = (object) => {
    const imei = typeof object.imei === 'string' && object.imei.length > 4
        ? `****${object.imei.slice(-4)}`
        : object.imei === undefined || object.imei === null ? '—' : '****';
    return {
        id: object.id,
        extId: object.extId,
        name: object.name,
        objType: object.objType,
        objStatus: object.objStatus !== undefined && OBJ_STATUS_NAMES[object.objStatus] !== undefined
            ? `${object.objStatus} (${OBJ_STATUS_NAMES[object.objStatus]})`
            : object.objStatus,
        objectState: object.objectState ?? null,
        isGsmOnline: object.isGsmOnline,
        isGpsOnline: object.isGpsOnline,
        hasAlarm: object.hasAlarm,
        imei: imei,
    };
};

/**
 * Собирает идентификаторы объектов из дерева групп objects-tree-set/
 * (рекурсивно по objsGroups, objs[].id — GEO RITM/REST-API-ANALYSIS.md, 5.5).
 */
const collectObjectIds = (groups, acc = []) => {
    for (const group of groups) {
        if (Array.isArray(group?.objs)) {
            for (const object of group.objs) {
                if (object?.id !== undefined && !acc.includes(object.id)) {
                    acc.push(object.id);
                }
            }
        }
        if (Array.isArray(group?.objsGroups)) {
            collectObjectIds(group.objsGroups, acc);
        }
    }
    return acc;
};

// ———————————————————————————————————————————— Отчёт ————————

const report = [];
const skipped = [];

const addOk = (title, lines) => report.push({title, status: 'ok', lines});
const addSkip = (title, reason) => skipped.push({title, reason});
const addFail = (title, lines) => report.push({title, status: 'fail', lines});

const printReport = () => {
    console.log('\n——— Сводка ———');
    for (const item of report) {
        console.log(`\n[${item.status === 'ok' ? 'OK' : 'FAIL'}] ${item.title}`);
        for (const line of item.lines) {
            console.log(`  ${line}`);
        }
    }
    if (skipped.length > 0) {
        console.log('\n——— Пропущенные проверки ———');
        for (const item of skipped) {
            console.log(`  ${item.title}: ${item.reason}`);
        }
    }
};

// ———————————————————————————————————————————— Проверки ————————

const main = async () => {
    /** --skip-scan: не запускать objects/obj-scan/ (активное сканирование прибора). */
    const skipObjScan = process.argv.includes('--skip-scan');

    if (!baseUrl || !login || !password) {
        printEnvInstruction();
        process.exitCode = 1;
        return;
    }

    if (!/^https?:\/\//.test(baseUrl)) {
        console.error('GEORITM_BASE_URL должен начинаться с http:// или https://');
        process.exitCode = 1;
        return;
    }

    let basic = null;

    // 1. ping/ — доступность API (без авторизации).
    try {
        const ping = await callApi('ping/');
        const lines = [];
        if (ping && typeof ping === 'object' && 'success' in ping) {
            lines.push(`success: ${ping.success}`);
            if (ping.version !== undefined) {
                lines.push(`версия: ${ping.version}`);
            }
            if (ping.buildTs !== undefined) {
                lines.push(`сборка от: ${formatBuildTs(ping.buildTs)}`);
            }
            addOk('ping/ — API доступен', lines);
        } else {
            throw new ApiCallError('shape', 200, 'Ответ ping/ без поля success');
        }
    } catch (error) {
        addFail('ping/ — API доступен', [error.message]);
        printReport();
        console.log('\nДальнейшие проверки невозможны без доступного API.');
        process.exitCode = 2;
        return;
    }

    // 2. version/ — версия и сборка.
    try {
        const version = await callApi('version/');
        if (version && typeof version === 'object' && version.version !== undefined) {
            const lines = [`версия: ${version.version}`];
            if (version.buildTs !== undefined) {
                lines.push(`сборка от: ${formatBuildTs(version.buildTs)}`);
            }
            addOk('version/ — версия получена', lines);
        } else {
            throw new ApiCallError('shape', 200, 'Ответ version/ без поля version');
        }
    } catch (error) {
        addFail('version/ — версия получена', [error.message]);
    }

    // 3. users/login/ — авторизация. Полный ответ НЕ выводится: он может
    //    содержать пароль и Basic в открытом виде (REST-API-ANALYSIS.md, 4.1).
    try {
        const loginResponse = await callApi('users/login/', {login, password});
        if (!loginResponse || typeof loginResponse !== 'object' || loginResponse.id === undefined) {
            throw new ApiCallError('shape', 200, 'Ответ users/login/ без id пользователя');
        }
        if (loginResponse.disabled === 1) {
            addFail('users/login/ — авторизация', [`Учётная запись отключена (disabled=1), id=${loginResponse.id}`]);
            printReport();
            process.exitCode = 2;
            return;
        }

        // Готовый заголовок Basic из ответа; при отсутствии вычисляем сами.
        basic = typeof loginResponse.basic === 'string' && loginResponse.basic.length > 0
            ? loginResponse.basic
            : Buffer.from(`${login}:${password}`, 'utf8').toString('base64');

        addOk('users/login/ — авторизация успешна', [
            `id пользователя: ${loginResponse.id}`,
            `username: ${typeof loginResponse.username === 'string' ? loginResponse.username : '—'}`,
            `isAdmin: ${loginResponse.isAdmin ?? '—'}`,
            `allowedActions: ${Array.isArray(loginResponse.allowedActions) ? `${loginResponse.allowedActions.length} код(ов)` : '—'}`,
            `hasStationary: ${loginResponse.hasStationary ?? '—'}, stationaryCount: ${loginResponse.stationaryCount ?? '—'}`,
            `hasMobile: ${loginResponse.hasMobile ?? '—'}, mobileCount: ${loginResponse.mobileCount ?? '—'}`,
            'Basic-заголовок получен (значение не выводится)',
        ]);
    } catch (error) {
        const hint = error instanceof ApiCallError && error.status === 401
            ? ' (проверьте GEORITM_LOGIN/GEORITM_PASSWORD)'
            : '';
        addFail('users/login/ — авторизация', [`${error.message}${hint}`]);
        printReport();
        console.log('\nБез авторизации проверки объектов невозможны.');
        process.exitCode = 2;
        return;
    }

    // 4. objs-groups/group/ — корневые группы (без id → корневые).
    let objectIds = [];
    try {
        // Фактически (сборка 2.27.0) ответ — объект {objects, groups};
        // документация формат ответа без id не раскрывает (REST-API-ANALYSIS.md, 5.6).
        const raw = await callApi('objs-groups/group/', {}, {basic});
        const groups = Array.isArray(raw) ? raw
            : Array.isArray(raw?.groups) ? raw.groups
                : null;
        if (!groups) {
            throw new ApiCallError('shape', 200, 'Неожиданный формат objs-groups/group/ (нет массива групп)');
        }
        const rootObjects = Array.isArray(raw?.objects) ? raw.objects : [];
        const names = groups.map((group) => group?.name).filter((name) => typeof name === 'string').slice(0, 10);
        addOk('objs-groups/group/ — корневые группы', [
            `количество групп: ${groups.length}`,
            `объектов вне подгрупп (objects): ${rootObjects.length}`,
            names.length > 0 ? `названия (до 10): ${names.join(', ')}` : 'названия в ответе отсутствуют',
        ]);
    } catch (error) {
        addFail('objs-groups/group/ — корневые группы', [error.message]);
    }

    // Вспомогательный шаг для шагов 5–9: идентификаторы объектов пользователя.
    // objects/obj/ требует objectId: Integer[]; список объектов пользователя
    // документировано возвращает objects/objects-tree-set/ (read-only).
    try {
        const tree = await callApi('objects/objects-tree-set/', {groupType: 1, sort: 'name'}, {basic});
        const groups = Array.isArray(tree) ? tree
            : Array.isArray(tree?.groups) ? tree.groups
                : null;
        if (!groups) {
            throw new ApiCallError('shape', 200, 'Неожиданный формат objects/objects-tree-set/ (не массив групп)');
        }
        objectIds = collectObjectIds(groups);
        addOk('objects/objects-tree-set/ — дерево объектов (вспомогательный шаг)', [
            `объектов пользователя найдено: ${objectIds.length}`,
            `id (для последующих шагов): ${objectIds.length > 0 ? objectIds.slice(0, MAX_OBJECTS_PER_REQUEST).join(', ') : '—'}`,
        ]);
    } catch (error) {
        addFail('objects/objects-tree-set/ — дерево объектов (вспомогательный шаг)', [error.message]);
    }

    if (objectIds.length === 0) {
        for (const title of [
            'objects/obj/ — краткая информация об объектах',
            'objects/obj-card/ — карточка объекта',
            'objects/get-status/ — статус обслуживания',
            'objects/state/ — состояние охранных разделов',
            'objects/obj-scan/ — разделы и зоны (асинхронно)',
        ]) {
            addSkip(title, 'не найдено ни одного объекта пользователя (objects/objects-tree-set/ пуст или недоступен)');
        }
        printReport();
        process.exitCode = 0;
        return;
    }

    const firstObjectId = objectIds[0];

    // 5. objects/obj/ — краткая информация (один запрос, ограниченный набор id).
    let firstObject = null;
    try {
        const objects = expectArray(
            await callApi('objects/obj/', {objectId: objectIds.slice(0, MAX_OBJECTS_PER_REQUEST)}, {basic}),
            'objects/obj/',
        );
        firstObject = objects.find((object) => object?.id !== undefined) ?? null;
        addOk('objects/obj/ — краткая информация об объектах', [
            `объектов в ответе: ${objects.length} (запрошено ${Math.min(objectIds.length, MAX_OBJECTS_PER_REQUEST)})`,
            ...objects.slice(0, MAX_OBJECTS_PER_REQUEST).map((object) => {
                const summary = safeObjectSummary(object);
                const state = summary.objectState
                    ? ` online=${summary.objectState.isOnline} guarded=${summary.objectState.isGuarded} fault=${summary.objectState.hasFault} alarm=${summary.objectState.hasAlarm}`
                    : '';
                return `— id=${summary.id} extId=${summary.extId} «${summary.name}» тип=${summary.objType} статус=${summary.objStatus}${state} imei=${summary.imei}`;
            }),
        ]);
    } catch (error) {
        addFail('objects/obj/ — краткая информация об объектах', [error.message]);
    }

    // 6. objects/obj-card/ — карточка объекта. Полный ответ НЕ выводится:
    //    settings может содержать пароли (PASS), телефоны, данные SIM.
    try {
        if (!firstObject) {
            throw new ApiCallError('shape', 200, 'Нет объекта из предыдущего шага');
        }
        const card = await callApi('objects/obj-card/', {objectId: firstObject.id}, {basic});
        if (!card || typeof card !== 'object') {
            throw new ApiCallError('shape', 200, 'Неожиданный формат objects/obj-card/');
        }
        const settingsKeys = card.settings && typeof card.settings === 'object'
            ? Object.keys(card.settings)
            : [];
        const item = card.item && typeof card.item === 'object' ? card.item : {};
        addOk('objects/obj-card/ — карточка объекта получена', [
            `id: ${firstObject.id}`,
            `прибор: ${item.deviceTypeName ?? item.deviceTypeId ?? '—'}`,
            `разделов (areas): ${Array.isArray(card.areas) ? card.areas.length : '—'}`,
            `групп (objsGroups): ${Array.isArray(card.objsGroups) ? card.objsGroups.length : '—'}`,
            `hasFault: ${card.hasFault ?? '—'}`,
            `ключи settings (${settingsKeys.length}): ${settingsKeys.join(', ') || '—'}`,
            'полные значения settings и прочие поля не выводятся (могут содержать пароли и контакты)',
        ]);
    } catch (error) {
        addFail('objects/obj-card/ — карточка объекта', [error.message]);
    }

    // 7. objects/get-status/ — статус обслуживания.
    try {
        if (!firstObject) {
            throw new ApiCallError('shape', 200, 'Нет объекта из предыдущего шага');
        }
        const status = await callApi('objects/get-status/', {objectId: firstObject.id}, {basic});
        const objStatus = status?.objStatus;
        if (objStatus === undefined) {
            throw new ApiCallError('shape', 200, 'Ответ objects/get-status/ без objStatus');
        }
        addOk('objects/get-status/ — статус обслуживания', [
            `объект id=${firstObject.id}: objStatus=${objStatus}${OBJ_STATUS_NAMES[objStatus] ? ` (${OBJ_STATUS_NAMES[objStatus]})` : ''}`,
        ]);
    } catch (error) {
        addFail('objects/get-status/ — статус обслуживания', [error.message]);
    }

    // 8. objects/state/ — состояние охранных разделов по IMEI.
    try {
        const imei = firstObject?.imei;
        if (typeof imei !== 'string' || imei.length === 0) {
            addSkip('objects/state/ — состояние охранных разделов', 'нет IMEI в ответе objects/obj/ для выбранного объекта');
        } else {
            const state = await callApi('objects/state/', {imei}, {basic});
            const partitions = state?.state;
            if (!partitions || typeof partitions !== 'object' || Array.isArray(partitions)) {
                throw new ApiCallError('shape', 200, 'Неожиданный формат objects/state/ (ожидался словарь разделов)');
            }
            const entries = Object.entries(partitions);
            addOk('objects/state/ — состояние охранных разделов', [
                `imei: ****${imei.slice(-4)}`,
                `разделов: ${entries.length}`,
                ...entries.map(([num, value]) => `— раздел ${num}: ${value === 2 ? '2 (под охраной)' : value === 1 ? '1 (снят)' : String(value)}`),
            ]);
        }
    } catch (error) {
        addFail('objects/state/ — состояние охранных разделов', [error.message]);
    }

    // 9. objects/obj-scan/ — асинхронное чтение разделов и зон.
    //    Ограниченный цикл: не более OBJ_SCAN_MAX_ATTEMPTS попыток; интервал
    //    фиксированный, лимиты API не изучены (вопрос B1 поставщику).
    try {
        if (skipObjScan) {
            addSkip('objects/obj-scan/ — разделы и зоны (асинхронно)',
                'исключён флагом --skip-scan: активное сканирование прибора в этом прогоне не выполняется');
        } else if (!firstObject) {
            throw new ApiCallError('shape', 200, 'Нет объекта из предыдущего шага');
        } else {
        let scan = await callApi('objects/obj-scan/', {objectId: firstObject.id}, {basic});
        let scanId = scan?.scanId;
        let scanState = scan?.scanState;

        let attempt = 1;
        while ((scanState === 0 || scanState === 1) && attempt < OBJ_SCAN_MAX_ATTEMPTS) {
            attempt += 1;
            await sleep(OBJ_SCAN_RETRY_DELAY_MS);
            scan = await callApi('objects/obj-scan/', {objectId: firstObject.id, scanId}, {basic});
            scanId = scan?.scanId;
            scanState = scan?.scanState;
        }

        const lines = [`объект id=${firstObject.id}, попыток: ${attempt}, scanState=${scanState}${OBJ_SCAN_STATE_NAMES[scanState] ? ` (${OBJ_SCAN_STATE_NAMES[scanState]})` : ''}`];
        if (scanState === 3 && Array.isArray(scan?.partitions)) {
            lines.push(`разделов: ${scan.partitions.length}`);
            for (const partition of scan.partitions.slice(0, MAX_OBJECTS_PER_REQUEST)) {
                const zones = Array.isArray(partition?.zones) ? partition.zones : [];
                lines.push(`— раздел ${partition.num ?? '?'} «${partition.name ?? ''}»: arm=${partition.arm ?? '?'} (${partition.arm === 1 ? 'под охраной' : partition.arm === 0 ? 'снят' : '?'}), зон: ${zones.length}`);
                for (const zone of zones.slice(0, MAX_OBJECTS_PER_REQUEST)) {
                    const zoneStates = Array.isArray(zone?.states) ? zone.states : [];
                    lines.push(`    зона ${zone.num ?? '?'} «${zone.name ?? ''}»: states=${zoneStates.length === 0 ? '[] (норма)' : JSON.stringify(zoneStates)}`);
                }
            }
            if (attempt >= OBJ_SCAN_MAX_ATTEMPTS && (scanState === 0 || scanState === 1)) {
                lines.push('сканирование не завершилось за отведённое число попыток — повторный вызов возможен вручную');
            }
        } else if (scanState === 0 || scanState === 1) {
            lines.push(`сканирование не завершилось за ${OBJ_SCAN_MAX_ATTEMPTS} попытки — возможен повторный вызов с scanId`);
        } else if (scanState === 2) {
            lines.push('скан вернул ошибку (scanState=2) — см. обработку ошибок поставщика');
        }
        addOk('objects/obj-scan/ — разделы и зоны (асинхронно)', lines);
        }
    } catch (error) {
        addFail('objects/obj-scan/ — разделы и зоны (асинхронно)', [error.message]);
    }

    printReport();

    const failed = report.filter((item) => item.status === 'fail').length;
    console.log(`\nИтог: успешных проверок: ${report.length - failed}, неуспешных: ${failed}, пропущено: ${skipped.length}.`);
    if (skipped.length > 0 || failed > 0) {
        console.log('Реальные ответы API нигде не сохранялись и не выводились целиком.');
    }
};

await main();
