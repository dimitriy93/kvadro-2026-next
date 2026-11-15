import type {MonitorEventType, MonitorObjectEvent} from './contracts';

/**
 * Движок постраничной загрузки журнала событий (E10).
 *
 * GEORITM не предоставляет ни offset, ни курсора, ни total: единственный
 * механизм — alerts/history-on-obj/ с временным окном [from, to] в
 * миллисекундах по receivedAt (границы включающие; ответ — все записи
 * окна). Это date-based pagination, поэтому движок строит порции на
 * «шагающих» временных окнах от якорной границы — это честная схема
 * поверх реально доступных параметров, а не имитация cursor-based API.
 *
 * Модель страницы. Страница — это pageSize записей, непосредственно
 * примыкающих к границе-якорю:
 *   - «от якоря вглубь» (direction 'older'): записи с receivedAt < t
 *     (плюс записи с receivedAt == t, не вошедшие в skip);
 *   - «от якоря наверх» (direction 'newer'): записи с receivedAt > t
 *     (плюс записи с receivedAt == t из skip).
 * Один якорь обслуживает обе навигации: ссылка «следующая» строит новый
 * якорь из нижней границы показанной страницы, ссылка «предыдущая» идёт
 * от текущего якоря наверх. Одинаковые timestamp обрабатываются
 * skip-списком уже показанных id — разрез страницы может пройти посередине
 * группы записей с одной меткой без потери и без дублей.
 *
 * Первая страница строится из «головы» журнала (headFetch — у GEORITM это
 * history-by-obj/ с его ограничением 1000+1000). Если отфильтрованных
 * записей меньше страницы, а голова была усечена сервером, загрузка
 * продолжается шагающими окнами глубже покрытия головы.
 *
 * Ограничение глубины: за одну загрузку страницы движок делает не больше
 * одного прохода по лестнице окон (см. WINDOW_LADDER_MS). Если и после
 * этого страница не заполнена, загрузка останавливается с depthLimited —
 * «конец истории» не заявляется, следующие порции просто не ищутся
 * автоматически (защита и от бесконечного цикла, и от фиктивного
 * «журнал кончился»).
 *
 * Модуль чистый: без импортов Next.js и окружения — используется и
 * GEORITM-источником, и демо-источником, и smoke-сценарием
 * scripts/event-journal-smoke.mjs.
 */

/** Запись журнала, подготовленная к постраничной загрузке. */
export interface JournalEntry {
    event: MonitorObjectEvent;
    /**
     * Время получения станцией (мс) — ключ постраничного порядка.
     * У демо-источника совпадает со временем события.
     */
    receivedAtMs: number;
}

/**
 * Якорная граница между страницами: t — метка receivedAt (мс) последней
 * записи предыдущей страницы; skip — id записей с receivedAt == t, уже
 * показанных на ней (разрез мог пройти посередине группы одинаковых меток).
 */
export interface EventJournalCursor {
    t: number;
    skip: string[];
}

/** Направление выборки от якоря. */
export type EventJournalDirection = 'older' | 'newer';

/** «Голова» журнала: новейшие записи источника (у GEORITM — до 1000+1000). */
export interface JournalHead {
    entries: JournalEntry[];
    /** true — источник вернул усечённый набор, глубже могут быть записи. */
    capped: boolean;
}

export interface EventJournalPageRequest {
    /** Размер страницы; вызывающая сторона валидирует по белому списку. */
    pageSize: number;
    /** Фильтр по типу события; применяется после нормализации записи. */
    eventType?: MonitorEventType;
    /** Якорь; null — первая страница (из головы). */
    cursor: EventJournalCursor | null;
    direction: EventJournalDirection;
    /** Все записи с receivedAt в [fromMs, toMs] включительно (обе границы). */
    windowFetch: (fromMs: number, toMs: number) => Promise<JournalEntry[]>;
    /** Обязателен при cursor === null. */
    headFetch?: () => Promise<JournalHead>;
}

export interface EventJournalPage {
    /** Записи страницы, от новых к старым (по occurredAt, затем по receivedAt). */
    events: MonitorObjectEvent[];
    /** Достоверно известно, что глубже есть ещё записи. */
    hasMore: boolean;
    /**
     * Конец истории не доказан (защитный флаг). В текущей схеме конец
     * всегда доказывается финальной пробой до начала эпохи, поэтому флаг
     * остаётся резервом для источников, где такая проба невозможна.
     */
    depthLimited: boolean;
    /** Граница ниже страницы — якорь «следующей страницы» (null, если !hasMore). */
    bottomCursor: EventJournalCursor | null;
    /** Граница над страницей — якорь «предыдущей страницы»; null у первой страницы. */
    upperCursor: EventJournalCursor | null;
}

