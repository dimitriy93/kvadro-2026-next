import type {ControlAction, ControlResult} from './contracts';

/**
 * Движок операции управления охраной (E12). Чистый модуль: без Next.js,
 * переменных окружения и реального транспорта — все вызовы GEORITM
 * инъецируются (тот же подход, что у event-journal), поэтому сценарии
 * «команда → опрос состояния → журнал» проверяются smoke-сценариями
 * на синтетических источниках без сети и без write-вызовов.
 *
 * Семантика подтверждения — E11, разделы 4.2–4.3:
 *  - {success: 1} — только «команда принята сервером», НЕ исполнение;
 *  - фактическое исполнение подтверждает переход objects/state/
 *    в целевое состояние;
 *  - достоверный отказ — отказ-код журнала группы 4 (4501/4503/9201)
 *    по разделу команды;
 *  - если за окно наблюдения не получено ни того, ни другого —
 *    результат 'unknown'.
 * Повторная команда автоматически не отправляется никогда: ошибку опроса
 * двигатель не превращает в исход команды, а продлевает наблюдение до
 * конца окна.
 */

/** Значение objects/state/ «раздел под охраной». */
export const STATE_ARMED = 2;
/** Значение objects/state/ «раздел снят с охраны». */
export const STATE_DISARMED = 1;

/** Целевое значение objects/state/ для действия. */
export const targetStateValue = (action: ControlAction): number =>
    action === 'arm' ? STATE_ARMED : STATE_DISARMED;

/**
 * Отказ-коды журнала группы 4 (справочник E11, раздел 5) — достоверное
 * негативное подтверждение команды по разделу:
 *  - 4501 «Ошибка снятия», 4503 «Ошибка взятия», 9201 «Неисправность
 *    при взятии на охрану» (требование задачи E12);
 *  - классификатор журнала кабинета помечает эти коды как 'security_fault'
 *    (см. georitm-source VERIFIED_CODES), поэтому подстрочные эвристики
 *    «снят/взят» не превращают отказ в успешное событие направления.
 */
export const COMMAND_FAILURE_CODES: ReadonlySet<number> = new Set([4501, 4503, 9201]);

/**
 * «NNN.N» → числовой код справочника (как numericEventCode в georitm-source).
 * Некорректная строка → undefined — код не интерпретируется.
 */
export const parseJournalCode = (code: string): number | undefined => {
    const normalized = Number(code.replace('.', ''));
    return Number.isInteger(normalized) && normalized > 0 ? normalized : undefined;
};

/** Событие журнала, достаточное для поиска отказов (см. JournalFailureSource). */
export interface JournalFailureRecord {
    type?: string;
    code?: string;
    area?: number;
}

/**
 * Источник журнала за окно (alerts/history-on-obj/ в georitm-control).
 * Возвращает события от начала команды; ошибки пробрасываются — движок
 * трактует их как «свидетельств отказов сейчас нет», не как исход.
 */
export type JournalFailureSource = (fromMs: number, toMs: number) => Promise<JournalFailureRecord[]>;

/**
 * Поиск отказа команды в журнале: запись ObjectAlert с отказ-кодом
 * по разделу команды. Совпадение по area обязательно (код приходит
 * с номером раздела — подтверждено эпизодом 402.x, E11 4.4): событие
 * без номера раздела или по другому разделу отказом не считается —
 * консервативно, исход остаётся 'unknown'.
 */
export const findCommandFailureCode = (
    records: JournalFailureRecord[],
    action: ControlAction,
    areaNum: number,
): number | undefined => {
    for (const record of records) {
        if (!record || typeof record !== 'object' || record.type !== 'ObjectAlert') {
            continue;
        }
        if (typeof record.code !== 'string' || record.area !== areaNum) {
            continue;
        }
        const code = parseJournalCode(record.code);
        if (code !== undefined && COMMAND_FAILURE_CODES.has(code)) {
            // 4501/4503 — отказ соответствующего действия; 9201 — отказ взятия.
            // Код, не соответствующий действию (4501 при arm), не засчитывается.
            const isDisarmFailure = code === 4501 && action === 'disarm';
            const isArmFailure = (code === 4503 || code === 9201) && action === 'arm';
            if (isDisarmFailure || isArmFailure) {
                return code;
            }
        }
    }
    return undefined;
};

