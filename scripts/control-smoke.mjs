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
 *      IMEI/состояния; уже в целевом состоянии; чужой раздел; 401;
 *   6) demo-аналог: тот же gate, ownership, трёхзначность, оверлей.
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
import {executeGeoritmControlCommand, computeControlAvailability} from '../lib/account/georitm-control.ts';
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

/** Контекст владеемого стационарного объекта с правами и canArm=1. */
const makeContext = (overrides = {}) => ({
    basic: 'TESTBASIC',
    sessionId: 's1',
    userId: 'u1',
    objectId: '59',
    target: {id: 59, imei: '863591025852785', objType: '1', canArm: 1},
    permissions: {arm: true, disarm: true},
    ...overrides,
});

/**
 * Транспорт с управляемой картой state/ (последовательность ответов) и
 * журналом. Фиксирует все вызовы для проверок «write не вызывался».
 */
const makeTransport = ({states = [{'1': 1}], history = []} = {}) => {
    const calls = {arm: [], disarm: [], state: [], areas: [], history: []};
    let stateIndex = 0;
    const transport = {
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
        assertEqual(calls.areas.length + calls.state.length + writeCalls(calls) + calls.history.length, 0,
            'ни read-, ни write-вызовов при выключенном gate');
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

test('E12.21 Команда: отказы без write — чужой раздел, нет прав, canArm, IMEI, состояние', async () => {
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
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}]});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({target: {id: 59, imei: '863591025852785', objType: '1'}}), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unknown-capability', 'canArm отсутствует',
        );
        assertEqual(writeCalls(calls), 0, 'write не выполнялся');
    }
    // canArm=0 → no-permission.
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}]});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({target: {id: 59, imei: '863591025852785', objType: '1', canArm: 0}}), 'disarm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'no-permission', 'canArm=0',
        );
    }
    // Мобильный объект → unsupported.
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}]});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({target: {id: 59, imei: '863591025852785', objType: '0', canArm: 1}}), 'arm', 1,
                {transport, guard, ...clock, windowMs: 200, intervalMs: 50}),
            'unsupported', 'мобильный объект',
        );
    }
    // IMEI не разрешён → unknown.
    {
        const {calls, transport} = makeTransport({states: [{'1': 1}]});
        await assertThrowsControl(
            () => executeGeoritmControlCommand(makeContext({target: {id: 59, objType: '1', canArm: 1}}), 'arm', 1,
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

test('E12.22 Capability: матрица вычисления доступности', () => {
    const base = {
        controlEnabled: true,
        permissions: {arm: true, disarm: true},
        objType: '1',
        canArm: 1,
        imei: '863591025852785',
        guarded: false,
    };
    assertEqual(computeControlAvailability('arm', base), 'available', 'полное подтверждение');
    assertEqual(computeControlAvailability('arm', {...base, controlEnabled: false}), 'disabled', 'gate off');
    assertEqual(computeControlAvailability('arm', {...base, objType: '0'}), 'unsupported', 'мобильный');
    assertEqual(computeControlAvailability('arm', {...base, permissions: {arm: false, disarm: true}}), 'no-permission', 'нет права');
    assertEqual(computeControlAvailability('arm', {...base, canArm: 0}), 'no-permission', 'canArm=0');
    assertEqual(computeControlAvailability('arm', {...base, canArm: undefined}), 'unknown', 'canArm отсутствует');
    assertEqual(computeControlAvailability('arm', {...base, permissions: undefined}), 'unknown', 'права неизвестны');
    assertEqual(computeControlAvailability('arm', {...base, imei: undefined}), 'unknown', 'нет IMEI');
    assertEqual(computeControlAvailability('arm', {...base, guarded: null}), 'unknown', 'состояние неизвестно');
    assertEqual(computeControlAvailability('disarm', {...base, guarded: true}), 'available', 'disarm на взятии');
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
