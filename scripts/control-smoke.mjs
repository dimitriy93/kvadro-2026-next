/**
 * Смоук-сценарии управления охраной (E12). Запуск:
 *
 *   node scripts/control-smoke.mjs
 *
 * Проверяются без сети (детерминированно, на инъектированном транспорте):
 *   1) feature gate GEORITM_CONTROL_ENABLED — включено только значение
 *      'true', отсутствие переменной и любые другие значения — выключено;
 *   2) формирование payload методов GEORITM (mock fetch): objects/arm/,
 *      objects/disarm/ — ровно {imei, area}; objects/obj-details/ —
 *      objectId СТРОГО массивом (исправление дефекта E11: скаляр даёт
 *      HTTP 500); objects/obj-areas/, objects/state/ — read-only тела;
 *   3) движок observeCommandOutcome: подтверждение переходом состояния,
 *      {success:1} без перехода → unknown, отказ-коды 4501/4503/9201 →
 *      rejected, несоответствующие код/действие/раздел → unknown,
 *      ошибки опроса не дают исхода, ровно одна отправка команды;
 *   4) guard повторов: in-flight, cooldown после unknown, rate limit;
 *   5) executeGeoritmControlCommand: gate off → ни одного вызова
 *      транспорта (в том числе read); счастливый путь; отказы прав/canArm/
 *      restricted/IMEI/состояния; уже в целевом состоянии; чужой раздел;
 *      401; isFromIDP без canArm не разрешает управление;
 *   6) demo-аналог: тот же gate, ownership, трёхзначность, оверлей;
 *   7) обогащение capability-контекста objects/obj/ (E13): mock-контекст
 *      имитирует фактический tree-set БЕЗ imei/canArm (проба E12.3 — 6
 *      полей), оба значения приходят из objects/obj/; строгая сверка id
 *      (запись другого объекта отбрасывается); ошибка/отсутствие obj/
 *      дают запрет; при выключенном gate objects/obj/ не вызывается.
 *
 * Реальные write-вызовы не выполняются: транспорт подменяется целиком.
 */

import {
    ControlCommandGuard,
    findCommandFailureCode,
    observeCommandOutcome,
    parseJournalCode,
    readPartitionState,
    targetStateValue,
} from '../lib/account/control-engine.ts';
import {parseControlGate} from '../lib/account/control-gate.ts';
import {ControlError} from '../lib/account/contracts.ts';
import {deleteSession} from '../lib/account/session-store.ts';
import {executeGeoritmControlCommand, getGeoritmControlState, computeControlAvailability, applyControlGateToState} from '../lib/account/georitm-control.ts';
import {
    georitmArm,
    georitmDisarm,
    georitmObjectAreas,
    georitmObjectDetails,
    georitmPartitionsState,
    GeoritmApiError,
} from '../lib/georitm/api-client.ts';
import {executeDemoControl, getDemoControlState} from '../lib/account/demo-control.ts';

// Хранилище сессий — во временный каталог (тест 401 отзывает сессию).
process.env.ACCOUNT_SESSION_STORE_DIR = process.env.ACCOUNT_SESSION_STORE_DIR
    ?? new URL('./control-smoke-sessions-tmp/', `file://${process.cwd().replace(/\\/g, '/')}/`).pathname;

// База GEORITM для проверок payload (fetch замокан — реальных вызовов нет).
process.env.GEORITM_BASE_URL = 'https://georitm.test';

// ——————————————————————————————————————————————————— каркас ————————

const results = [];
const test = (title, fn) => results.push({title, fn});

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};

const assertEqual = (actual, expected, message) => {
    const actualText = JSON.stringify(actual);
    const expectedText = JSON.stringify(expected);
    if (actualText !== expectedText) {
        throw new Error(`${message}: ожидалось ${expectedText}, получено ${actualText}`);
    }
};

const assertThrowsControl = async (fn, reason, message) => {
    try {
        await fn();
    } catch (error) {
        assert(error instanceof ControlError, `${message}: ожидался ControlError, получен ${error?.name}`);
        assertEqual(error.reason, reason, `${message}: причина`);
        return error;
    }
    throw new Error(`${message}: исключение не выброшено`);
};

/**
 * Мок fetch: собирает вызовы (url, body) и отвечает заготовками.
 * Возвращает {calls, install, restore}; install принимает функцию
 * (url, options) → {status, body}.
 */
const makeFetchMock = () => {
    const calls = [];
    let responder = null;
    const fake = async (url, options) => {
        calls.push({url: String(url), body: options?.body === undefined ? null : JSON.parse(options.body)});
        const response = responder({url: String(url), body: calls[calls.length - 1].body});
        return {
            ok: response.status === 200,
            status: response.status,
            text: async () => typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
        };
    };
    return {
        calls,
        install(responderFn) {
            responder = responderFn;
            globalThis.fetch = fake;
        },
        restore() {
            delete globalThis.fetch;
        },
    };
};

const BASE = 'https://georitm.test';

// ——————————————————————————————— feature gate ————————

test('E12.1 Gate: включено только точное значение true', () => {
    assertEqual(parseControlGate(undefined), false, 'отсутствие переменной');
    assertEqual(parseControlGate(null), false, 'null');
    assertEqual(parseControlGate(''), false, 'пустая строка');
    assertEqual(parseControlGate('true'), true, 'true');
    assertEqual(parseControlGate(' true '), true, 'true с пробелами');
    assertEqual(parseControlGate('TRUE'), true, 'TRUE (регистр не важен)');
    assertEqual(parseControlGate('True'), true, 'True');
    // Любое другое значение — выключено (жёсткий белый список).
    assertEqual(parseControlGate('false'), false, 'false');
    assertEqual(parseControlGate('1'), false, '1');
    assertEqual(parseControlGate('0'), false, '0');
    assertEqual(parseControlGate('yes'), false, 'yes');
    assertEqual(parseControlGate('on'), false, 'on');
    assertEqual(parseControlGate('enabled'), false, 'enabled');
    assertEqual(parseControlGate('true false'), false, 'true false');
});

