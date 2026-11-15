import {
    ControlCommandGuard,
    observeCommandOutcome,
    targetStateValue,
    type CommandObservationDeps,
    type JournalFailureRecord,
} from './control-engine.ts';
import {isGeoritmControlEnabled} from './control-gate.ts';
import {ControlError} from './contracts.ts';
import type {
    ControlAction,
    ControlAvailability,
    ControlOperationResult,
    ControlResult,
    ObjectControlState,
    PartitionControlState,
} from './contracts';
import type {SessionControlPermissions} from './session-store';
import {deleteSession} from './session-store.ts';
import {
    GeoritmApiError,
    georitmArm,
    georitmDisarm,
    georitmHistoryOnObject,
    georitmObjectAreas,
    georitmObjects,
    georitmPartitionsState,
    type GeoritmArea,
    type GeoritmCommandResponse,
    type GeoritmHistoryRecord,
    type GeoritmObjectSummary,
} from '../georitm/api-client.ts';

/**
 * Серверный модуль управления охраной GEORITM (E12).
 *
 * Только серверный код. Не импортирует Next.js (cookies/env-страницы) —
 * контекст сессии и владение объектом поставляет georitm-source
 * (resolveGeoritmControlContext), поэтому вся логика команды проверяется
 * smoke-сценариями на инъектированном транспорте без сети.
 *
 * Обязательные шаги перед любым write-вызовом GEORITM (порядок фиксирован):
 *  1) feature gate GEORITM_CONTROL_ENABLED (первая строка — при выключенном
 *     gate метод не выполняет НИ ОДНОГО вызова, включая read);
 *  2) защита от повторов и лимит частоты (ControlCommandGuard);
 *  3) владение объектом — до модуля (resolveGeoritmControlContext: объект
 *     из выдачи objects-tree-set/ пользователя);
 *  4) обогащение capability-контекста read-вызовом objects/obj/ (E13) по
 *     уже подтверждённому id: tree-set не содержит ни canArm, ни imei
 *     (документация и проба E12.3); запись другого id отбрасывается,
 *     ошибка obj/ оставляет объект без обогащения (запрет, не разрешение);
 *  5) серверное разрешение раздела (objects/obj-areas/) и состояния
 *     (objects/state/ по IMEI); IMEI резолвится только здесь и никогда
 *     не принимается от браузера и не возвращается в DTO;
 *  6) доступность управления: права пользователя (проекция allowedActions
 *     сессии) × canArm объекта (Boolean по документации; только строгое
 *     `true` — положительный признак, `false` — явный запрет, отсутствие —
 *     'unknown', консервативный запрет, E11 3.1/E12.2 F1) × restricted
 *     объекта (ограничение доступа «пользователь × объект», Integer 1/0:
 *     1 — явный запрет, E12.2 F3) × известность состояния.
 *
 * Результат команды — честная трёхзначность (E11 4.2): {success: 1} означает
 * только приём команды сервером; 'confirmed' — исключительно по переходу
 * objects/state/ в целевое состояние; 'rejected' — по отказ-кодам журнала
 * 4501/4503/9201 или явному отказу сервера; 'unknown' — иначе. Повторная
 * команда автоматически не отправляется никогда.
 */

/** Раздел не найден в карте objects/state/ или значение вне словаря 1/2. */
const partitionGuarded = (value: number | undefined): boolean | null =>
    value === 2 ? true : value === 1 ? false : null;

/** Транспорт управления — точечные вызовы api-client (инъекция для smoke). */
export interface GeoritmControlTransport {
    /** objects/obj/ — обогащение capability-контекста (imei, canArm, restricted), E13. */
    objects: (basic: string, objectId: number) => Promise<GeoritmObjectSummary[]>;
    areas: (basic: string, objectId: number) => Promise<GeoritmArea[]>;
    partitionsState: (basic: string, imei: string) => Promise<{state?: Record<string, number>}>;
    arm: (basic: string, imei: string, area: number) => Promise<GeoritmCommandResponse>;
    disarm: (basic: string, imei: string, area: number) => Promise<GeoritmCommandResponse>;
    historyOnObject: (basic: string, objectId: number, fromMs: number, toMs: number) => Promise<GeoritmHistoryRecord[]>;
}

