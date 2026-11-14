/**
 * Диагностическая проверка журнала событий GEORITM (этап E2.0 интеграции).
 *
 * Отдельный сценарий: существующий scripts/georitm-diagnostics.mjs этапа 0
 * методы alerts/* и alert-template/* не покрывает. Соглашения (ENV-переменные,
 * формат вызова, вывод) наследуются от него, чтобы прогон был консистентным.
 *
 * Проверяемые методы (только read-only):
 *   - alerts/history-by-obj/   — последние события и действия по объекту;
 *   - alerts/history-on-obj/   — события за период (from/to);
 *   - alert-template/list/     — справочник кодов событий;
 *   - alert-template-group/list/ — группы справочника (для расшифровки groupId).
 *
 * Управляющие методы (arm/disarm, obj-scan, close-open-alarm, save-log,
 * create-general-alarm и прочие write-методы) отсутствуют намеренно.
 *
 * Параметры подключения — те же ENV из `.env.local`:
 *   GEORITM_BASE_URL, GEORITM_LOGIN, GEORITM_PASSWORD.
 *
 * Безопасность:
 *   - только read-only методы; состояние объектов и справочники не меняются;
 *   - пароль, Basic-заголовок и полный ответ users/login/ не выводятся;
 *   - сырые ответы нигде не сохраняются; выводятся только сводные структуры
 *     и ограниченное число репрезентативных записей событий;
 *   - интервалы для history-on-obj строятся из «текущего момента» и из
 *     фактически полученных меток событий, произвольные значения не подставляются;
 *   - TLS-проверка сертификата не отключается.
 *
 * Запуск: npm run georitm:events
 */

import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const REQUEST_TIMEOUT_MS = 15_000;
/** Максимум репрезентативных записей одного типа в выводе. */
const MAX_SAMPLES = 6;
/** Максимум длины строкового значения при выводе образца. */
const MAX_STR = 120;

// ——————————————————————————————————————————————————————————— ENV ————————

/** Читает `.env.local` (тот же формат, что и georitm-diagnostics.mjs). */
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

// ——————————————————————————————————————————————————— Вызовы API ————————

/** Ошибка вызова API с классификацией причины (как в georitm-diagnostics.mjs). */
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

    try {
        return JSON.parse(text);
    } catch {
        throw new ApiCallError('json', response.status, `Некорректный JSON в ответе: ${method}`);
    }
};

// ————————————————————————————————————————— Анализ структур ——————————————

/** Рекурсивно собирает схему значений: типы, объединение ключей, примеры. */
const collectSchema = (value, schema = {keySets: new Map(), examples: []}, depth = 0) => {
    if (depth > 4) {
        return schema;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectSchema(item, schema, depth + 1);
        }
        return schema;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort().join(',');
        if (!schema.keySets.has(keys)) {
            schema.keySets.set(keys, 0);
        }
        schema.keySets.set(keys, schema.keySets.get(keys) + 1);
        if (schema.examples.length < 200) {
            schema.examples.push(value);
        }
        for (const child of Object.values(value)) {
            collectSchema(child, schema, depth + 1);
        }
    }
    return schema;
};

/** Таблица «поле → число записей с этим полем / процент / типы значений». */
const fieldStats = (records) => {
    const stats = new Map();
    for (const record of records) {
        if (!record || typeof record !== 'object') {
            continue;
        }
        for (const [key, value] of Object.entries(record)) {
            if (!stats.has(key)) {
                stats.set(key, {count: 0, types: new Map(), sample: value});
            }
            stats.get(key).count += 1;
            const type = value === null ? 'null'
                : Array.isArray(value) ? 'array'
                    : typeof value;
            stats.get(key).types.set(type, (stats.get(key).types.get(type) ?? 0) + 1);
        }
    }
    return stats;
};

/** Короткая печать статистики полей. */
const printFieldStats = (records, label) => {
    console.log(`  Поля ${label} (${records.length} записей):`);
    const stats = fieldStats(records);
    for (const [key, {count, types, sample}] of stats) {
        const typeList = [...types.entries()].map(([t, n]) => `${t}×${n}`).join(', ');
        const sampleText = typeof sample === 'string' ? `"${trunc(String(sample), 40)}"`
            : sample === null ? 'null'
                : typeof sample === 'object' ? '{…}' : String(sample);
        console.log(`    ${key}: ${count}/${records.length} [${typeList}] напр. ${sampleText}`);
    }
};

/** Обрезка длинных строк для вывода. */
const trunc = (value, max = MAX_STR) => {
    const str = String(value);
    return str.length <= max ? str : `${str.slice(0, max)}…`;
};