test('E12.2 Gate: isGeoritmControlEnabled читает окружение при каждом вызове', () => {
    const name = 'GEORITM_CONTROL_ENABLED';
    const saved = process.env[name];
    try {
        delete process.env[name];
        assertEqual(parseControlGate(process.env[name]), false, 'переменная не задана');
        process.env[name] = 'true';
        assertEqual(parseControlGate(process.env[name]), true, 'переменная true');
        process.env[name] = 'false';
        assertEqual(parseControlGate(process.env[name]), false, 'переменная false');
    } finally {
        if (saved === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = saved;
        }
    }
});

// ————————————————————— payload методов GEORITM (mock fetch) ————————

test('E12.3 objects/arm/: POST {imei, area} — ровно два поля, URL и Basic', async () => {
    const mock = makeFetchMock();
    mock.install(() => ({status: 200, body: {success: 1}}));
    try {
        const response = await georitmArm('TESTBASIC', '863591025852785', 2);
        assertEqual(response, {success: 1}, 'ответ');
        assertEqual(mock.calls.length, 1, 'один вызов');
        assertEqual(mock.calls[0].url, `${BASE}/restapi/objects/arm/json`, 'URL');
        assertEqual(mock.calls[0].body, {imei: '863591025852785', area: 2}, 'тело — ровно imei и area');
    } finally {
        mock.restore();
    }
});

test('E12.4 objects/disarm/: POST {imei, area}', async () => {
    const mock = makeFetchMock();
    mock.install(() => ({status: 200, body: {success: 1}}));
    try {
        await georitmDisarm('TESTBASIC', '863591025852785', 1);
        assertEqual(mock.calls[0].url, `${BASE}/restapi/objects/disarm/json`, 'URL');
        assertEqual(mock.calls[0].body, {imei: '863591025852785', area: 1}, 'тело');
    } finally {
        mock.restore();
    }
});

test('E12.5 objects/obj-details/: objectId передаётся СТРОГО массивом (дефект E11)', async () => {
    const mock = makeFetchMock();
    mock.install(() => ({status: 200, body: {objType: '1'}}));
    try {
        await georitmObjectDetails('TESTBASIC', 59);
        assertEqual(mock.calls[0].url, `${BASE}/restapi/objects/obj-details/json`, 'URL');
        // Скаляр вызывает HTTP 500 «Integer cannot be cast to Collection»
        // (проба E11 на 2.27.0) — гарантируем сериализацию массивом.
        assertEqual(mock.calls[0].body, {objectId: [59], callDevice: false}, 'тело с массивом objectId');
    } finally {
        mock.restore();
    }
});

test('E12.6 objects/obj-areas/ и objects/state/: read-only тела', async () => {
    const mock = makeFetchMock();
    mock.install(({url}) => url.includes('obj-areas')
        ? {status: 200, body: [{num: 1, name: 'Торговый зал', isGuarded: false}]}
        : {status: 200, body: {state: {'1': 1}}});
    try {
        const areas = await georitmObjectAreas('TESTBASIC', 59);
        assertEqual(areas, [{num: 1, name: 'Торговый зал', isGuarded: false}], 'obj-areas ответ');
        assertEqual(mock.calls[0].url, `${BASE}/restapi/objects/obj-areas/json`, 'obj-areas URL');
        assertEqual(mock.calls[0].body, {objectId: 59}, 'obj-areas тело');

        const state = await georitmPartitionsState('TESTBASIC', '863591025852785');
        assertEqual(state, {state: {'1': 1}}, 'state ответ');
        assertEqual(mock.calls[1].body, {imei: '863591025852785'}, 'state тело — только imei');
    } finally {
        mock.restore();
    }
});

// ——————————————————————————— движок наблюдения ————————

/** Фальшивые часы: sleep двигает время, реальных пауз нет. */
const makeFakeClock = () => {
    let nowMs = 1_000_000;
    return {
        now: () => nowMs,
        sleep: async (ms) => {
            nowMs += ms;
        },
    };
};

test('E12.7 Движок: confirmed — переход состояния в целевое', async () => {
    const clock = makeFakeClock();
    let polls = 0;
    const outcome = await observeCommandOutcome('arm', 1, {
        send: () => Promise.resolve(),
        pollState: async () => {
            polls += 1;
            return polls >= 2 ? {'1': 2} : {'1': 1};
        },
        fetchFailureEvents: () => Promise.resolve([]),
        windowMs: 1000,
        intervalMs: 100,
        ...clock,
    });
    assertEqual(outcome.result, 'confirmed', 'результат');
    assertEqual(polls, 2, 'опросов до перехода');
});

test('E12.8 Движок: {success:1} без изменения состояния → unknown; отправка ровно одна', async () => {
    const clock = makeFakeClock();
    let sends = 0;
    let polls = 0;
    const outcome = await observeCommandOutcome('arm', 1, {
        send: () => {
            sends += 1;
            return Promise.resolve();
        },
        pollState: () => {
            polls += 1;
            return Promise.resolve({'1': 1});
        },
        fetchFailureEvents: () => Promise.resolve([]),
        windowMs: 300,
        intervalMs: 100,
        ...clock,
    });
    assertEqual(outcome.result, 'unknown', 'результат');
    assertEqual(sends, 1, 'команда отправлена ровно один раз — автоматических повторов нет');
    assert(polls > 1, 'состояние опрашивалось в окне');
});

test('E12.9 Движок: отказ-коды журнала 4501/4503/9201 → rejected', async () => {
    const clock = makeFakeClock();
    const outcome = await observeCommandOutcome('arm', 1, {
        send: () => Promise.resolve(),
        pollState: () => Promise.resolve({'1': 1}),
        fetchFailureEvents: () => Promise.resolve([{type: 'ObjectAlert', code: '450.3', area: 1}]),
        windowMs: 300,
        intervalMs: 100,
        ...clock,
    });
    assertEqual(outcome.result, 'rejected', 'результат');
    assertEqual(outcome.failureCode, 4503, 'код отказа');
});

