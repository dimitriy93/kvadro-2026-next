import type {
    MonitorObject,
    MonitorObjectEvent,
    MonitorEventType,
    ObjectFault,
    ObjectZoneSection,
    PublicAccountUser,
} from './contracts';
import {
    findDemoObjectForUser,
    getDemoDiagnosticsForObject,
    getDemoObjectsForUser,
    getDemoZonesForObject,
    verifyDemoCredentials,
    type DemoLoginHint,
} from './demo-data';
import {getDemoEventsForObject, isMonitorEventType} from './demo-events';
import {createSessionToken} from './session';
import {
    findGeoritmObjectForUser,
    getGeoritmDiagnosticsForObject,
    getGeoritmEventsForObject,
    getGeoritmObjectsForUser,
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
 * События объекта (от новых к старым) или null, если источник пока не
 * поддерживает журнал событий (методы alerts/* на реальном сервере GEORITM
 * не проверены). null нельзя заменять пустым списком — «нет данных» и
 * «событий нет» разные состояния.
 */
export const getEventsForObject = async (
    objectId: string,
    eventType?: MonitorEventType,
): Promise<MonitorObjectEvent[] | null> =>
    getAccountDataSource() === 'georitm'
        ? getGeoritmEventsForObject(objectId, eventType)
        : getDemoEventsForObject(objectId, eventType);

/** Выход: для GEORITM — отзыв серверной сессии (+ users/logout/); для demo — очистка cookie на стороне маршрута. */
export const performLogout = async (): Promise<void> => {
    if (getAccountDataSource() === 'georitm') {
        await logoutGeoritm();
    }
};

/** Валидация типа события для фильтра (?type=...). Справочник типов общий для обоих источников. */
export const isKnownEventType = isMonitorEventType;

export type {DemoLoginHint};