export const defaultGeoritmControlTransport: GeoritmControlTransport = {
    objects: (basic, objectId) => georitmObjects(basic, [objectId]),
    areas: georitmObjectAreas,
    partitionsState: georitmPartitionsState,
    arm: georitmArm,
    disarm: georitmDisarm,
    historyOnObject: georitmHistoryOnObject,
};

/** Контекст операции (формирует georitm-source после проверки владения). */
export interface GeoritmControlContext {
    basic: string;
    sessionId: string;
    userId: string;
    /** Идентификатор объекта кабинета (строка числового id GEORITM). */
    objectId: string;
    /** Владеемый объект из выдачи objects-tree-set/, обогащённый данными
     *  objects/obj/ (imei, canArm, restricted — E13); обогащение выполняет
     *  georitm-control перед вычислением доступности и командой. */
    target: GeoritmObjectSummary;
    /** Проекция прав сессии; undefined — права неизвестны (сессия до E12). */
    permissions: SessionControlPermissions | undefined;
}

/**
 * Вычисление доступности действия управления. Чистая функция — единый
 * источник вердикта для DTO разделов и для решения о команде (маршрут
 * повторно вызывает её перед отправкой, поэтому состояние DTO и решение
 * не расходятся).
 *
 * Правила — E11 3.1 (консервативные) с исправлениями E12.2:
 *  - право пользователя: строго `false` — запрет, отсутствие проекции —
 *    «неизвестно»;
 *  - `canArm` — Boolean по документации GEORITM: только строгое `true` —
 *    положительный признак (E12.2 F1); строгое `false` — явный запрет на
 *    уровне объекта; `undefined`/`null` и любые значения других типов
 *    (`1`, `0`, `"true"`) — «неизвестно», управление запрещено. Приведения
 *    типов нет; `canArm === true` само по себе не разрешает управление —
 *    остальные проверки продолжают действовать;
 *  - `restricted` — ограничение доступа «пользователь × объект», Integer
 *    по документации (1 — ограничен, 0 — не ограничен; поле условное —
 *    «если установлен код ограниченной роли пользователя»): строгое `1` —
 *    явный запрет (E12.2 F3); строгое `0` или отсутствие поля — ограничение
 *    не установлено; любое другое присутствующее значение — «неизвестно».
 *    Не приравнивается к `canArm` — это отдельное измерение capability;
 *    точное взаимодействие с objects/arm/ — открытый вопрос поставщику (P7);
 *  - управление показывается только при одновременно подтверждённых праве,
 *    canArm (строго `true`), отсутствии ограничения restricted, разрешимом
 *    IMEI и известном состоянии раздела; любое «неизвестно» запрещает.
 */
export const computeControlAvailability = (
    action: ControlAction,
    inputs: {
        controlEnabled: boolean;
        permissions: SessionControlPermissions | undefined;
        objType: string | undefined;
        /** Boolean по документации; строгое сравнение, без приведения типов. */
        canArm: boolean | null | undefined;
        /** Integer 1/0 по документации; строгое сравнение, без приведения типов. */
        restricted: number | null | undefined;
        imei: string | undefined;
        /** Известность текущего состояния охраны раздела. */
        guarded: boolean | null;
    },
): ControlAvailability => {
    if (!inputs.controlEnabled) {
        return 'disabled';
    }
    // Управление документировано для стационарных объектов (E11 2.2);
    // мобильные ('0') — вне контракта метода.
    if (inputs.objType === '0') {
        return 'unsupported';
    }
    const hasPermission = inputs.permissions === undefined
        ? undefined
        : action === 'arm' ? inputs.permissions.arm : inputs.permissions.disarm;
    // Явные запреты: право пользователя, canArm: false (запрет на уровне
    // объекта), restricted: 1 (ограничение доступа «пользователь × объект»).
    if (hasPermission === false || inputs.canArm === false || inputs.restricted === 1) {
        return 'no-permission';
    }
    // Права неизвестны (старая сессия) — консервативное «неизвестно».
    if (hasPermission === undefined) {
        return 'unknown';
    }
    // canArm: только строгое `true` — положительный признак. Отсутствующее
    // поле и любой некорректный тип (`null`, `1`, `0`, `"true"`) — запрет.
    if (inputs.canArm !== true) {
        return 'unknown';
    }
    // restricted: поле условное — отсутствие означает, что кода ограниченной
    // роли нет; строгое `0` — ограничение не установлено. Прочие значения —
    // контракт нарушен, «неизвестно».
    if (inputs.restricted !== undefined && inputs.restricted !== 0) {
        return 'unknown';
    }
    if (typeof inputs.imei !== 'string' || inputs.imei.trim().length === 0) {
        return 'unknown';
    }
    // Состояние раздела неизвестно — подтверждение результата невозможно.
    if (inputs.guarded === null) {
        return 'unknown';
    }
    return 'available';
};