test('E12.10 Движок: несоответствующие код/действие/раздел не дают rejected', async () => {
    // 450.1 («Ошибка снятия») при команде arm — не отказ взятия.
    const clock = makeFakeClock();
    const mismatch = await observeCommandOutcome('arm', 1, {
        send: () => Promise.resolve(),
        pollState: () => Promise.resolve({'1': 1}),
        fetchFailureEvents: () => Promise.resolve([{type: 'ObjectAlert', code: '450.1', area: 1}]),
        windowMs: 150,
        intervalMs: 50,
        ...clock,
    });
    assertEqual(mismatch.result, 'unknown', '450.1 при arm');

    // Отказ по другому разделу.
    const wrongArea = await observeCommandOutcome('disarm', 2, {
        send: () => Promise.resolve(),
        pollState: () => Promise.resolve({'1': 1}),
        fetchFailureEvents: () => Promise.resolve([{type: 'ObjectAlert', code: '450.1', area: 1}]),
        windowMs: 150,
        intervalMs: 50,
        ...clock,
    });
    assertEqual(wrongArea.result, 'unknown', 'отказ по чужому разделу');

    // Действие оператора (ObjectAlertLog) — не свидетельство отказа.
    const logRecord = await observeCommandOutcome('arm', 1, {
        send: () => Promise.resolve(),
        pollState: () => Promise.resolve({'1': 1}),
        fetchFailureEvents: () => Promise.resolve([{type: 'ObjectAlertLog', code: '450.3', area: 1}]),
        windowMs: 150,
        intervalMs: 50,
        ...clock,
    });
    assertEqual(logRecord.result, 'unknown', 'ObjectAlertLog не считается');
});

test('E12.11 Движок: ошибки опроса и журнала не дают исхода до конца окна', async () => {
    const clock = makeFakeClock();
    const outcome = await observeCommandOutcome('disarm', 1, {
        send: () => Promise.resolve(),
        pollState: () => Promise.reject(new Error('state down')),
        fetchFailureEvents: () => Promise.reject(new Error('journal down')),
        windowMs: 200,
        intervalMs: 50,
        ...clock,
    });
    assertEqual(outcome.result, 'unknown', 'ошибки не превращаются в rejected/confirmed');
});

test('E12.12 Движок: классификация кодов и состояний', () => {
    assertEqual(parseJournalCode('450.1'), 4501, '450.1');
    assertEqual(parseJournalCode('920.1'), 9201, '920.1');
    assertEqual(parseJournalCode('402.1'), 4021, '402.1');
    assertEqual(parseJournalCode('bad'), undefined, 'некорректный код');
    assertEqual(targetStateValue('arm'), 2, 'целевое при взятии');
    assertEqual(targetStateValue('disarm'), 1, 'целевое при снятии');
    assertEqual(readPartitionState({'1': 2}, 1), 2, 'чтение карты');
    assertEqual(readPartitionState({'1': 2}, 3), undefined, 'чужой раздел');
    assertEqual(readPartitionState(undefined, 1), undefined, 'карты нет');
    assertEqual(findCommandFailureCode([{type: 'ObjectAlert', code: '920.1', area: 1}], 'arm', 1), 9201, '9201 при arm');
    assertEqual(findCommandFailureCode([{type: 'ObjectAlert', code: '920.1', area: 1}], 'disarm', 1), undefined, '9201 при disarm не считается');
    assertEqual(findCommandFailureCode([{type: 'ObjectAlert', code: '450.1', area: 1}], 'disarm', 1), 4501, '4501 при disarm');
    assertEqual(findCommandFailureCode([{type: 'ObjectAlert', code: '450.1', area: 1}], 'arm', 1), undefined, '4501 при arm не считается');
});

// ——————————————————————————————— guard повторов ————————

test('E12.13 Guard: in-flight, cooldown после unknown, rate limit', () => {
    const clock = makeFakeClock();
    const guard = new ControlCommandGuard(500, 3);
    const now = clock.now();

    assertEqual(guard.acquire('s', 'o', 1, now), 'ok', 'первый слот');
    assertEqual(guard.acquire('s', 'o', 1, now + 10), 'in-flight', 'повтор во время команды');

    guard.release('s', 'o', 1, 'confirmed', now + 20);
    assertEqual(guard.acquire('s', 'o', 1, now + 30), 'ok', 'после известного результата слот свободен');

    guard.release('s', 'o', 1, 'unknown', now + 40);
    assertEqual(guard.acquire('s', 'o', 1, now + 100), 'cooldown', 'повтор после unknown заблокирован');
    assertEqual(guard.acquire('s', 'o', 1, now + 600), 'ok', 'после cooldown снова доступно');

    // Лимит частоты: уже 3 команды в окне (2 успешных acquire выше + 1) — четвёртая отклоняется.
    assertEqual(guard.acquire('s', 'o', 2, now + 610), 'rate-limited', 'превышен лимит минут');
    // Другая сессия не затронута.
    assertEqual(guard.acquire('other', 'o', 1, now + 610), 'ok', 'лимит — на сессию');
});

// ———————————————————— executeGeoritmControlCommand ————————

const CONTROL_GATE = 'GEORITM_CONTROL_ENABLED';

/**
 * Контекст владеемого стационарного объекта с правами (E13). target —
 * «сырая» запись objects-tree-set/ в фактическом составе полей сервера
 * 2.27.0 (проба E12.3: 6 полей, imei/canArm/restricted ОТСУТСТВУЮТ) —
 * mock больше не маскирует отсутствие данных в реальной цепочке; imei и
 * canArm поставляются транспортом objects (objects/obj/).
 */
const makeContext = (overrides = {}) => ({
    basic: 'TESTBASIC',
    sessionId: 's1',
    userId: 'u1',
    objectId: '59',
    target: {id: 59, extId: 90059, name: 'Магазин «Белочка»', objType: '1'},
    permissions: {arm: true, disarm: true},
    ...overrides,
});

/** Запись objects/obj/ по умолчанию (документированный носитель canArm, imei). */
const DEFAULT_OBJ_RECORD = {id: 59, imei: '863591025852785', canArm: true, objType: '1', isFromIDP: true};

/**
 * Транспорт с управляемой картой state/ (последовательность ответов) и
 * журналом. Фиксирует все вызовы для проверок «write не вызывался».
 * objectRecord — ответ objects/obj/: массив записей (по умолчанию запись
 * целевого объекта), [] — объект не найден, 'error' — ошибка метода.
 */