/** Значение раздела из карты objects/state/ (или undefined — раздела нет). */
export const readPartitionState = (state: Record<string, number> | undefined, areaNum: number): number | undefined => {
    if (!state) {
        return undefined;
    }
    const value = state[String(areaNum)];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

/** Зависимости наблюдения результата (инъекция транспорта и времени). */
export interface CommandObservationDeps {
    /** Отправка команды (georitmArm/georitmDisarm). Вызывается ровно один раз:
     * автоматических повторов нет — при неопределённом результате повтор
     * блокируется на уровне маршрута, а не выполняется вслепую. */
    send: () => Promise<void>;
    /** Текущая карта объектов/state/ по IMEI (живой опрос, без кэша). */
    pollState: () => Promise<Record<string, number>>;
    /** Журнал событий с момента команды (для отказ-кодов). */
    fetchFailureEvents: JournalFailureSource;
    /** Окно наблюдения, мс (E11: 60–90 с; в smoke инъецируется короткое). */
    windowMs: number;
    /** Интервал опроса, мс (E11: 2–3 с). */
    intervalMs: number;
    /** Моноtonная «текущая» метка, мс (инъекция для детерминизма). */
    now: () => number;
    /** Пауза между опросами (инъекция для smoke). */
    sleep: (ms: number) => Promise<void>;
}

/** Итог операции: трёхзначный результат без интерпретации {success:1} как успеха. */
export interface CommandObservationOutcome {
    result: ControlResult;
    /** Отказ-код журнала, если результат 'rejected' установлен по коду 4501/4503/9201. */
    failureCode?: number;
}

/**
 * Отправка команды и наблюдение фактического результата.
 *
 * Ошибки send():
 *  - transport-ошибка «команда принята и передана, но отказ сервера»
 *    классифицирует вызывающая сторона (georitm-control): явный HTTP-отказ
 *    GEORITM → 'rejected' с текстом сервера; сеть/тайм-аут → 'unknown'
 *    (неизвестно, дошла ли команда). Здесь эти ветки не обрабатываются.
 *
 * После принятой команды: цикл «опрос state → поиск отказов в журнале»
 * до перехода состояния, отказа или конца окна. Ошибки опроса и журнала
 * не завершают цикл исходом — наблюдение продолжается до дедлайна.
 */
export const observeCommandOutcome = async (
    action: ControlAction,
    areaNum: number,
    deps: CommandObservationDeps,
): Promise<CommandObservationOutcome> => {
    await deps.send();

    const target = targetStateValue(action);
    const startedAt = deps.now();
    const deadline = startedAt + deps.windowMs;

    for (;;) {
        // Живой опрос состояния; ошибка — не исход, продолжаем окно.
        try {
            const state = await deps.pollState();
            if (readPartitionState(state, areaNum) === target) {
                return {result: 'confirmed'};
            }
        } catch {
            // Состояние недоступно в этом такте — наблюдение продолжается.
        }

        // Отказ-код журнала по разделу — достоверный отказ команды.
        try {
            const records = await deps.fetchFailureEvents(startedAt - 1000, deps.now());
            const failureCode = findCommandFailureCode(records, action, areaNum);
            if (failureCode !== undefined) {
                return {result: 'rejected', failureCode};
            }
        } catch {
            // Журнал недоступен в этом такте — исход по состоянию/дедлайну.
        }

        if (deps.now() >= deadline) {
            return {result: 'unknown'};
        }
        const remaining = deadline - deps.now();
        await deps.sleep(Math.min(deps.intervalMs, Math.max(remaining, 0)));
    }
};

// ————————— Защита от повторных команд (in-flight / cooldown / rate) ————————

interface CommandGuardEntry {
    /** until = 0 — команда в полёте; until > 0 — cooldown до метки. */
    until: number;
}

/**
 * Реестр команд управления в памяти процесса (E11 9.2.3): не более одной
 * команды на пару «сессия × объект × раздел», блокировка повтора после
 * неопределённого результата и лимит частоты на сессию. Рестарт процесса
 * очищает реестр — это ослабляет защиту, но не безопасность: gate,
 * ownership и права проверяются при каждом вызове независимо.
 */
export class ControlCommandGuard {
    private readonly entries = new Map<string, CommandGuardEntry>();
    private readonly sessionTicks = new Map<string, number[]>();
    /** Cooldown после 'unknown' (кнопки заблокированы до опроса состояния). */
    private readonly cooldownMs: number;
    /** Лимит команд на сессию в скользящем окне 60 с. */
    private readonly maxPerMinute: number;

    constructor(cooldownMs: number, maxPerMinute: number) {
        this.cooldownMs = cooldownMs;
        this.maxPerMinute = maxPerMinute;
    }

    private static key(sessionId: string, objectId: string, areaNum: number): string {
        return `${sessionId}:${objectId}:${areaNum}`;
    }

    /**
     * Попытка начать команду. 'ok' — слот занят (вызывающая сторона обязана
     * завершить вызовом release); 'in-flight' — команда уже выполняется;
     * 'cooldown' — предыдущая завершилась неизвестным результатом;
     * 'rate-limited' — превышен лимит частоты на сессию.
     */
    acquire(
        sessionId: string,
        objectId: string,
        areaNum: number,
        nowMs: number,
    ): 'ok' | 'in-flight' | 'cooldown' | 'rate-limited' {
        const key = ControlCommandGuard.key(sessionId, objectId, areaNum);
        const entry = this.entries.get(key);
        if (entry) {
            if (entry.until === 0) {
                return 'in-flight';
            }
            if (nowMs < entry.until) {
                return 'cooldown';
            }
        }

        if (!this.tryConsumeRateSlot(sessionId, nowMs)) {
            return 'rate-limited';
        }

        this.entries.set(key, {until: 0});
        return 'ok';
    }

    /**
     * Завершение команды. 'unknown' → cooldown (повтор заблокирован до
     * конца окна + запас — E11: перед повтором UI обязан показать
     * актуальное состояние); 'confirmed'/'rejected' → слот свободен:
     * результат известен, решение о повторе принимает пользователь.
     */
    release(sessionId: string, objectId: string, areaNum: number, outcome: ControlResult, nowMs: number): void {
        const key = ControlCommandGuard.key(sessionId, objectId, areaNum);
        if (outcome === 'unknown') {
            this.entries.set(key, {until: nowMs + this.cooldownMs});
        } else {
            this.entries.delete(key);
        }
    }

    /** Принудительная очистка слота при исключении — защита от вечного in-flight. */
    clearSlot(sessionId: string, objectId: string, areaNum: number): void {
        this.entries.delete(ControlCommandGuard.key(sessionId, objectId, areaNum));
    }

    /** Скользящее окно 60 с на сессию; превышение — отказ без занятия слота команды. */
    private tryConsumeRateSlot(sessionId: string, nowMs: number): boolean {
        const windowStart = nowMs - 60_000;
        const ticks = (this.sessionTicks.get(sessionId) ?? []).filter((tick) => tick > windowStart);
        if (ticks.length >= this.maxPerMinute) {
            this.sessionTicks.set(sessionId, ticks);
            return false;
        }
        ticks.push(nowMs);
        this.sessionTicks.set(sessionId, ticks);
        return true;
    }
}