/** Разрешённый IMEI объекта (только сервер; в DTO не переносится). */
const resolveImei = (target: GeoritmObjectSummary): string | undefined => {
    const imei = target.imei;
    return typeof imei === 'string' && imei.trim().length > 0 ? imei.trim() : undefined;
};

/**
 * Обогащение capability-контекста из objects/obj/ (E13).
 *
 * objects-tree-set/ — источник ctx.target — не содержит ни canArm, ни imei
 * (по документации canArm — только в objects/obj/ и obj-details/; проба
 * E12.3 подтвердила: tree-set возвращает 6 полей, imei/canArm/restricted
 * отсутствуют). Без обогащения реальный объект всегда получал 'unknown' —
 * блокер доступности, не безопасности (запрет консервативен).
 *
 * Безопасность:
 *  - запрос выполняется ТОЛЬКО по id объекта, владение которому уже
 *    подтверждено (ctx.target из выдачи tree-set текущего пользователя);
 *    данные браузера не используются;
 *  - из ответа используется запись со СТРОГО совпадающим id (числовое
 *    равенство); запись другого объекта отбрасывается целиком — данные
 *    чужого объекта не применяются ни при каком расхождении;
 *  - переносятся только capability-поля (imei, canArm, restricted) и
 *    только если поле присутствует в ответе; отсутствие поля в obj/ не
 *    стирает значение цели (в реальной цепочке tree-set этих полей не
 *    содержит, поэтому fallback не даёт разрешения);
 *  - ошибка obj/ (кроме 401) не выбрасывается: цель остаётся без
 *    обогащения → canArm/imei дают 'unknown' → управление запрещено;
 *    данные не выдумываются;
 *  - 401 пробрасывается — сессию отзывает общий обработчик вызывающей
 *    функции.
 */
const enrichControlTarget = async (
    ctx: GeoritmControlContext,
    transport: GeoritmControlTransport,
): Promise<GeoritmControlContext> => {
    let record: GeoritmObjectSummary | undefined;
    try {
        const objects = await transport.objects(ctx.basic, ctx.target.id);
        record = Array.isArray(objects)
            ? objects.find((candidate) => candidate && candidate.id === ctx.target.id)
            : undefined;
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            throw error;
        }
        // objects/obj/ недоступен — управление запрещено консервативно:
        // объект остаётся без обогащения, canArm/imei дают 'unknown'.
        return ctx;
    }
    if (!record) {
        // Записи целевого объекта в ответе нет (или ответ другого объекта) —
        // без обогащения, управление остаётся запрещённым.
        return ctx;
    }
    return {
        ...ctx,
        target: {
            ...ctx.target,
            imei: record.imei !== undefined ? record.imei : ctx.target.imei,
            canArm: 'canArm' in record ? record.canArm : ctx.target.canArm,
            restricted: 'restricted' in record ? record.restricted : ctx.target.restricted,
        },
    };
};

/** Имя раздела для DTO: без имени — «Раздел N» (как в списке разделов кабинета). */
const partitionName = (area: GeoritmArea): string => {
    const num = typeof area.num === 'number' ? area.num : undefined;
    if (typeof area.name === 'string' && area.name.trim().length > 0) {
        return area.name.trim();
    }
    return `Раздел ${num ?? '?'}`;
};

/** Снимок разделов и состояний охраны (read-only). */
interface ControlSnapshot {
    areas: GeoritmArea[];
    stateMap: Record<string, number> | undefined;
    stateKnown: boolean;
    imei: string | undefined;
}