/** Образец записи: длинные строки обрезаются, объекты печатно сжимаются. */
const sampleJson = (record) => {
    const clone = {};
    for (const [key, value] of Object.entries(record)) {
        if (typeof value === 'string' && value.length > MAX_STR) {
            clone[key] = trunc(value);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            clone[key] = '{объект, ключи: ' + Object.keys(value).slice(0, 8).join(', ') + '}';
        } else {
            clone[key] = value;
        }
    }
    return JSON.stringify(clone);
};

// ————————————————————————— Анализ временных меток ———————————————————————

/**
 * Проверка метки: обе интерпретации (секунды и миллисекунды) с датами.
 * plausible = год в диапазоне 2008..(текущий год + 2).
 */
const interpretTs = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
        return {raw: value, ms: null, sec: null, verdict: 'не числовое значение'};
    }
    const asMs = new Date(n);
    const asSec = new Date(n * 1000);
    const now = Date.now();
    const plausible = (date) => {
        const year = date.getUTCFullYear();
        return !Number.isNaN(date.getTime()) && year >= 2008 && year <= new Date(now).getUTCFullYear() + 2;
    };
    const msPlausible = plausible(asMs);
    const secPlausible = plausible(asSec);
    let verdict;
    if (msPlausible && !secPlausible) {
        verdict = 'миллисекунды';
    } else if (secPlausible && !msPlausible) {
        verdict = 'секунды';
    } else if (msPlausible && secPlausible) {
        verdict = 'неоднозначно (правдоподобны обе интерпретации)';
    } else {
        verdict = 'ни одна интерпретация не правдоподобна';
    }
    return {
        raw: n,
        ms: asMs.toISOString(),
        sec: asSec.toISOString(),
        verdict,
    };
};

/** Печать разбора метки: значение → даты в обеих интерпретациях. */
const printTsInterpretation = (name, value) => {
    const parsed = interpretTs(value);
    console.log(`    ${name} = ${parsed.raw}`);
    console.log(`      как мс: ${parsed.ms ?? '—'}   как сек: ${parsed.sec ?? '—'}`);
    console.log(`      вывод: ${parsed.verdict}`);
};

// ——————————————————————————————————————————— Отчёт ———————————————————————

const results = [];
const stage = (title, fn) => results.push({title, fn});
const ok = (title, lines) => ({title, status: 'OK', lines});
const fail = (title, lines) => ({title, status: 'FAIL', lines});

// ——————————————————————————————————————————— Проверки —————————————————————

