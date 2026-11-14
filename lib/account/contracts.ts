/**
 * Контракты личного кабинета — внутренние DTO, общие для всех источников
 * данных (демо и GEORITM). UI работает только с этими типами и не знает
 * о формате ответов внешнего API.
 *
 * Источник данных выбирается переменной окружения ACCOUNT_DATA_SOURCE
 * (см. lib/account/source.ts). Демо-значения вымышлены и не являются
 * данными реального оборудования или GEORITM.
 */

/** Состояние охранной сигнализации объекта. */
export type SecurityAlarmState = 'armed' | 'disarmed' | 'partial' | 'alarm' | 'fault';

/** Состояние пожарной сигнализации объекта. */
export type FireAlarmState = 'normal' | 'alarm' | 'fault' | 'maintenance' | 'unknown';

/** Состояние связи мониторинговой станции с объектом. */
export type ConnectionState = 'online' | 'unstable' | 'offline';

/**
 * Объект мониторинга.
 *
 * `id` — внутренний идентификатор кабинета; для GEORITM это строка от
 * числового `id` объекта (стабилен в рамках инсталляции). `extId` —
 * внешний номер объекта договорного учёта, `imei` не включён в DTO:
 * он нужен только для вызовов оборудования и не предназначен для UI.
 *
 * `updatedAt` — время последнего обновления состояния (ISO 8601), если
 * источник его достоверно знает; иначе undefined — UI не показывает дату.
 */
export interface MonitorObject {
    id: string;
    name: string;
    address: string;
    /** Внешний номер объекта (GEORITM extId), если известен. */
    extId?: number;
    securityAlarm: SecurityAlarmState;
    fireAlarm: FireAlarmState;
    connection: ConnectionState;
    updatedAt?: string;
}

/** Система, к которой относится зона объекта. */
export type ZoneSystem = 'security' | 'fire';

/**
 * Зона объекта. Дискриминированное объединение связывает систему зоны
 * с допустимыми состояниями: у охранной и пожарной зоны разные наборы
 * состояний, смешать их в одном поле невозможно.
 */
export type ObjectZone =
    | { id: string; name: string; system: 'security'; state: SecurityAlarmState }
    | { id: string; name: string; system: 'fire'; state: FireAlarmState };

/** Тип записи журнала событий. */
export type MonitorEventType =
    | 'security_armed'
    | 'security_disarmed'
    | 'security_alarm'
    | 'security_fault'
    | 'fire_alarm'
    | 'fire_fault'
    | 'fire_maintenance'
    | 'connection_lost'
    | 'connection_restored'
    | /** Восстановление (исходное событие достоверно неизвестно). */ 'restored'
    | 'system';

/** Запись журнала событий объекта. */
export interface MonitorObjectEvent {
    id: string;
    objectId: string;
    /** ISO 8601, время возникновения (у действий — время выполнения). */
    occurredAt: string;
    type: MonitorEventType;
    /** Короткое человекочитаемое описание. */
    message: string;
    /** Зона, к которой относится событие, если применимо. */
    zoneName?: string;
    /**
     * ISO 8601, время получения станцией (только для событий оборудования).
     * У импортированных событий может существенно отличаться от occurredAt.
     */
    receivedAt?: string;
    /** Код события GEORITM в исходном виде «NNN.N» (только для событий). */
    code?: string;
    /** Признак тревоги (справочник GEORITM; группа 3 тоже даёт true). */
    isAlarm?: boolean;
    /** Запись — действие пользователя или оператора станции. */
    isUserAction?: boolean;
    /** Кто выполнил действие (только для isUserAction). */
    userName?: string;
}

/**
 * Пользователь кабинета без секретных полей — безопасен для отдачи
 * в API-ответах и на серверных страницах.
 */
export interface PublicAccountUser {
    id: string;
    login: string;
    displayName: string;
}

/**
 * Способ, которым пользователь аутентифицирован в текущей сессии.
 * 'demo' — тестовая учётная запись; 'georitm' — реальный вход через
 * users/login/ GEORITM (credentials только в серверном хранилище).
 */
export type AccountSessionKind = 'demo' | 'georitm';