const fetchControlSnapshot = async (
    ctx: GeoritmControlContext,
    transport: GeoritmControlTransport,
): Promise<ControlSnapshot> => {
    const imei = resolveImei(ctx.target);
    const areas = await transport.areas(ctx.basic, ctx.target.id);

    let stateMap: Record<string, number> | undefined;
    let stateKnown = false;
    if (imei) {
        try {
            const response = await transport.partitionsState(ctx.basic, imei);
            if (response && typeof response === 'object' && response.state && typeof response.state === 'object') {
                stateMap = response.state;
                // Карта состояний получена; отсутствие раздела В КАРТЕ —
                // отдельное значение (partitionGuarded → null), не «неизвестно всё».
                stateKnown = true;
            } else {
                // Ответ без карты состояний — состояние неизвестно, не «всё снято».
            }
        } catch (error) {
            if (error instanceof GeoritmApiError && error.isUnauthorized) {
                throw error;
            }
            // objects/state/ недоступен (включая 500 на «неизвестный» IMEI,
            // E11 6.2.4) — управление запрещено, состояние не выдумывается.
        }
    }

    return {areas, stateMap, stateKnown, imei};
};

const toPartitions = (
    ctx: GeoritmControlContext,
    snapshot: ControlSnapshot,
): PartitionControlState[] => {
    const partitions: PartitionControlState[] = [];
    for (const area of snapshot.areas) {
        if (!area || typeof area.num !== 'number' || !Number.isInteger(area.num) || area.num < 0) {
            continue;
        }
        const raw = snapshot.stateMap ? snapshot.stateMap[String(area.num)] : undefined;
        const guarded = snapshot.stateKnown ? partitionGuarded(raw) : null;
        const inputs = {
            controlEnabled: true,
            permissions: ctx.permissions,
            objType: ctx.target.objType,
            canArm: ctx.target.canArm,
            restricted: ctx.target.restricted,
            imei: snapshot.imei,
            guarded,
        };
        partitions.push({
            num: area.num,
            name: partitionName(area),
            guarded,
            arm: computeControlAvailability('arm', inputs),
            disarm: computeControlAvailability('disarm', inputs),
        });
    }
    return partitions;
};

/**
 * DTO состояния управления с учётом feature gate (E16).
 *
 * Capability-факты в DTO вычислены на реальных данных источника независимо
 * от gate: видимость управления определяется возможностями конкретной
 * учётной записи, а не глобальным флагом. Gate помечает только канал команд
 * (enabled: false): UI показывает разделы в режиме Safe Preview
 * (демо-подтверждение без команд) либо скрывает секцию целиком, если
 * подтверждённых разделов нет. Чистая функция — выделена для smoke-тестов
 * без next/headers.
 */
export const applyControlGateToState = (state: ObjectControlState, controlEnabled: boolean): ObjectControlState =>
    controlEnabled ? state : {...state, enabled: false};

/** Приватное состояние управления объектом (read-only опрос для UI и маршрутов). */
export const getGeoritmControlState = async (ctx: GeoritmControlContext): Promise<ObjectControlState> => {
    try {
        // Обогащение из objects/obj/ — read-вызов по уже подтверждённому id;
        // вызывается только при включённом gate (проверка в источнике).
        const enriched = await enrichControlTarget(ctx, defaultGeoritmControlTransport);
        const snapshot = await fetchControlSnapshot(enriched, defaultGeoritmControlTransport);
        return {
            enabled: true,
            availability: snapshot.stateKnown ? 'available' : 'unknown',
            partitions: toPartitions(enriched, snapshot),
        };
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            await deleteSession(ctx.sessionId);
        }
        throw error;
    }
};

// ——————————————— Выполнение команды (arm/disarm) ————————

/** Окно наблюдения фактического результата (E11: 60–90 с). */
const OBSERVATION_WINDOW_MS = 75_000;
/** Интервал опроса состояния в окне (E11: 2–3 с). */
const POLL_INTERVAL_MS = 3_000;
/** Блокировка повтора после 'unknown': окно + запас на опрос UI. */
const UNKNOWN_COOLDOWN_MS = 120_000;
/** Лимит команд на сессию в минуту (защита от циклов, E11 9.2.3). */
const MAX_COMMANDS_PER_MINUTE = 5;

/** Реестр команд в памяти процесса (рестарт очищает — см. control-engine). */
const commandGuard = new ControlCommandGuard(UNKNOWN_COOLDOWN_MS, MAX_COMMANDS_PER_MINUTE);

/** Человекочитаемые тексты отказ-кодов (справочник E11, раздел 5). */
const FAILURE_CODE_MESSAGES: Readonly<Record<number, string>> = {
    4501: 'Прибор сообщил об ошибке снятия раздела с охраны',
    4503: 'Прибор сообщил об ошибке взятия раздела под охрану',
    9201: 'Прибор сообщил о неисправности при взятии под охрану',
};