/**
 * Лестница размеров окна (мс) для поиска записей от якоря. Окно растёт
 * только пока записи не найдены: у живого объекта (суточные тесты,
 * взятия/снятия) страница набирается за 1–4 запроса, а глубокая тишина
 * (объект снят с обслуживания) покрывается последними ступенями. Суммарная
 * глубина прохода — около 1,5 лет; каждое окно возвращает все записи
 * интервала, поэтому верхние ступени достигаются только для действительно
 * редких потоков (иначе страница наполняется раньше). Если и после
 * лестницы страница не заполнена, конец истории доказывается финальной
 * пробой до начала эпохи (см. fetchEventJournalPage).
 */
const WINDOW_LADDER_MS: readonly number[] = [
    1 * 60 * 60 * 1000,
    6 * 60 * 60 * 1000,
    24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
    31 * 24 * 60 * 60 * 1000,
    92 * 24 * 60 * 60 * 1000,
    366 * 24 * 60 * 60 * 1000,
];

const MIN_TIMESTAMP_MS = 0;
/** Защита от якоря в далёком будущем (значение из URL проверяется и тут). */
const MAX_TIMESTAMP_MS = 4_102_444_800_000; // 2100-01-01 UTC

/** Сортировка по постраничному порядку: receivedAt по убыванию, затем id. */
const byPagingOrder = (a: JournalEntry, b: JournalEntry): number =>
    b.receivedAtMs - a.receivedAtMs || (a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0);

/** Сортировка для отображения: occurredAt по убыванию, затем постраничный порядок. */
const byDisplayOrder = (a: JournalEntry, b: JournalEntry): number => {
    const delta = Date.parse(b.event.occurredAt) - Date.parse(a.event.occurredAt);
    return Number.isNaN(delta) ? byPagingOrder(a, b) : delta || byPagingOrder(a, b);
};

const isValidEntry = (entry: JournalEntry): boolean =>
    !!entry
    && !!entry.event
    && typeof entry.event.id === 'string'
    && entry.event.id.length > 0
    && Number.isFinite(entry.receivedAtMs)
    && entry.receivedAtMs >= MIN_TIMESTAMP_MS
    && entry.receivedAtMs <= MAX_TIMESTAMP_MS;

/**
 * Нижняя граница показанной страницы: метка последней записи и id записей
 * страницы с этой меткой (разрез мог пройти посередине группы одинаковых).
 */
const bottomBoundary = (shown: JournalEntry[]): EventJournalCursor | null => {
    if (shown.length === 0) {
        return null;
    }
    const t = shown[shown.length - 1].receivedAtMs;
    const skip = shown.filter((entry) => entry.receivedAtMs === t).map((entry) => entry.event.id);
    return {t, skip};
};

/** Верхняя граница показанной страницы (для навигации «предыдущая»). */
const upperBoundary = (shown: JournalEntry[]): EventJournalCursor | null => {
    if (shown.length === 0) {
        return null;
    }
    const t = shown[0].receivedAtMs;
    const skip = shown.filter((entry) => entry.receivedAtMs === t).map((entry) => entry.event.id);
    return {t, skip};
};

