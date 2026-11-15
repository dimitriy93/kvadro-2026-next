import type {
    CommunicationDiagnostics,
    MonitorObject,
    MonitorObjectEvent,
    MonitorEventType,
    ObjectFault,
    ObjectReportFile,
    ObjectReportFormat,
    ObjectReportRequest,
    ObjectReportType,
    ObjectZoneSection,
    PowerDiagnostics,
    PublicAccountUser,
} from './contracts';
import type {EventJournalCursor, EventJournalDirection} from './event-journal';
import {
    findDemoObjectForUser,
    getDemoChannelsForObject,
    getDemoDiagnosticsForObject,
    getDemoObjectsForUser,
    getDemoPowerForObject,
    getDemoReportForObject,
    getDemoZonesForObject,
    verifyDemoCredentials,
    type DemoLoginHint,
} from './demo-data';
import {
    getDemoEventsPageForObject,
    isMonitorEventType,
} from './demo-events';
import {createSessionToken} from './session';
import {
    findGeoritmObjectForUser,
    getGeoritmChannelsForObject,
    getGeoritmDiagnosticsForObject,
    getGeoritmEventsPageForObject,
    getGeoritmObjectsForUser,
    getGeoritmPowerForObject,
    getGeoritmReportForObject,
    getGeoritmZonesForObject,
    logoutGeoritm,
    verifyGeoritmCredentials,
} from './georitm-source';

/**
 * Диспетчер источника данных кабинета.
 *
 * Источник задаётся переменной окружения ACCOUNT_DATA_SOURCE:
 *   - 'demo' (по умолчанию) — демонстрационные данные, поведение прежнее;
 *   - 'georitm' — реальные данные GEORITM REST API.
 *
 * Страницы и API кабинета вызывают только функции этого модуля; условная
 * логика по источнику в UI запрещена. Все функции асинхронные: демо-источник
 * синхронный по сути, но обёрнут в Promise ради единого контракта.
 */

export type AccountDataSourceKind = 'demo' | 'georitm';

/** Текущий источник данных. Отсутствие настройки — безопасное значение 'demo'. */
export const getAccountDataSource = (): AccountDataSourceKind => {
    const value = process.env.ACCOUNT_DATA_SOURCE?.trim().toLowerCase();
    return value === 'georitm' ? 'georitm' : 'demo';
};

/** Результат проверки учётных данных источника. */
export interface VerifiedCredentials {
    user: PublicAccountUser;
    /** Значение для HttpOnly-cookie (у georitm — непрозрачный ID серверной сессии). */
    sessionValue: string;
}

/**
 * Проверка учётных данных источника. Для GEORITM — вызов users/login/
 * и создание серверной сессии; недоступность API пробрасывается как
 * исключение (не маскируется под «неверный пароль»).
 */
export const verifyCredentials = async (login: string, password: string): Promise<VerifiedCredentials | null> => {
    if (getAccountDataSource() === 'georitm') {
        return verifyGeoritmCredentials(login, password);
    }

    const user = verifyDemoCredentials(login, password);
    return user ? {user, sessionValue: createSessionToken(user.id)} : null;
};

/** Список объектов, разрешённых пользователю (серверная проверка доступа). */
export const getObjectsForUser = async (userId: string): Promise<MonitorObject[]> =>
    getAccountDataSource() === 'georitm'
        ? getGeoritmObjectsForUser(userId)
        : getDemoObjectsForUser(userId);

/**
 * Объект по id, только если он разрешён пользователю. Чужой и несуществующий
 * объект неотличимы — в обоих случаях null.
 */
export const findObjectForUser = async (userId: string, objectId: string): Promise<MonitorObject | null> =>
    getAccountDataSource() === 'georitm'
        ? findGeoritmObjectForUser(userId, objectId)
        : findDemoObjectForUser(userId, objectId);

/**
 * Разделы и зоны объекта. Вызывается только после проверки принадлежности
 * объекта пользователю (findObjectForUser); источник GEORITM дополнительно
 * проверяет доступ сам (объект должен быть в выдаче objects-tree-set/
 * текущего пользователя), демо-источник читает свои фиксированные данные.
 */
export const getZonesForObject = async (objectId: string): Promise<ObjectZoneSection[]> =>
    getAccountDataSource() === 'georitm'
        ? getGeoritmZonesForObject(objectId)
        : getDemoZonesForObject(objectId);

/**
 * Активные неисправности оборудования объекта (E4.2). Вызывается после
 * проверки принадлежности объекта; оба источника дополнительно проверяют
 * доступ сами. Ошибка получения пробрасывается как исключение — пустой
 * список означает только явно пустой ответ источника.
 */
export const getDiagnosticsForObject = async (objectId: string): Promise<ObjectFault[]> =>
    getAccountDataSource() === 'georitm'
        ? getGeoritmDiagnosticsForObject(objectId)
        : getDemoDiagnosticsForObject(objectId);

/**
 * Диагностика каналов связи объекта (E9). Вызывается после проверки
 * принадлежности объекта; источники дополнительно проверяют доступ сами.
 * Возвращаемый DTO различает «метод не поддерживается сервером»,
 * «данных нет» и временную ошибку (ошибка пробрасывается вызывающей
 * стороне — не маскируется под отсутствующие каналы).
 */