const CONFIRMED_MESSAGES: Readonly<Record<ControlAction, string>> = {
    arm: 'Раздел взят под охрану',
    disarm: 'Раздел снят с охраны',
};

const UNKNOWN_MESSAGE = 'Команда принята сервером мониторинга, но подтверждение не получено. '
    + 'Проверьте состояние объекта перед повтором';

/**
 * Ранний исход до наблюдения (классификация результата send()).
 * Обработан в executeGeoritmControlCommand: наблюдение после явного
 * отказа сервера или невозможности передать команду не выполняется.
 */
class EarlyOutcome extends Error {
    readonly outcome: {result: ControlResult; message: string};

    constructor(outcome: {result: ControlResult; message: string}) {
        super('early-outcome');
        this.name = 'EarlyOutcome';
        this.outcome = outcome;
    }
}

/** Инъекции для smoke-сценариев; в продакшене используются значения по умолчанию. */
export interface GeoritmControlDeps {
    transport?: GeoritmControlTransport;
    guard?: ControlCommandGuard;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    windowMs?: number;
    intervalMs?: number;
}

/**
 * Выполняет команду управления одним разделом. Возвращает честный
 * трёхзначный результат; отказы до отправки — ControlError с машинной
 * причиной для маршрута. При выключенном feature gate метод бросает
 * ControlError('gate-disabled') ДО любых обращений к GEORITM.
 */