export const fetchEventJournalPage = async (request: EventJournalPageRequest): Promise<EventJournalPage> => {
    const pageSize = Math.floor(request.pageSize);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
        throw new Error(`Недопустимый размер страницы журнала: ${request.pageSize}`);
    }
    if (request.cursor === null && !request.headFetch) {
        throw new Error('Первая страница журнала требует headFetch');
    }

    const matchesFilter = (entry: JournalEntry): boolean =>
        !request.eventType || entry.event.type === request.eventType;

    // Кандидаты собираются с дедупликацией по id: окна перекрываются
    // намеренно (суб-секундная точность меток действий GEORITM не даёт
    // строить неперекрывающиеся границы), повторы убирает Map.
    const candidates = new Map<string, JournalEntry>();
    const addCandidates = (entries: readonly JournalEntry[], predicate: (entry: JournalEntry) => boolean): void => {
        for (const entry of entries) {
            if (isValidEntry(entry) && matchesFilter(entry) && predicate(entry) && !candidates.has(entry.event.id)) {
                candidates.set(entry.event.id, entry);
            }
        }
    };

    let boundary: EventJournalCursor | null = null;
    let upperCursor: EventJournalCursor | null = null;
    let headComplete = false;

    if (request.cursor === null) {
        const head = await request.headFetch!();
        addCandidates(head.entries, () => true);
        if (candidates.size > pageSize) {
            headComplete = true;
        } else if (!head.capped) {
            // Голова покрывает всю историю источника — глубже записей нет.
            headComplete = true;
        } else {
            // Голова усечена сервером и отфильтрованных записей не хватает —
            // продолжаем от нижней границы покрытия головы.
            const oldest = head.entries.reduce<JournalEntry | null>(
                (min, entry) => (isValidEntry(entry) && (min === null || entry.receivedAtMs < min.receivedAtMs) ? entry : min),
                null,
            );
            boundary = oldest ? {t: oldest.receivedAtMs, skip: []} : {t: MAX_TIMESTAMP_MS, skip: []};
        }
    } else {
        boundary = request.cursor;
        if (
            !Number.isFinite(boundary.t)
            || boundary.t < MIN_TIMESTAMP_MS
            || boundary.t > MAX_TIMESTAMP_MS
            || !Array.isArray(boundary.skip)
        ) {
            throw new Error('Некорректный якорь журнала событий');
        }
    }

    let ladderExhausted = true;

    if (boundary !== null) {
        const {t, skip} = boundary;
        const predicate = request.direction === 'newer'
            ? (entry: JournalEntry) => entry.receivedAtMs > t || (entry.receivedAtMs === t && skip.includes(entry.event.id))
            : (entry: JournalEntry) => entry.receivedAtMs < t || (entry.receivedAtMs === t && !skip.includes(entry.event.id));

        for (const chunk of WINDOW_LADDER_MS) {
            const from = request.direction === 'newer' ? t : Math.max(MIN_TIMESTAMP_MS, t - chunk);
            const to = request.direction === 'newer' ? t + chunk : t;
            addCandidates(await request.windowFetch(from, to), predicate);
            if (candidates.size > pageSize) {
                // Прабла «есть ещё записи» собрана — окно можно не расширять.
                ladderExhausted = false;
                break;
            }
        }

        if (ladderExhausted && request.direction === 'older') {
            // Финальная проба до начала эпохи: одно дополнительное окно,
            // доказывающее отсутствие записей глубже покрытия лестницы.
            // Без него конец истории нельзя отличить от «источника не хватило
            // глубины» (лесенка кончается раньше журнала — например, редкие
            // записи за пределами полутора лет). Достигается ценой одного
            // запроса, который для объекта с долгой тишиной возвращает сразу
            // всю старую часть журнала: приемлемо, потому что выполняется
            // только у «хвоста» журнала, один раз на загрузку страницы
            // (прежняя реализация тянула весь журнал на КАЖДУЮ страницу).
            const ladderSpan = WINDOW_LADDER_MS.reduce((sum, chunk) => sum + chunk, 0);
            const probeFrom = Math.max(MIN_TIMESTAMP_MS, t - ladderSpan);
            if (probeFrom > MIN_TIMESTAMP_MS) {
                addCandidates(await request.windowFetch(MIN_TIMESTAMP_MS, probeFrom), predicate);
            }
            // Покрытие дошло до начала отсчёта времени — конец доказан.
            ladderExhausted = false;
        }
    }

    const ordered = [...candidates.values()].sort(byPagingOrder);
    // «newer» отдаёт СТАРШИЕ pageSize кандидатов (страница над якорем),
    // «older» — НОВЕЙШИЕ (страница под якорем).
    const shown = request.direction === 'newer' && request.cursor !== null
        ? ordered.slice(-pageSize)
        : ordered.slice(0, pageSize);
    const events = [...shown].sort(byDisplayOrder).map((entry) => entry.event);

    if (request.cursor === null) {
        upperCursor = null;
    } else if (request.direction === 'older') {
        // Страница выбиралась из-под якоря — якорь и есть граница сверху.
        upperCursor = {t: request.cursor.t, skip: [...request.cursor.skip]};
    } else {
        upperCursor = upperBoundary(shown);
    }

    // Прабла «есть ещё» для страницы над якорем: под ней точно есть
    // страница, из которой пришли (если страница не оказалась первой —
    // это определяет вызывающая сторона по числу записей).
    const hasMore = request.cursor !== null && request.direction === 'newer'
        ? shown.length > 0
        : candidates.size > pageSize;

    return {
        events,
        hasMore,
        depthLimited: request.direction !== 'newer' && ladderExhausted && !headComplete,
        bottomCursor: hasMore ? bottomBoundary(shown) : null,
        upperCursor,
    };
};