const makeTransport = ({states = [{'1': 1}], history = [], objectRecord = [DEFAULT_OBJ_RECORD]} = {}) => {
    const calls = {arm: [], disarm: [], state: [], areas: [], history: [], objects: []};
    let stateIndex = 0;
    const transport = {
        objects: async (basic, objectId) => {
            calls.objects.push({basic, objectId});
            if (objectRecord === 'error') {
                throw new GeoritmApiError('http', 500, null, 'HTTP 500');
            }
            return objectRecord;
        },
        areas: async () => {
            calls.areas.push(1);
            return [{num: 1, name: 'Торговый зал'}, {num: 2, name: 'Склад'}];
        },
        partitionsState: async () => {
            calls.state.push(1);
            const state = states[Math.min(stateIndex, states.length - 1)];
            stateIndex += 1;
            return {state};
        },
        arm: async (basic, imei, area) => {
            calls.arm.push({basic, imei, area});
            return {success: 1};
        },
        disarm: async (basic, imei, area) => {
            calls.disarm.push({basic, imei, area});
            return {success: 1};
        },
        historyOnObject: async (basic, objectId, fromMs, toMs) => {
            calls.history.push([fromMs, toMs]);
            return history;
        },
    };
    return {calls, transport};
};

const writeCalls = (calls) => calls.arm.length + calls.disarm.length;

test('E12.14 Команда: выключенный gate — ни одного вызова транспорта (включая read)', async () => {
    const saved = process.env[CONTROL_GATE];
    delete process.env[CONTROL_GATE];
    try {
        const {calls, transport} = makeTransport({states: [{'1': 1}]});
        const error = await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext(), 'arm', 1, {transport}),
            'gate-disabled',
            'gate выключен',
        );
        assertEqual(calls.areas.length + calls.state.length + writeCalls(calls) + calls.history.length
                + calls.objects.length, 0,
            'ни read- (включая objects/obj/), ни write-вызовов при выключенном gate');
        assert(error.message.length > 0, 'есть человекочитаемое сообщение');
    } finally {
        if (saved === undefined) {
            delete process.env[CONTROL_GATE];
        } else {
            process.env[CONTROL_GATE] = saved;
        }
    }
});