const main = async () => {
    if (!baseUrl || !login || !password) {
        console.error('Параметры GEORITM_BASE_URL / GEORITM_LOGIN / GEORITM_PASSWORD не заданы (см. .env.local).');
        process.exitCode = 1;
        return;
    }
    if (!/^https?:\/\//.test(baseUrl)) {
        console.error('GEORITM_BASE_URL должен начинаться с http:// или https://');
        process.exitCode = 1;
        return;
    }

    let basic = null;
    const state = {};

    stage('1. users/login/ — авторизация', async () => {
        const response = await callApi('users/login/', {login, password});
        if (!response || typeof response !== 'object' || response.id === undefined) {
            throw new ApiCallError('shape', 200, 'Ответ users/login/ без id пользователя');
        }
        basic = typeof response.basic === 'string' && response.basic.length > 0
            ? response.basic
            : Buffer.from(`${login}:${password}`, 'utf8').toString('base64');
        return ok('users/login/', [
            `id=${response.id}, isAdmin=${response.isAdmin ?? '—'} (Basic не выводится)`,
        ]);
    });

    stage('2. objects/objects-tree-set/ + objects/obj/ — выбор объекта', async () => {
        const tree = await callApi('objects/objects-tree-set/', {groupType: 1, sort: 'name'}, {basic});
        const groups = Array.isArray(tree) ? tree : Array.isArray(tree?.groups) ? tree.groups : null;
        if (!groups) {
            throw new ApiCallError('shape', 200, 'Неожиданный формат objects/objects-tree-set/');
        }
        const ids = [];
        const walk = (nodes) => {
            for (const group of nodes) {
                for (const object of group?.objs ?? []) {
                    if (object?.id !== undefined && !ids.includes(object.id)) {
                        ids.push(object.id);
                    }
                }
                if (group?.objsGroups) {
                    walk(group.objsGroups);
                }
            }
        };
        walk(groups);
        if (ids.length === 0) {
            throw new ApiCallError('shape', 200, 'У пользователя нет объектов — проверка журнала невозможна');
        }
        const objectId = ids[0];
        const objects = await callApi('objects/obj/', {objectId: [objectId]}, {basic});
        const object = Array.isArray(objects) ? objects.find((item) => item?.id === objectId) : null;
        state.objectId = objectId;
        state.object = object;
        // imei и прочие чувствительные поля объекта не выводим.
        return ok('Выбор объекта', [
            `объектов у пользователя: ${ids.length}, для проверки выбран id=${objectId}`,
            object ? `name=«${trunc(object.name ?? '', 40)}», objType=${object.objType}, isOnline=${object?.objectState?.isOnline ?? object?.isGsmOnline ?? '—'}` : 'краткая информация objects/obj/ недоступна',
            object?.lastGSMConnectionTime !== undefined
                ? `lastGSMConnectionTime = ${object.lastGSMConnectionTime} → ${interpretTs(object.lastGSMConnectionTime).verdict} (как мс: ${interpretTs(object.lastGSMConnectionTime).ms ?? '—'})`
                : 'lastGSMConnectionTime отсутствует',
        ]);
    });

    stage('3. alert-template-group/list/ — группы справочника', async () => {
        const raw = await callApi('alert-template-group/list/', {}, {basic});
        const groups = Array.isArray(raw) ? raw : Array.isArray(raw?.groups) ? raw.groups : null;
        if (!groups) {
            throw new ApiCallError('shape', 200, `Неожиданный формат ответа: ${typeof raw}`);
        }
        state.templateGroups = new Map(groups.map((group) => [group?.id, group?.name]));
        return ok('alert-template-group/list/', [
            `групп: ${groups.length}`,
            ...groups.map((group) => `— id=${group?.id} «${group?.name ?? '—'}» (ключи: ${Object.keys(group).sort().join(', ')})`),
        ]);
    });

    stage('4. alert-template/list/ — справочник кодов событий', async () => {
        const raw = await callApi('alert-template/list/', {}, {basic});
        const templates = Array.isArray(raw) ? raw : Array.isArray(raw?.templates) ? raw.templates : null;
        if (!templates) {
            throw new ApiCallError('shape', 200, `Неожиданный формат ответа: ${typeof raw}`);
        }
        state.templates = templates;
        state.templateByCode = new Map(templates.map((template) => [String(template?.code), template]));

        const schema = collectSchema(templates);
        const codeTypes = new Map();
        for (const template of templates) {
            const type = template?.code === undefined || template?.code === null ? 'undefined' : typeof template.code;
            codeTypes.set(type, (codeTypes.get(type) ?? 0) + 1);
        }
        const groupDist = new Map();
        for (const template of templates) {
            const key = `${template?.groupId} (${state.templateGroups.get(template?.groupId) ?? '?'})`;
            groupDist.set(key, (groupDist.get(key) ?? 0) + 1);
        }
        const alarmCount = templates.filter((template) => template?.isAlarm === true || template?.isAlarm === 1).length;

        const lines = [
            `записей: ${templates.length}`,
            `наборы ключей: ${[...schema.keySets.entries()].map(([keys, n]) => `(${keys})×${n}`).join(' | ')}`,
            `типы code: ${[...codeTypes.entries()].map(([t, n]) => `${t}×${n}`).join(', ')}`,
            `с isAlarm=true: ${alarmCount}`,
            'распределение по groupId:',
            ...[...groupDist.entries()].map(([key, n]) => `    groupId=${key}: ${n}`),
            `репрезентативные шаблоны (первые ${Math.min(MAX_SAMPLES, templates.length)}):`,
            ...templates.slice(0, MAX_SAMPLES).map((template) => `    ${sampleJson(template)}`),
        ];
        return ok('alert-template/list/', lines);
    });

    stage('5. alerts/history-by-obj/ — последние события и действия', async () => {
        const raw = await callApi('alerts/history-by-obj/', {objectId: state.objectId}, {basic});
        const records = Array.isArray(raw) ? raw
            : Array.isArray(raw?.alerts) ? raw.alerts
                : Array.isArray(raw?.history) ? raw.history
                    : null;
        if (!records) {
            throw new ApiCallError('shape', 200, `Неожиданный формат ответа: ${typeof raw}; верхнеуровневые ключи: ${raw && typeof raw === 'object' ? Object.keys(raw).join(', ') : '—'}`);
        }
        state.history = records;

        const events = records.filter((record) => record?.alertTs !== undefined || record?.type === 'ObjectAlert');
        const actions = records.filter((record) => record?.actionType !== undefined || record?.type === 'ObjectAlertLog');
        const other = records.length - events.length - actions.length;
        state.events = events;
        state.actions = actions;

        const lines = [
            `записей всего: ${records.length} (событий: ${events.length}, действий: ${actions.length}${other > 0 ? `, прочих: ${other}` : ''})`,
        ];
        if (events.length > 0) {
            lines.push('');
            printFieldStats(events, 'событий (ObjectAlert)');
            lines.push('');
            lines.push(`образцы событий (первые ${Math.min(MAX_SAMPLES, events.length)}):`);
            for (const event of events.slice(0, MAX_SAMPLES)) {
                lines.push(`    ${sampleJson(event)}`);
            }
        }
        if (actions.length > 0) {
            lines.push('');
            printFieldStats(actions, 'действий (ObjectAlertLog)');
            lines.push('');
            lines.push(`образцы действий (первые ${Math.min(MAX_SAMPLES, actions.length)}):`);
            for (const action of actions.slice(0, MAX_SAMPLES)) {
                lines.push(`    ${sampleJson(action)}`);
            }
        }
        if (records.length === 0) {
            lines.push('журнал пуст — семантику полей проверить нельзя');
        }

        // Сопоставление кодов событий со справочником alert-template/list/.
        // code в журнале — строка «NNN.N», в справочнике — число; рабочее
        // соответствие проверяется в этапе 10, здесь тот же приём.
        if (events.length > 0 && state.templateByCode) {
            const codes = new Map();
            for (const event of events) {
                const key = event.code === undefined || event.code === null ? '(нет code)' : String(event.code);
                codes.set(key, (codes.get(key) ?? 0) + 1);
            }
            lines.push('');
            lines.push('коды событий в журнале и покрытие справочником (NNN.N → NNNN):');
            for (const [code, count] of codes) {
                const template = state.templateByCode.get(code) ?? state.templateByCode.get(code.replace('.', ''));
                lines.push(`    code=${code} ×${count}${template ? ` → «${trunc(template.message ?? '', 50)}» (groupId=${template.groupId}, isAlarm=${template.isAlarm})` : ' → НЕТ в alert-template/list/'}`);
            }
        }
        return ok('alerts/history-by-obj/', lines);
    });

    stage('6. alerts/history-on-obj/ — поведение without from/to (null-по умолчанию)', async () => {
        const raw = await callApi('alerts/history-on-obj/', {objectId: state.objectId}, {basic});
        const records = Array.isArray(raw) ? raw
            : Array.isArray(raw?.alerts) ? raw.alerts : null;
        if (!records) {
            throw new ApiCallError('shape', 200, `Неожиданный формат ответа: ${typeof raw}; ключи: ${raw && typeof raw === 'object' ? Object.keys(raw).join(', ') : '—'}`);
        }
        const events = records.filter((record) => record?.alertTs !== undefined);
        const actions = records.filter((record) => record?.actionType !== undefined);
        return ok('alerts/history-on-obj/ (без from/to)', [
            `записей: ${records.length} (событий: ${events.length}, действий: ${actions.length})`,
            'документация: from=null → «со времени последнего сброса», to=null → «по текущее время»',
        ]);
    });

    stage('7. alerts/history-on-obj/ — интервал «последние 24 часа» в миллисекундах', async () => {
        const nowMs = Date.now();
        const from = nowMs - 24 * 60 * 60 * 1000;
        const raw = await callApi('alerts/history-on-obj/', {objectId: state.objectId, from, to: nowMs}, {basic});
        const records = Array.isArray(raw) ? raw : Array.isArray(raw?.alerts) ? raw.alerts : [];
        state.msWindow = {from, to: nowMs, records};
        const inWindow = records.filter((record) => Number(record?.alertTs) >= from && Number(record?.alertTs) <= nowMs);
        return ok('history-on-obj/ (from/to в мс, последние 24 ч)', [
            `from=${from} (${new Date(from).toISOString()}), to=${nowMs}`,
            `записей: ${records.length}; из них с alertTs внутри окна: ${inWindow.length}`,
            records.length > 0 && inWindow.length === records.length
                ? 'все alertTs попадают в окно → фильтрация по миллисекундам подтверждается'
                : records.length === 0 && (state.events?.length ?? 0) > 0
                    ? 'окно пустое, хотя history-by-obj возвращает события — возможно, единицы отличны от мс (см. этап 8)'
                    : 'см. этап 8 для сопоставления',
        ]);
    });

    stage('8. alerts/history-on-obj/ — тот же интервал в секундах (контрольная проверка единиц)', async () => {
        const {from, to, records: msRecords} = state.msWindow ?? {};
        if (from === undefined) {
            return fail('history-on-obj/ (секунды)', ['этап 7 не выполнен — контрольная проверка невозможна']);
        }
        const raw = await callApi('alerts/history-on-obj/', {objectId: state.objectId, from: Math.floor(from / 1000), to: Math.floor(to / 1000)}, {basic});
        const records = Array.isArray(raw) ? raw : Array.isArray(raw?.alerts) ? raw.alerts : [];
        return ok('history-on-obj/ (from/to в секундах, то же окно)', [
            `from=${Math.floor(from / 1000)} (≈1970-01-21 в мс-интерпретации), to=${Math.floor(to / 1000)}`,
            `записей: ${records.length}`,
            `для сравнения: тот же интервал в мс дал ${msRecords?.length ?? '?'} записей`,
            records.length === 0 && (msRecords?.length ?? 0) > 0
                ? 'интервал в секундах пуст, в мс — нет → сервер интерпретирует from/to как миллисекунды'
                : records.length > 0 && (msRecords?.length ?? 0) === 0
                    ? 'интервал в секундах вернул записи, в мс — нет → сервер интерпретирует from/to как секунды'
                    : 'результаты совпадают — интерпретация неоднозначна, требуется сопоставление (этап 9)',
        ]);
    });

    stage('9. alerts/history-on-obj/ — интервал вокруг фактических событий из history-by-obj', async () => {
        const events = state.events ?? [];
        if (events.length === 0) {
            return fail('history-on-obj/ (окно вокруг фактических событий)', ['события в history-by-obj отсутствуют — сопоставление невозможно']);
        }
        // Берём фактические метки событий и строим окно ±1 час вокруг min/max
        // в КАЖДОЙ интерпретации — значения не произвольные, а получены из ответа API.
        const tsList = events.map((event) => Number(event.alertTs)).filter((n) => Number.isFinite(n));
        const min = Math.min(...tsList);
        const max = Math.max(...tsList);
        const margin = 60 * 60 * 1000;
        const probes = [
            {unit: 'мс', from: min - margin, to: max + margin},
            {unit: 'сек', from: Math.floor(min / 1000) - 3600, to: Math.floor(max / 1000) + 3600},
        ];
        const lines = [
            `фактические alertTs из history-by-obj: min=${min}, max=${max} (${events.length} событий)`,
        ];
        state.windowCounts = {};
        for (const probe of probes) {
            const raw = await callApi('alerts/history-on-obj/', {objectId: state.objectId, from: probe.from, to: probe.to}, {basic});
            const records = Array.isArray(raw) ? raw : Array.isArray(raw?.alerts) ? raw.alerts : [];
            state.windowCounts[probe.unit] = records.length;
            lines.push(`    окно в ${probe.unit}: from=${probe.from}, to=${probe.to} → записей: ${records.length}`);
        }
        const msCount = state.windowCounts['мс'] ?? 0;
        const secCount = state.windowCounts['сек'] ?? 0;
        if (msCount > 0 && secCount === 0) {
            lines.push('    → окно в мс захватывает события, в секундах — нет: единицы from/to = МС');
        } else if (secCount > 0 && msCount === 0) {
            lines.push('    → окно в секундах захватывает события, в мс — нет: единицы from/to = СЕКУНДЫ');
        } else if (msCount > 0 && secCount > 0) {
            lines.push('    → оба окна вернули записи: интерпретация неоднозначна (нужно сопоставление составов записей)');
        } else {
            lines.push('    → оба окна пусты: единицы from/to не установить этим способом');
        }
        return ok('history-on-obj/ (окно вокруг фактических событий)', lines);
    });

    stage('10. Сопоставление кодов «NNN.N» из журнала со справочником (числовые code)', async () => {
        const events = state.events ?? [];
        const templateByCode = state.templateByCode;
        if (events.length === 0 || !templateByCode) {
            return fail('Сопоставление кодов', ['нет событий или справочника']);
        }
        // Формат кода события в журнале — строка «NNN.N» (например «602.1»),
        // а code в alert-template/list/ — число. Проверяем две гипотезы
        // соответствия: без точки (602.1 → 6021) и целая часть (602.1 → 602).
        const codes = [...new Set(events.map((event) => String(event.code)))];
        const hypotheses = {
            'без точки (602.1 → 6021)': (code) => code.replace('.', ''),
            'целая часть (602.1 → 602)': (code) => code.split('.')[0],
        };
        const lines = [];
        const coverage = {full: [], partial: []};
        for (const [name, map] of Object.entries(hypotheses)) {
            const hits = codes.filter((code) => templateByCode.has(map(code)));
            coverage[name] = hits;
            lines.push(`    гипотеза ${name}: совпало ${hits.length}/${codes.length}`);
        }
        // Выбираем гипотезу с полным покрытием и сверяем тексты и isAlarm.
        const bestName = Object.keys(hypotheses).find((name) => coverage[name].length === codes.length)
            ?? Object.keys(hypotheses).find((name) => coverage[name].length > 0);
        if (bestName) {
            const map = hypotheses[bestName];
            lines.push(`    рабочая гипотеза: ${bestName}`);
            let textMatch = 0;
            let alarmMatch = 0;
            const mismatches = [];
            for (const code of coverage[bestName]) {
                const event = events.find((item) => String(item.code) === code);
                const template = templateByCode.get(map(code));
                if (template) {
                    if (template.message === event.messageText) {
                        textMatch += 1;
                    } else {
                        mismatches.push(`        code=${code}: журнал «${trunc(event.messageText, 60)}» vs справочник «${trunc(template.message ?? '', 60)}»`);
                    }
                    if ((template.isAlarm === true || template.isAlarm === 1) === event.isAlarm) {
                        alarmMatch += 1;
                    }
                }
            }
            const matched = coverage[bestName].length;
            lines.push(`    messageText совпадает с message справочника: ${textMatch}/${matched}`);
            lines.push(`    isAlarm события совпадает с isAlarm шаблона: ${alarmMatch}/${matched}`);
            if (mismatches.length > 0) {
                lines.push('    расхождения текста:');
                lines.push(...mismatches.slice(0, MAX_SAMPLES));
            }
            const missing = codes.filter((code) => !coverage[bestName].includes(code));
            if (missing.length > 0) {
                lines.push(`    коды без совпадения: ${missing.join(', ')}`);
            }
        } else {
            lines.push('    ни одна гипотеза не дала совпадений — связь кодов со справочником не установлена');
        }
        return ok('Сопоставление кодов с alert-template/list/', lines);
    });

    stage('11. Разбор временных меток по каждой записи', async () => {
        const events = state.events ?? [];
        if (events.length === 0) {
            return fail('Разбор временных меток', ['события отсутствуют']);
        }
        const sorted = [...events].sort((a, b) => Number(a.alertTs) - Number(b.alertTs));
        const lines = [`события (${sorted.length}), сортировка по alertTs:`];
        let deltaOverHour = 0;
        const deltas = [];
        for (const event of sorted) {
            const alertTs = Number(event.alertTs);
            const receivedAt = Number(event.receivedAt);
            const deltaSec = Number.isFinite(alertTs) && Number.isFinite(receivedAt) ? (receivedAt - alertTs) / 1000 : null;
            if (deltaSec !== null) {
                deltas.push(deltaSec);
                if (Math.abs(deltaSec) > 3600) {
                    deltaOverHour += 1;
                }
            }
            lines.push(
                `    id=${event.alertId} code=${event.code} isAlarm=${event.isAlarm}`
                + ` событие=${new Date(alertTs).toISOString()} получено=${Number.isFinite(receivedAt) ? new Date(receivedAt).toISOString() : '—'}`
                + ` Δ=${deltaSec === null ? '—' : `${deltaSec.toFixed(1)} сек`}`,
            );
        }
        // Сортировка history-by-obj: последовательность ответа по alertId и alertTs.
        const rawAlerts = state.history.filter((record) => record?.type === 'ObjectAlert');
        const rawOrder = rawAlerts.map((record) => Number(record.alertTs));
        const isDescending = rawOrder.every((value, index) => index === 0 || rawOrder[index - 1] >= value);
        const isAscending = rawOrder.every((value, index) => index === 0 || rawOrder[index - 1] <= value);
        lines.push('');
        lines.push(`порядок записей в history-by-obj: ${isDescending ? 'убывание времени (свежие первыми)' : isAscending ? 'возрастание времени' : 'без явного порядка'}`);
        lines.push(`последовательность alertId в ответе: ${rawAlerts.map((record) => record.alertId).join(', ')}`);
        if (deltas.length > 0) {
            const min = Math.min(...deltas);
            const max = Math.max(...deltas);
            lines.push(`Δ = receivedAt − alertTs: min=${min.toFixed(1)} сек, max=${max.toFixed(1)} сек, |Δ| > 1 часа у ${deltaOverHour}/${deltas.length}`);
            lines.push(deltaOverHour === 0
                ? 'обе метки в миллисекундах, задержка доставки в пределах часа — согласованность подтверждается'
                : 'есть дельты > 1 часа: либо реальная задержка получения, либо разная природа полей — интерпретировать осторожно');
        }
        return ok('Разбор временных меток', lines);
    });

    stage('12. history-on-obj/ — точность фильтрации (окно вокруг последних событий)', async () => {
        const events = state.events ?? [];
        if (events.length === 0) {
            return fail('history-on-obj/ (точность фильтрации)', ['события отсутствуют']);
        }
        // Окно, покрывающее только последние 5 событий: from = alertTs
        // 5-го с конца − 1 час. Значения взяты из фактических ответов API.
        const sortedDesc = [...events].sort((a, b) => Number(b.alertTs) - Number(a.alertTs));
        const from = Number(sortedDesc[Math.min(4, sortedDesc.length - 1)].alertTs) - 60 * 60 * 1000;
        const to = Date.now();
        const raw = await callApi('alerts/history-on-obj/', {objectId: state.objectId, from, to}, {basic});
        const records = Array.isArray(raw) ? raw : Array.isArray(raw?.alerts) ? raw.alerts : [];
        const expectedIds = new Set(sortedDesc.slice(0, 5).map((event) => event.alertId));
        const actualIds = new Set(records.filter((record) => record?.type === 'ObjectAlert').map((record) => record.alertId));
        const exactMatch = [...actualIds].every((id) => expectedIds.has(id));
        const allPresent = [...expectedIds].every((id) => actualIds.has(id));
        // События проверяем по alertTs, действия (ObjectAlertLog, без alertTs) —
        // по receivedAt: гипотеза, что окно фильтрует записи по их «времени».
        const windowEvents = records.filter((record) => record?.type === 'ObjectAlert');
        const windowActions = records.filter((record) => record?.type !== 'ObjectAlert');
        const eventsInBounds = windowEvents.every((record) => Number(record.alertTs) >= from);
        const actionsInBounds = windowActions.every((record) => Number(record.receivedAt) >= from);
        const sortedCheck = windowEvents.map((record) => Number(record?.alertTs)).every((value, index, arr) => index === 0 || arr[index - 1] >= value);
        return ok('history-on-obj/ (точность фильтрации)', [
            `окно: from=${from} (${new Date(from).toISOString()}) … to=${to} (текущее время)`,
            `записей: ${records.length} (событий: ${actualIds.size}, действий: ${windowActions.length})`,
            `последние 5 событий истории вошли: ${allPresent ? 'да' : 'НЕТ'}, посторонних нет: ${exactMatch ? 'да' : 'НЕТ'}`,
            `границы по alertTs для событий: ${eventsInBounds ? 'все alertTs ≥ from' : 'НЕТ — есть события левее границы'}`,
            windowActions.length > 0
                ? `действия в окне: ${windowActions.length} (receivedAt ${actionsInBounds ? '≥ from — действия, судя по всему, фильтруются по receivedAt' : '< from — критерий фильтрации действий иной'})`
                : 'действий в окне нет',
            `порядок событий в ответе: ${sortedCheck ? 'убывание времени' : 'неубывание нарушено'}`,
        ]);
    });

    stage('13. history-on-obj/ — поведение пустых и вырожденных диапазонов', async () => {
        const lines = [];
        // (а) строго историческое пустое окно: сутки в 1999 году — до появления
        //     каких-либо записей (значение выбрано заведомо вне данных, не произвольно).
        const emptyFrom = Date.UTC(1999, 0, 1);
        const emptyTo = Date.UTC(1999, 0, 2);
        const emptyRaw = await callApi('alerts/history-on-obj/', {objectId: state.objectId, from: emptyFrom, to: emptyTo}, {basic});
        const emptyRecords = Array.isArray(emptyRaw) ? emptyRaw : Array.isArray(emptyRaw?.alerts) ? emptyRaw.alerts : null;
        lines.push(`    пустой диапазон 1999-01-01…1999-01-02: ${emptyRecords === null ? `неожиданный формат (${typeof emptyRaw})` : `записей: ${emptyRecords.length}`}`);

        // (б) from = to (мгновенный интервал в момент известного события).
        const events = state.events ?? [];
        if (events.length > 0) {
            const instantTs = Number(events[0].alertTs);
            const instantRaw = await callApi('alerts/history-on-obj/', {objectId: state.objectId, from: instantTs, to: instantTs}, {basic});
            const instantRecords = Array.isArray(instantRaw) ? instantRaw : Array.isArray(instantRaw?.alerts) ? instantRaw.alerts : null;
            lines.push(`    from = to = метка события (${new Date(instantTs).toISOString()}): ${instantRecords === null ? 'неожиданный формат' : `записей: ${instantRecords.length}`}`);
        }

        // (в) from > to (перевёрнутый диапазон).
        const invertedRaw = await callApi('alerts/history-on-obj/', {objectId: state.objectId, from: emptyTo, to: emptyFrom}, {basic});
        const invertedRecords = Array.isArray(invertedRaw) ? invertedRaw : Array.isArray(invertedRaw?.alerts) ? invertedRaw.alerts : null;
        lines.push(`    from > to (перевёрнутый): ${invertedRecords === null ? `неожиданный формат (${typeof invertedRaw})` : `записей: ${invertedRecords.length}`}`);

        // (г) только from (to опущен) — документированное значение по умолчанию to=null.
        const fromOnlyRaw = await callApi('alerts/history-on-obj/', {objectId: state.objectId, from: emptyFrom}, {basic});
        const fromOnlyRecords = Array.isArray(fromOnlyRaw) ? fromOnlyRaw : Array.isArray(fromOnlyRaw?.alerts) ? fromOnlyRaw.alerts : null;
        lines.push(`    только from (to опущен): ${fromOnlyRecords === null ? 'неожиданный формат' : `записей: ${fromOnlyRecords.length}`}`);
        return ok('history-on-obj/ (вырожденные диапазоны)', lines);
    });

    stage('14. Сводка по временным меткам', async () => {
        const lines = [];
        const events = state.events ?? [];
        if (events.length > 0) {
            const sample = events[0];
            lines.push('поле alertTs (время события):');
            printTsInterpretation('alertTs[0]', sample.alertTs);
            lines.push('поле receivedAt (время получения):');
            if (sample.receivedAt !== undefined) {
                printTsInterpretation('receivedAt[0]', sample.receivedAt);
                const delta = Number(sample.receivedAt) - Number(sample.alertTs);
                lines.push(`      receivedAt − alertTs = ${delta}`);
                const absDelta = Math.abs(delta);
                if (absDelta > 1e9) {
                    lines.push('      → разница ~1000×: поля в РАЗНЫХ единицах (sec vs ms) — проверить по следующим записям');
                } else if (absDelta <= 60 * 60 * 1000) {
                    lines.push('      → разница в пределах часа: поля, вероятно, в ОДИНАКОВЫХ единицах');
                } else {
                    lines.push('      → разница от часов до суток: либо задержка доставки, либо разные единицы — см. распределение');
                }
                // Распределение дельт по всем событиям — индикатор согласованности единиц.
                const deltas = events
                    .map((event) => Number(event.receivedAt) - Number(event.alertTs))
                    .filter((n) => Number.isFinite(n));
                if (deltas.length > 1) {
                    const sameSign = deltas.every((d) => d >= 0) || deltas.every((d) => d <= 0);
                    const magnitudes = deltas.map((d) => Math.abs(d));
                    const consistent = magnitudes.every((m) => (m > 1e9) === (magnitudes[0] > 1e9));
                    lines.push(`      дельт: ${deltas.length}, одинаковый знак: ${sameSign ? 'да' : 'нет'}, порядок величин согласован: ${consistent ? 'да' : 'НЕТ'}`);
                }
            } else {
                lines.push('      поле receivedAt в записях отсутствует');
            }
        } else {
            lines.push('события отсутствуют — временные метки проверить нельзя');
        }
        const actions = state.actions ?? [];
        if (actions.length > 0) {
            lines.push('действия (ObjectAlertLog):');
            const timeKey = actions[0].receivedAt !== undefined ? 'receivedAt' : actions[0].recivedAt !== undefined ? 'recivedAt (так в документе)' : null;
            if (timeKey) {
                printTsInterpretation(`${timeKey}[0]`, actions[0][timeKey]);
            } else {
                lines.push('      временных полей не обнаружено; ключи: ' + Object.keys(actions[0]).join(', '));
            }
            const dist = new Map();
            for (const action of actions) {
                dist.set(action.actionType, (dist.get(action.actionType) ?? 0) + 1);
            }
            lines.push(`      actionType: ${[...dist.entries()].map(([k, n]) => `${k}×${n}`).join(', ')} (1 — закрытие тревоги, 2 — комментарий, по документации)`);
        }
        return ok('Сводка по временным меткам', lines);
    });

    // ——————————————————————————————————————— Прогон ———————————————————————

    for (const {title, fn} of results) {
        console.log(`\n——— ${title} ———`);
        try {
            const outcome = await fn();
            console.log(`[${outcome.status}] ${outcome.title}`);
            for (const line of outcome.lines) {
                console.log(`  ${line}`);
            }
            if (outcome.status === 'FAIL' && title.startsWith('1.')) {
                console.log('\nБез авторизации проверки невозможны.');
                process.exitCode = 2;
                return;
            }
        } catch (error) {
            const message = error instanceof ApiCallError ? error.message : (error?.message ?? String(error));
            console.log(`[FAIL] ${title}`);
            console.log(`  ${message}`);
            if (title.startsWith('1.') || title.startsWith('2.')) {
                console.log('\nДальнейшие проверки невозможны.');
                process.exitCode = 2;
                return;
            }
        }
    }

    console.log('\nГотово. Сырые ответы нигде не сохранялись; секреты не выводились.');
};

await main();