export const getChannelsForObject = async (objectId: string): Promise<CommunicationDiagnostics> =>
    getAccountDataSource() === 'georitm'
        ? getGeoritmChannelsForObject(objectId)
        : getDemoChannelsForObject(objectId);

/**
 * Диагностика питания прибора объекта (E9). Для стационарных приборов
 * GEORITM данные о питании не передаются ('not-provided' — документировано);
 * проблемы питания видны в активных неисправностях.
 */
export const getPowerForObject = async (objectId: string): Promise<PowerDiagnostics> =>
    getAccountDataSource() === 'georitm'
        ? getGeoritmPowerForObject(objectId)
        : getDemoPowerForObject(objectId);

/**
 * Постраничная порция журнала событий объекта (E10). Первая страница
 * (cursor === null) строится из «головы» журнала, последующие — от
 * якорной границы (подписанный курсор из ?c=); направление выборки
 * задаёт сам курсор. Журнал больше не загружается целиком при каждом
 * открытии страницы.
 *
 * `availableTypes` — типы, встречающиеся в журнале (для чипов фильтра);
 * у демо-источника точен, у GEORITM вычисляется по последним загруженным
 * данным и кэшируется (может быть неполным — см. georitm-source).
 * `totalEvents` — точное общее количество после фильтра, если источник
 * его достоверно знает (демо); GEORITM total не предоставляет — null,
 * и UI не показывает фиктивное число страниц.
 */
export interface EventsPageResult {
    events: MonitorObjectEvent[];
    hasMore: boolean;
    /** Загрузка остановлена ограничением глубины; конец истории не доказан. */
    depthLimited: boolean;
    /** Граница ниже страницы — для «следующей страницы» (null, если !hasMore). */
    bottomCursor: EventJournalCursor | null;
    /** Граница над страницей — для «предыдущей страницы» (null у первой). */
    upperCursor: EventJournalCursor | null;
    availableTypes: readonly MonitorEventType[];
    totalEvents: number | null;
}

export const getEventsPageForObject = async (
    objectId: string,
    pageSize: number,
    eventType: MonitorEventType | undefined,
    cursor: EventJournalCursor | null,
    direction: EventJournalDirection,
): Promise<EventsPageResult> => {
    const result = getAccountDataSource() === 'georitm'
        ? await getGeoritmEventsPageForObject(objectId, pageSize, eventType, cursor, direction)
        : await getDemoEventsPageForObject(objectId, pageSize, eventType, cursor, direction);

    return {
        events: result.page.events,
        hasMore: result.page.hasMore,
        depthLimited: result.page.depthLimited,
        bottomCursor: result.page.bottomCursor,
        upperCursor: result.page.upperCursor,
        availableTypes: result.availableTypes,
        totalEvents: result.totalEvents,
    };
};

/** Выход: для GEORITM — отзыв серверной сессии (+ users/logout/); для demo — очистка cookie на стороне маршрута. */
export const performLogout = async (): Promise<void> => {
    if (getAccountDataSource() === 'georitm') {
        await logoutGeoritm();
    }
};

// ————————————————————————————— Отчёты (E4.3) ————————

/**
 * Ограничение периода отчёта. Лимиты периода в документации GEORITM не
 * описаны; ограничение задаётся кабинетом, чтобы исключить тяжёлые
 * запросы (один отчёт на один объект за запрос, максимум месяц).
 */
export const REPORT_MAX_PERIOD_DAYS = 31;

/** Белый список типов отчётов кабинета — только подтверждённые API. */
const KNOWN_REPORT_TYPES: readonly ObjectReportType[] = ['alerts-summary', 'alerts-events'];

/** Форматы файлов отчётов, разрешённые к запросу. */
const KNOWN_REPORT_FORMATS: readonly ObjectReportFormat[] = ['pdf', 'excel'];

/** Валидация типа отчёта для API-маршрута (?type из запроса браузера). */
export const isKnownReportType = (value: string): value is ObjectReportType =>
    (KNOWN_REPORT_TYPES as readonly string[]).includes(value);

/** Валидация формата отчёта для API-маршрута. */
export const isKnownReportFormat = (value: string): value is ObjectReportFormat =>
    (KNOWN_REPORT_FORMATS as readonly string[]).includes(value);

/**
 * Отчёт объекта в виде готового файла. Вызывается только после проверки
 * принадлежности объекта (findObjectForUser); оба источника дополнительно
 * проверяют доступ сами. Ошибка получения пробрасывается как исключение —
 * пустой файл или «успешный» ответ без содержимого не имитируются.
 */
export const getReportForObject = async (
    objectId: string,
    request: ObjectReportRequest,
): Promise<ObjectReportFile> =>
    getAccountDataSource() === 'georitm'
        ? getGeoritmReportForObject(objectId, request)
        : getDemoReportForObject(objectId, request);

/** Валидация типа события для фильтра (?type=...). Справочник типов общий для обоих источников. */
export const isKnownEventType = isMonitorEventType;

export type {DemoLoginHint};