test('E12.15 Команда: счастливый путь — confirmed по переходу состояния, IMEI только на сервере', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {calls, transport} = makeTransport({states: [{'1': 1}, {'1': 1}, {'1': 2}, {'1': 2}]});
    const guard = new ControlCommandGuard(500, 100);
    try {
        const result = await executeGeoritmControlCommand(makeContext(), 'arm', 1, {
            transport, guard, ...clock, windowMs: 2000, intervalMs: 50,
        });
        assertEqual(result.result, 'confirmed', 'результат');
        assert(result.message.includes('под охрану'), 'сообщение о взятии');
        assertEqual(calls.arm, [{basic: 'TESTBASIC', imei: '863591025852785', area: 1}], 'write-вызов с серверным IMEI');
        assert(calls.history.length >= 1, 'журнал опрашивался на отказ-коды');
        // Свежее состояние разделов в ответе: раздел 1 под охраной.
        const partition1 = result.partitions.find((partition) => partition.num === 1);
        assert(partition1 && partition1.guarded === true, 'обновлённое состояние раздела 1');
        assertEqual(partition1.arm, 'available', 'доступность после команды');
        // IMEI не попадает в DTO разделов.
        assert(!JSON.stringify(result.partitions).includes('863591025852785'), 'IMEI отсутствует в DTO');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E12.16 Команда: {success:1} без перехода → unknown; повтор заблокирован cooldown', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {calls, transport} = makeTransport({states: [{'1': 1}]});
    const guard = new ControlCommandGuard(10_000, 100);
    try {
        const result = await executeGeoritmControlCommand(makeContext(), 'arm', 1, {
            transport, guard, ...clock, windowMs: 200, intervalMs: 50,
        });
        assertEqual(result.result, 'unknown', 'результат');
        assertEqual(writeCalls(calls), 1, 'команда не повторялась автоматически');
        assert(result.message.includes('не получено'), 'честное сообщение о неизвестном результате');

        const error = await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext(), 'arm', 1, {
                transport, guard, ...clock, windowMs: 200, intervalMs: 50,
            }),
            'cooldown',
            'повторная команда при неизвестном результате',
        );
        assertEqual(writeCalls(calls), 1, 'повторная команда не отправлялась');
        assert(error.message.length > 0, 'сообщение о блокировке');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E12.17 Команда: отказ-код 4503 в журнале → rejected с текстом прибора', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {calls, transport} = makeTransport({
        states: [{'1': 1}],
        history: [{type: 'ObjectAlert', code: '450.3', area: 1, messageText: 'Ошибка взятия'}],
    });
    const guard = new ControlCommandGuard(500, 100);
    try {
        const result = await executeGeoritmControlCommand(makeContext(), 'arm', 1, {
            transport, guard, ...clock, windowMs: 1000, intervalMs: 50,
        });
        assertEqual(result.result, 'rejected', 'результат');
        assert(result.message.includes('взятия'), 'текст отказа взятия');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E12.18 Команда: явный HTTP-отказ GEORITM → rejected; сеть/тайм-аут → unknown', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const declining = makeTransport({states: [{'1': 1}]});
    declining.transport.arm = async () => {
        throw new GeoritmApiError('http', 500, 'Command was declined by the device', 'HTTP 500');
    };
    const guard = new ControlCommandGuard(500, 100);
    try {
        const declined = await executeGeoritmControlCommand(makeContext(), 'arm', 1, {
            transport: declining.transport, guard, ...clock, windowMs: 200, intervalMs: 50,
        });
        assertEqual(declined.result, 'rejected', 'HTTP-отказ — rejected');
        assert(declined.message.includes('declined'), 'текст сервера передан без деталей');

        const timingOut = makeTransport({states: [{'1': 1}]});
        timingOut.transport.arm = async () => {
            throw new GeoritmApiError('timeout', null, null, 'timeout');
        };
        const unknown = await executeGeoritmControlCommand(makeContext(), 'arm', 1, {
            transport: timingOut.transport, guard, ...clock, windowMs: 200, intervalMs: 50,
        });
        assertEqual(unknown.result, 'unknown', 'тайм-аут отправки — unknown');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E12.19 Команда: {success:0} — сервер не подтвердил приём → rejected', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {transport} = makeTransport({states: [{'1': 1}]});
    transport.arm = async () => ({success: 0});
    const guard = new ControlCommandGuard(500, 100);
    try {
        const result = await executeGeoritmControlCommand(makeContext(), 'arm', 1, {
            transport, guard, ...clock, windowMs: 200, intervalMs: 50,
        });
        assertEqual(result.result, 'rejected', 'результат');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E12.20 Команда: 401 GEORITM — исключение пробрасывается, сессия отзывается', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {calls, transport} = makeTransport({states: [{'1': 1}]});
    transport.areas = async () => {
        throw new GeoritmApiError('http', 401, 'Invalid username or wrong password', 'HTTP 401');
    };
    const guard = new ControlCommandGuard(500, 100);
    try {
        let thrown = null;
        try {
            await executeGeoritmControlCommand(makeContext(), 'arm', 1, {
                transport, guard, ...clock, windowMs: 200, intervalMs: 50,
            });
        } catch (error) {
            thrown = error;
        }
        assert(thrown instanceof GeoritmApiError && thrown.isUnauthorized, 'проброшен 401 GEORITM');
        assertEqual(writeCalls(calls), 0, 'write при 401 не выполнялся');
        // Сессия отозвана существующим механизмом session-store.
        const stored = await deleteSession('s1');
        assertEqual(stored, false, 'сессия s1 уже удалена из хранилища');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E12.21 Команда: отказы без write — чужой раздел, нет прав, canArm/restricted, IMEI, состояние, isFromIDP', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const guard = new ControlCommandGuard(500, 100);

    // Чужой раздел (нет среди obj-areas).
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}]});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext(), 'arm', 5, {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unknown-area', 'раздел 5 отсутствует',
        );
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    }
    // Нет права arm.
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}]});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({permissions: {arm: false, disarm: true}}), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'no-permission', 'нет права objects.arm',
        );
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    }
    // canArm отсутствует у объекта → unknown (консервативный запрет, E11).
    // objectRecord: [] — resolver-уровень: capability-данные заданы в target
    // вручную, обогащение obj/ отключено (реальная цепочка — в E13-сценариях).
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}], objectRecord: []});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({target: {id: 59, imei: '863591025852785', objType: '1'}}), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unknown-capability', 'canArm отсутствует',
        );
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    }
    // canArm=false → no-permission (явный запрет объекта; E12.2 F1 — до
    // исправления Boolean false распознавался как «доступно»).
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}], objectRecord: []});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({target: {id: 59, imei: '863591025852785', objType: '1', canArm: false}}), 'disarm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'no-permission', 'canArm=false',
        );
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    }
    // canArm=1 (число) — некорректный тип → unknown (приведения типов нет).
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}], objectRecord: []});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({target: {id: 59, imei: '863591025852785', objType: '1', canArm: 1}}), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unknown-capability', 'canArm=1 — некорректный тип',
        );
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    }
    // restricted=1 — явный запрет «пользователь × объект» (E12.2 F3),
    // в том числе при положительном canArm=true.
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}], objectRecord: []});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({target: {id: 59, imei: '863591025852785', objType: '1', canArm: true, restricted: 1}}), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'no-permission', 'restricted=1 при canArm=true',
        );
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    }
    // isFromIDP=true при отсутствующем canArm — не разрешает управление
    // (специального допуска для IDP-объектов нет, E12.2).
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}], objectRecord: []});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({target: {id: 59, imei: '863591025852785', objType: '1', isFromIDP: true}}), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unknown-capability', 'isFromIDP=true без canArm',
        );
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    }
    // Мобильный объект → unsupported.
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}]});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({target: {id: 59, imei: '863591025852785', objType: '0', canArm: true}}), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unsupported', 'мобильный объект',
        );
    }
    // IMEI не разрешён → unknown (resolver-уровень, обогащение отключено).
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}], objectRecord: []});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({target: {id: 59, objType: '1', canArm: true}}), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unknown-capability', 'IMEI отсутствует',
        );
        assertEqual(calls.state.length, 0, 'objects/state/ по отсутствующему IMEI не вызывался');
    }
    // Состояние раздела неизвестно (пустой ответ state/) → unknown.
    {
        const {calls, transport} = makeTransport({states: [{}]});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext(), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unknown-capability', 'состояние раздела неизвестно',
        );
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    }
    // Уже в целевом состоянии — команда не отправляется.
    {
        const {calls, transport} = makeTransport({states: [{'1': 2}]});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext(), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'already-in-state', 'раздел уже под охраной',
        );
        assertEqual(writeCalls(calls), 0, 'повторное взятие не отправлялось');
    }
    // Права неизвестны (сессия до E12) → unknown.
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}]});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({permissions: undefined}), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unknown-capability', 'права неизвестны',
        );
    }

    delete process.env[CONTROL_GATE];
});

