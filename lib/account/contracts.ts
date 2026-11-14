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
 * Сведения о приборе (контрольной панели) объекта. Whitelist-проекция
 * GEORITM devices[]: модель, короткое имя и прошивка. Остальные поля
 * записи прибора (включая imei) в DTO не переносятся.
 */
export interface ObjectDeviceInfo {
    name: string;
    /** Короткое имя модели, если задано. */
    shortName?: string;
    /** Версия прошивки прибора, если известна. */
    firmware?: string;
}

/**
 * Активная неисправность оборудования объекта (GEORITM obj-faults/).
 *
 * `message` — текст, предоставленный сервером GEORITM; семантика `code`
 * справочником не документирована (кроме примеров), поэтому UI показывает
 * только текст сервера и код во второстепенном виде.
 */
export interface ObjectFault {
    id: string;
    /** Код неисправности GEORITM. */
    code: number;
    /** Текст неисправности от сервера (рус.). */
    message: string;
    /** Номер раздела, если известен. */
    areaNum?: number;
    /** Номер зоны, если известен. */
    zoneNum?: number;
}

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
    /** Прибор объекта, если источник сообщил; иначе undefined — UI не показывает карточку прибора. */
    device?: ObjectDeviceInfo;
    securityAlarm: SecurityAlarmState;
    fireAlarm: FireAlarmState;
    connection: ConnectionState;
    updatedAt?: string;
}

/** Система, к которой относится зона объекта. */
export type ZoneSystem = 'security' | 'fire';

/**
 * Зона (шлейф) объекта. Дискриминированное объединение связывает систему
 * зоны с допустимыми состояниями: у охранной и пожарной зоны разные наборы
 * состояний, смешать их в одном поле невозможно.
 *
 * `num` — номер зоны в приборе, `comment` — комментарий GEORITM, если
 * задан. Классификации «охранная/пожарная» в GEORITM нет (вопрос B7):
 * у реального источника system всегда 'security'.
 */
export type ObjectZone =
    | {
        id: string;
        name: string;
        /** Номер зоны в приборе (GEORITM zones[].num), если известен. */
        num?: number;
        /** Комментарий зоны GEORITM, если задан. */
        comment?: string;
        system: 'security';
        state: SecurityAlarmState;
    }
    | {
        id: string;
        name: string;
        num?: number;
        comment?: string;
        system: 'fire';
        state: FireAlarmState;
    };

/**
 * Раздел объекта (GEORITM areas[]): группа зон охранно-пожарного
 * оборудования с собственным состоянием охраны. Раздел с пустым
 * zones — реальная ситуация (раздел без настроенных зон), а не ошибка.
 */
export interface ObjectZoneSection {
    id: string;
    name: string;
    /** Номер раздела в приборе (GEORITM areas[].num), если известен. */
    num?: number;
    /** Комментарий раздела GEORITM, если задан. */
    comment?: string;
    /** Состояние раздела: тревога > неисправность > охрана. */
    state: SecurityAlarmState;
    zones: ObjectZone[];
}

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