export const executeGeoritmControlCommand = async (
    ctx: GeoritmControlContext,
    action: ControlAction,
    areaNum: number,
    deps: GeoritmControlDeps = {},
): Promise<ControlOperationResult> => {
    // Шаг 1 — feature gate. Ни read-, ни write-вызовы ниже не выполняются.
    if (!isGeoritmControlEnabled()) {
        throw new ControlError('gate-disabled', 'Управление охраной отключено');
    }

    const transport = deps.transport ?? defaultGeoritmControlTransport;
    const guard = deps.guard ?? commandGuard;
    const now = deps.now ?? (() => Date.now());
    const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const windowMs = deps.windowMs ?? OBSERVATION_WINDOW_MS;
    const intervalMs = deps.intervalMs ?? POLL_INTERVAL_MS;

    // Шаг 2 — защита от повторной отправки и лимит частоты.
    const slot = guard.acquire(ctx.sessionId, ctx.objectId, areaNum, now());
    if (slot === 'in-flight') {
        throw new ControlError('in-flight', 'Команда по этому разделу уже выполняется');
    }
    if (slot === 'cooldown') {
        throw new ControlError('cooldown', 'Предыдущая команда не получила подтверждения. '
            + 'Проверьте состояние объекта — повтор станет возможен после обновления состояния');
    }
    if (slot === 'rate-limited') {
        throw new ControlError('rate-limited', 'Слишком много команд подряд. Попробуйте позже');
    }

    let outcome: {result: ControlResult; message: string} | null = null;
    try {
        // Шаг 3 — обогащение capability-контекста read-вызовом objects/obj/
        // (E13) по уже подтверждённому id, затем серверное разрешение
        // раздела и состояния (IMEI только здесь).
        ctx = await enrichControlTarget(ctx, transport);
        const snapshot = await fetchControlSnapshot(ctx, transport);
        const area = snapshot.areas.find(
            (candidate) => candidate && typeof candidate.num === 'number' && candidate.num === areaNum,
        );
        if (!area) {
            throw new ControlError('unknown-area', 'Раздел не найден среди разделов объекта');
        }
        const guarded = snapshot.stateKnown
            ? partitionGuarded(snapshot.stateMap ? snapshot.stateMap[String(areaNum)] : undefined)
            : null;
        const availability = computeControlAvailability(action, {
            controlEnabled: true,
            permissions: ctx.permissions,
            objType: ctx.target.objType,
            canArm: ctx.target.canArm,
            restricted: ctx.target.restricted,
            imei: snapshot.imei,
            guarded,
        });
        // Шаг 4 — доступность: команда только при полном подтверждении.
        if (availability !== 'available') {
            throw new ControlError(
                availability === 'no-permission' ? 'no-permission'
                    : availability === 'unsupported' ? 'unsupported'
                    : 'unknown-capability',
                'Управление этим разделом недоступно',
            );
        }
        // Повторное воздействие на раздел в целевом состоянии нецелевое
        // (E11 8) — команда не отправляется, состояние уже целевое.
        if (action === 'arm' && guarded === true) {
            throw new ControlError('already-in-state', 'Раздел уже под охраной — команда не отправлялась');
        }
        if (action === 'disarm' && guarded === false) {
            throw new ControlError('already-in-state', 'Раздел уже снят с охраны — команда не отправлялась');
        }

        // Шаг 5 — отправка (ровно один вызов) и наблюдение результата.
        const send = async (): Promise<void> => {
            let response: GeoritmCommandResponse;
            try {
                response = action === 'arm'
                    ? await transport.arm(ctx.basic, snapshot.imei!, areaNum)
                    : await transport.disarm(ctx.basic, snapshot.imei!, areaNum);
            } catch (error) {
                if (error instanceof GeoritmApiError) {
                    if (error.isUnauthorized) {
                        // 401 — credentials утрачены; сессию отзывает общий обработчик ниже.
                        throw error;
                    }
                    if (error.kind === 'http') {
                        // Явный отказ сервера GEORITM (права/параметры/прибор вне
                        // связи, E11 4.3) — достоверный 'rejected' с коротким
                        // текстом сервера (без технических деталей).
                        throw new EarlyOutcome({
                            result: 'rejected',
                            message: error.serverMessage
                                ? `Сервер мониторинга отклонил команду: ${error.serverMessage}`
                                : 'Сервер мониторинга отклонил команду',
                        });
                    }
                    // Сеть/тайм-аут: неизвестно, принята ли команда — 'unknown',
                    // автоматический повтор запрещён (E11 8).
                    throw new EarlyOutcome({
                        result: 'unknown',
                        message: 'Не удалось передать команду серверу мониторинга. '
                            + 'Проверьте состояние объекта перед повтором',
                    });
                }
                throw error;
            }
            if (!response || response.success !== 1) {
                // Документировано только значение 1 (E11 2.1): прочее —
                // сервер не подтвердил приём команды.
                throw new EarlyOutcome({
                    result: 'rejected',
                    message: 'Сервер мониторинга не подтвердил приём команды',
                });
            }
        };

        const observationDeps: CommandObservationDeps = {
            send,
            pollState: async () => {
                const response = await transport.partitionsState(ctx.basic, snapshot.imei!);
                return response?.state ?? {};
            },
            fetchFailureEvents: (fromMs, toMs): Promise<JournalFailureRecord[]> =>
                transport.historyOnObject(ctx.basic, ctx.target.id, fromMs, toMs),
            windowMs,
            intervalMs,
            now,
            sleep,
        };

        try {
            const observed = await observeCommandOutcome(action, areaNum, observationDeps);
            outcome = observed.failureCode !== undefined && observed.result === 'rejected'
                ? {
                    result: 'rejected',
                    message: FAILURE_CODE_MESSAGES[observed.failureCode] ?? 'Прибор отклонил команду',
                }
                : observed.result === 'confirmed'
                    ? {result: 'confirmed', message: CONFIRMED_MESSAGES[action]}
                    : {result: 'unknown', message: UNKNOWN_MESSAGE};
        } catch (error) {
            if (error instanceof EarlyOutcome) {
                outcome = error.outcome;
            } else {
                throw error;
            }
        }
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            await deleteSession(ctx.sessionId);
        }
        throw error;
    } finally {
        // 'unknown' → cooldown (повтор заблокирован до проверки состояния);
        // известный результат или отказ до отправки → слот освобождается.
        guard.release(ctx.sessionId, ctx.objectId, areaNum, outcome?.result ?? 'confirmed', now());
    }

    // Шаг 6 — свежее состояние разделов для UI (ошибка опроса не маскирует
    // результат команды, но и не подменяет его пустой «нормой»).
    let partitions: PartitionControlState[] = [];
    try {
        const snapshot = await fetchControlSnapshot(ctx, transport);
        partitions = toPartitions(ctx, snapshot);
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            await deleteSession(ctx.sessionId);
            throw error;
        }
        // Состояние недоступно — разделы не заполняются; результат команды
        // остаётся честным (UI покажет результат и предложит обновить).
    }

    return {result: outcome.result, message: outcome.message, partitions};
};