test('E12.22 Capability: матрица canArm × restricted (F1/F3), обе операции', () => {
    const base = {
        controlEnabled: true,
        permissions: {arm: true, disarm: true},
        objType: '1',
        canArm: true,
        restricted: 0,
        imei: '863591025852785',
        guarded: false,
    };
    // Полное подтверждение — доступно для обеих операций.
    assertEqual(computeControlAvailability('arm', base), 'available', 'полное подтверждение (arm)');
    assertEqual(computeControlAvailability('disarm', base), 'available', 'полное подтверждение (disarm)');

    // — canArm (F1): Boolean по документации, строгие значения без приведения типов —
    assertEqual(computeControlAvailability('arm', {...base, canArm: true}), 'available', 'canArm=true — положительный признак');
    assertEqual(computeControlAvailability('disarm', {...base, canArm: true}), 'available', 'canArm=true (disarm)');
    assertEqual(computeControlAvailability('arm', {...base, canArm: false}), 'no-permission', 'canArm=false — явный запрет');
    assertEqual(computeControlAvailability('disarm', {...base, canArm: false}), 'no-permission', 'canArm=false — явный запрет (disarm)');
    assertEqual(computeControlAvailability('arm', {...base, canArm: undefined}), 'unknown', 'canArm отсутствует — запрет');
    assertEqual(computeControlAvailability('arm', {...base, canArm: null}), 'unknown', 'canArm=null — запрет');
    assertEqual(computeControlAvailability('arm', {...base, canArm: 'true'}), 'unknown', 'canArm="true" — некорректный тип, запрет');
    assertEqual(computeControlAvailability('arm', {...base, canArm: 1}), 'unknown', 'canArm=1 — некорректный тип, запрет');
    assertEqual(computeControlAvailability('arm', {...base, canArm: 0}), 'unknown', 'canArm=0 — некорректный тип, запрет');

    // — restricted (F3): Integer 1/0 по документации, поле условное —
    assertEqual(computeControlAvailability('arm', {...base, restricted: 0}), 'available', 'restricted=0 — ограничение не установлено');
    assertEqual(computeControlAvailability('arm', {...base, restricted: undefined}), 'available', 'restricted отсутствует (условное поле)');
    assertEqual(computeControlAvailability('arm', {...base, restricted: 1}), 'no-permission', 'restricted=1 — явный запрет');
    assertEqual(computeControlAvailability('disarm', {...base, restricted: 1}), 'no-permission', 'restricted=1 — явный запрет (disarm)');
    assertEqual(computeControlAvailability('arm', {...base, restricted: null}), 'unknown', 'restricted=null — некорректное значение');
    assertEqual(computeControlAvailability('arm', {...base, restricted: true}), 'unknown', 'restricted=true — некорректный тип');
    assertEqual(computeControlAvailability('arm', {...base, restricted: '1'}), 'unknown', 'restricted="1" — некорректный тип');
    assertEqual(computeControlAvailability('arm', {...base, restricted: 2}), 'unknown', 'restricted=2 — вне документированного словаря');

    // — комбинации (требование задачи E12.2) —
    assertEqual(computeControlAvailability('arm', {...base, canArm: true, restricted: 1}), 'no-permission',
        'canArm=true + restricted=1 — положительный canArm не перекрывает запрет');
    assertEqual(computeControlAvailability('arm', {...base, canArm: false, restricted: 0}), 'no-permission',
        'canArm=false + restricted=0 — запрет объекта действует');
    // canArm отсутствует, но allowedActions содержит arm/disarm (права есть) — запрет.
    assertEqual(computeControlAvailability('arm', {...base, canArm: undefined, restricted: undefined}), 'unknown',
        'canArm отсутствует + права arm/disarm есть — запрет');
    assertEqual(computeControlAvailability('arm', {...base, canArm: undefined, guarded: null}), 'unknown',
        'canArm отсутствует + неизвестное состояние — запрет');
    assertEqual(computeControlAvailability('arm', {...base, guarded: null}), 'unknown',
        'canArm=true + неизвестное состояние раздела — запрет');
    assertEqual(computeControlAvailability('disarm', {...base, guarded: null}), 'unknown',
        'canArm=true + неизвестное состояние раздела — запрет (disarm)');
    assertEqual(computeControlAvailability('arm', {...base, imei: undefined}), 'unknown',
        'canArm=true + IMEI не разрешён — запрет');
    assertEqual(computeControlAvailability('disarm', {...base, imei: ''}), 'unknown',
        'canArm=true + пустой IMEI — запрет (disarm)');

    // — прочие независимые проверки сохраняются —
    assertEqual(computeControlAvailability('arm', {...base, controlEnabled: false}), 'disabled', 'gate off');
    assertEqual(computeControlAvailability('arm', {...base, objType: '0'}), 'unsupported', 'мобильный');
    assertEqual(computeControlAvailability('arm', {...base, permissions: {arm: false, disarm: true}}), 'no-permission', 'нет права');
    assertEqual(computeControlAvailability('arm', {...base, permissions: undefined}), 'unknown', 'права неизвестны');
    assertEqual(computeControlAvailability('disarm', {...base, guarded: true}), 'available', 'disarm на взятии');
});

// ————————— E13: обогащение capability-контекста из objects/obj/ ————————

test('E13.1 Обогащение: canArm и IMEI приходят из objects/obj/ — реальная цепочка без маскировки', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {calls, transport} = makeTransport({states: [{'1': 1}, {'1': 1}, {'1': 2}, {'1': 2}]});
    const guard = new ControlCommandGuard(500, 100);
    try {
        // makeContext() — target без imei/canArm (фактический tree-set E12.3).
        const result = await executeGeoritmControlCommand(makeContext(), 'arm', 1, {
            transport, guard, ...clock, windowMs: 2000, intervalMs: 50,
        });
        assertEqual(result.result, 'confirmed', 'команда исполнена');
        assertEqual(calls.objects, [{basic: 'TESTBASIC', objectId: 59}], 'objects/obj/ вызван по id владеемого объекта');
        assertEqual(calls.arm, [{basic: 'TESTBASIC', imei: '863591025852785', area: 1}], 'IMEI взят из objects/obj/ (в tree-set его нет)');
        const partition1 = result.partitions.find((partition) => partition.num === 1);
        assertEqual(partition1?.arm, 'available', 'DTO после команды доступен');
        assert(!JSON.stringify(result.partitions).includes('863591025852785'), 'IMEI отсутствует в DTO');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E13.2 Обогащение: canArm=false из objects/obj/ → no-permission без write', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {calls, transport} = makeTransport({
        states: [{'1': 1}],
        objectRecord: [{id: 59, imei: '863591025852785', canArm: false}],
    });
    const guard = new ControlCommandGuard(500, 100);
    try {
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext(), 'arm', 1, {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'no-permission', 'canArm=false из obj/',
        );
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E13.3 Обогащение: canArm отсутствует/null/некорректного типа в objects/obj/ → unknown-capability', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const guard = new ControlCommandGuard(500, 100);
    const cases = [
        [{id: 59, imei: '863591025852785'}, 'canArm отсутствует в obj/'],
        [{id: 59, imei: '863591025852785', canArm: null}, 'canArm=null в obj/'],
        [{id: 59, imei: '863591025852785', canArm: 1}, 'canArm=1 (число) в obj/'],
        [{id: 59, imei: '863591025852785', canArm: 'true'}, 'canArm="true" (строка) в obj/'],
    ];
    try {
        for (const [record, title] of cases) {
            const {calls, transport} = makeTransport({states: [{'1': 1}], objectRecord: [record]});
            await assertThrowsControl(
                () => executeGeoritmControlCommand(makeContext(), 'arm', 1, {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
                'unknown-capability', title,
            );
            assertEqual(writeCalls(calls), 0, `${title}: write не выполнялся`);
        }
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E13.4 Обогащение: IMEI отсутствует в objects/obj/ → unknown-capability, objects/state/ не вызывался', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {calls, transport} = makeTransport({
        states: [{'1': 1}],
        objectRecord: [{id: 59, canArm: true}],
    });
    const guard = new ControlCommandGuard(500, 100);
    try {
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext(), 'arm', 1, {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unknown-capability', 'IMEI отсутствует в obj/',
        );
        assertEqual(calls.state.length, 0, 'objects/state/ по отсутствующему IMEI не вызывался');
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E13.5 Обогащение: ошибка objects/obj/ → управление запрещено (unknown), данные не выдумываются', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {calls, transport} = makeTransport({states: [{'1': 1}], objectRecord: 'error'});
    const guard = new ControlCommandGuard(500, 100);
    try {
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext(), 'arm', 1, {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unknown-capability', 'ошибка obj/ — запрет',
        );
        assertEqual(calls.state.length, 0, 'objects/state/ без IMEI не вызывался');
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E13.6 Обогащение: запись другого объекта в objects/obj/ отбрасывается целиком', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {calls, transport} = makeTransport({
        states: [{'1': 1}],
        objectRecord: [{id: 60, imei: '999999999999999', canArm: true}],
    });
    const guard = new ControlCommandGuard(500, 100);
    try {
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext(), 'arm', 1, {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unknown-capability', 'данные чужого объекта не используются',
        );
        assertEqual(calls.state.length, 0, 'IMEI другого объекта не разрешался');
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E13.7 Обогащение: из нескольких записей objects/obj/ используется строго совпавшая по id', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {calls, transport} = makeTransport({
        states: [{'1': 1}, {'1': 1}, {'1': 2}, {'1': 2}],
        objectRecord: [
            {id: 60, imei: '999999999999999', canArm: true},
            {id: 59, imei: '863591025852785', canArm: true},
        ],
    });
    const guard = new ControlCommandGuard(500, 100);
    try {
        const result = await executeGeoritmControlCommand(makeContext(), 'arm', 1, {
            transport, guard, ...clock, windowMs: 2000, intervalMs: 50,
        });
        assertEqual(result.result, 'confirmed', 'команда исполнена');
        assertEqual(calls.arm, [{basic: 'TESTBASIC', imei: '863591025852785', area: 1}],
            'команда с IMEI совпавшей записи, не другой');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E13.8 Обогащение: restricted=1 из objects/obj/ → no-permission при canArm=true', async () => {
    process.env[CONTROL_GATE] = 'true';
    const clock = makeFakeClock();
    const {calls, transport} = makeTransport({
        states: [{'1': 1}],
        objectRecord: [{id: 59, imei: '863591025852785', canArm: true, restricted: 1}],
    });
    const guard = new ControlCommandGuard(500, 100);
    try {
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext(), 'arm', 1, {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'no-permission', 'restricted=1 из obj/',
        );
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

test('E13.9 DTO-путь: getGeoritmControlState обогащает контекст objects/obj/ и вычисляет доступность', async () => {
    process.env[CONTROL_GATE] = 'true';
    const mock = makeFetchMock();
    mock.install(({url}) => url.includes('obj/json')
        ? {status: 200, body: [{id: 59, imei: '863591025852785', canArm: true, objType: '1'}]}
        : url.includes('obj-areas')
            ? {status: 200, body: [{num: 1, name: 'Торговый зал'}]}
            : {status: 200, body: {state: {'1': 1}}});
    try {
        // makeContext() — target без imei/canArm; без обогащения DTO был бы unknown.
        const state = await getGeoritmControlState(makeContext());
        assertEqual(state.enabled, true, 'управление включено');
        assertEqual(state.availability, 'available', 'состояние известно');
        const partition1 = state.partitions.find((partition) => partition.num === 1);
        assertEqual(partition1?.guarded, false, 'раздел снят');
        assertEqual(partition1?.arm, 'available', 'arm доступен (canArm=true из obj/)');
        assertEqual(partition1?.disarm, 'available', 'disarm доступен');
        assert(!JSON.stringify(state).includes('863591025852785'), 'IMEI отсутствует в DTO');
        assertEqual(mock.calls[0].url, `${BASE}/restapi/objects/obj/json`, 'первый вызов — objects/obj/');
        assertEqual(mock.calls[0].body, {objectId: [59]}, 'objects/obj/ вызван по id владеемого объекта');
    } finally {
        mock.restore();
        delete process.env[CONTROL_GATE];
    }
});

// ——————————————————————————————— demo-аналог ————————

test('E12.23 Demo: gate off — управление скрыто, команда запрещена', () => {
    const saved = process.env[CONTROL_GATE];
    delete process.env[CONTROL_GATE];
    try {
        const state = getDemoControlState('demo-user-belochka', 'demo-object-magazin-belochka');
        assertEqual(state, {enabled: false, availability: 'unknown', partitions: []}, 'enabled=false без разделов');
        let error = null;
        try {
            executeDemoControl('demo-user-belochka', 'demo-object-magazin-belochka', 'disarm', 2);
        } catch (caught) {
            error = caught;
        }
        assert(error instanceof ControlError && error.reason === 'gate-disabled', 'demo не обходит gate');
    } finally {
        if (saved === undefined) {
            delete process.env[CONTROL_GATE];
        } else {
            process.env[CONTROL_GATE] = saved;
        }
    }
});

test('E12.24 Demo: состояния разделов, ownership, команда и повтор', () => {
    process.env[CONTROL_GATE] = 'true';
    try {
        const state = getDemoControlState('demo-user-belochka', 'demo-object-magazin-belochka');
        assert(state?.enabled, 'gate on: enabled');
        const byNum = new Map(state.partitions.map((partition) => [partition.num, partition]));
        assertEqual(byNum.get(1).guarded, false, 'раздел 1 снят');
        assertEqual(byNum.get(2).guarded, true, 'раздел 2 под охраной');
        assertEqual(byNum.get(3).guarded, null, 'раздел 3 в неисправности — состояние неизвестно');
        assertEqual(byNum.get(3).arm, 'unknown', 'управление разделом 3 скрыто');

        // Чужой объект неотличим от несуществующего.
        assertEqual(getDemoControlState('demo-user-romashka', 'demo-object-magazin-belochka'), null, 'чужой объект → null');

        // Снятие взятого раздела 2 → confirmed, состояние обновилось.
        const result = executeDemoControl('demo-user-belochka', 'demo-object-magazin-belochka', 'disarm', 2);
        assertEqual(result.result, 'confirmed', 'результат демо-команды');
        const after = new Map(result.partitions.map((partition) => [partition.num, partition]));
        assertEqual(after.get(2).guarded, false, 'раздел 2 снят');

        // Повторное снятие уже снятого — отказ без команды.
        let error = null;
        try {
            executeDemoControl('demo-user-belochka', 'demo-object-magazin-belochka', 'disarm', 2);
        } catch (caught) {
            error = caught;
        }
        assert(error instanceof ControlError && error.reason === 'already-in-state', 'повтор снятия отклонён');

        // Возврат в исходное состояние (раздел 2 снова под охраной).
        const back = executeDemoControl('demo-user-belochka', 'demo-object-magazin-belochka', 'arm', 2);
        assertEqual(back.result, 'confirmed', 'возврат под охрану');

        // Чужой пользователь командой не владеет.
        let foreign = null;
        try {
            executeDemoControl('demo-user-romashka', 'demo-object-magazin-belochka', 'arm', 1);
        } catch (caught) {
            foreign = caught;
        }
        assert(foreign instanceof ControlError && foreign.reason === 'not-owned', 'чужой объект — not-owned');
    } finally {
        delete process.env[CONTROL_GATE];
    }
});

// ———————————————————— E16: capability-driven видимость ————————

test('E16.1 applyControlGateToState: gate off помечает канал команд, capability-факты сохраняются', () => {
    const state = {
        enabled: true,
        availability: 'available',
        partitions: [
            {num: 1, name: 'Торговый зал', guarded: false, arm: 'available', disarm: 'available'},
            {num: 2, name: 'Склад', guarded: null, arm: 'unknown', disarm: 'unknown'},
        ],
    };
    const gated = applyControlGateToState(state, false);
    assertEqual(gated.enabled, false, 'канал команд помечен выключенным (Safe Preview)');
    assertEqual(gated.partitions, state.partitions,
        'capability-оценка разделов сохранена: видимость управления определяется данными учётной записи');
    assertEqual(applyControlGateToState(state, true), state, 'gate on — DTO без изменений');
});

test('E16.2 DTO: два объекта одной учётной записи с разными правами — capability вычисляется per-object', async () => {
    process.env[CONTROL_GATE] = 'true';
    const mock = makeFetchMock();
    // Один пользователь, два объекта: у 59 canArm=true (аналог учётной записи
    // №2, объект 64), у 60 canArm отсутствует (аналог учётной записи №1,
    // объект 59). Ответ obj/ подбирается по запрошенному id — как на сервере.
    mock.install(({url, body}) => url.includes('obj/json')
        ? {
            status: 200,
            body: [body.objectId[0] === 59
                ? {id: 59, imei: '863591025852785', canArm: true, objType: '1'}
                : {id: 60, imei: '863591025852786', objType: '1'}],
        }
        : url.includes('obj-areas')
            ? {status: 200, body: [{num: 1, name: 'Раздел'}]}
            : {status: 200, body: {state: {'1': 1}}});
    try {
        const allowed = await getGeoritmControlState(makeContext());
        const partition59 = allowed.partitions.find((partition) => partition.num === 1);
        assertEqual(partition59.arm, 'available', 'объект 59 (canArm=true): управление подтверждено');

        const denied = await getGeoritmControlState(makeContext({
            objectId: '60',
            target: {id: 60, extId: 90060, name: 'Объект без canArm', objType: '1'},
        }));
        const partition60 = denied.partitions.find((partition) => partition.num === 1);
        assertEqual(partition60.arm, 'unknown', 'объект 60 (canArm отсутствует): безопасный запрет');
        assert(partition60.arm !== partition59.arm,
            'разные объекты одной учётной записи получают разные вердикты — capability не переносится');
    } finally {
        mock.restore();
        delete process.env[CONTROL_GATE];
    }
});

test('E16.3 DTO при выключенном gate: реальная capability-оценка + пометка канала команд', async () => {
    // getGeoritmControlState сам gate не проверяет (решение — в диспетчере
    // источника); связка «оценка на реальных данных + gate off» повторяет
    // вызов диспетчера getObjectControlState для GEORITM (E16).
    const savedGate = process.env[CONTROL_GATE];
    delete process.env[CONTROL_GATE];
    const mock = makeFetchMock();
    mock.install(({url}) => url.includes('obj/json')
        ? {status: 200, body: [{id: 59, imei: '863591025852785', canArm: true, objType: '1'}]}
        : url.includes('obj-areas')
            ? {status: 200, body: [{num: 1, name: 'Торговый зал'}]}
            : {status: 200, body: {state: {'1': 1}}});
    try {
        const state = await getGeoritmControlState(makeContext());
        const gated = applyControlGateToState(state, parseControlGate(process.env[CONTROL_GATE]));
        assertEqual(gated.enabled, false, 'gate выключен — канал команд помечен');
        assertEqual(gated.availability, 'available', 'capability-данные получены и при выключенном gate');
        const partition1 = gated.partitions.find((partition) => partition.num === 1);
        assertEqual(partition1.arm, 'available', 'подтверждённый раздел остаётся подтверждённым');
        assert(!JSON.stringify(gated).includes('863591025852785'), 'IMEI отсутствует в DTO');
    } finally {
        mock.restore();
        if (savedGate === undefined) {
            delete process.env[CONTROL_GATE];
        } else {
            process.env[CONTROL_GATE] = savedGate;
        }
    }
});

// ——————————————————————————————————————————— прогон ————————

let failed = 0;
for (const {title, fn} of results) {
    try {
        await fn();
        console.log(`[OK]   ${title}`);
    } catch (error) {
        failed += 1;
        console.log(`[FAIL] ${title}`);
        console.log(`       ${error?.message ?? error}`);
    }
}

console.log('');
console.log(failed === 0
    ? 'Все смоук-сценарии управления пройдены. Реальные write-вызовы не выполнялись.'
    : `Провалено сценариев: ${failed}.`);
process.exitCode = failed === 0 ? 0 : 1;
