/**
 * Контракты личного кабинета (прототип на демонстрационных данных).
 *
 * Состояния — ограниченные строковые union-типы. Демо-значения вымышлены
 * и не являются данными реального оборудования или GEORITM.
 */

/** Состояние охранной сигнализации объекта. */
export type SecurityAlarmState = 'armed' | 'disarmed' | 'alarm' | 'fault';

/** Состояние пожарной сигнализации объекта. */
export type FireAlarmState = 'normal' | 'alarm' | 'fault' | 'maintenance';

/** Состояние связи мониторинговой станции с объектом. */
export type ConnectionState = 'online' | 'unstable' | 'offline';

/**
 * Объект мониторинга в демонстрационном источнике данных.
 * `updatedAt` — фиксированное время «последнего обновления» (ISO 8601).
 */
export interface DemoMonitorObject {
    id: string;
    name: string;
    address: string;
    securityAlarm: SecurityAlarmState;
    fireAlarm: FireAlarmState;
    connection: ConnectionState;
    updatedAt: string;
}

/** Система, к которой относится зона объекта. */
export type ZoneSystem = 'security' | 'fire';

/**
 * Зона объекта. Дискриминированное объединение связывает систему зоны
 * с допустимыми состояниями: у охранной и пожарной зоны разные наборы
 * состояний, смешать их в одном поле невозможно.
 */
export type DemoObjectZone =
    | { id: string; name: string; system: 'security'; state: SecurityAlarmState }
    | { id: string; name: string; system: 'fire'; state: FireAlarmState };

/** Тип записи журнала событий (демо). */
export type DemoEventType =
    | 'security_armed'
    | 'security_disarmed'
    | 'security_alarm'
    | 'security_fault'
    | 'fire_alarm'
    | 'fire_fault'
    | 'fire_maintenance'
    | 'connection_lost'
    | 'connection_restored'
    | 'system';

/** Запись журнала событий объекта (демо). */
export interface DemoObjectEvent {
    id: string;
    objectId: string;
    /** ISO 8601, время возникновения. */
    occurredAt: string;
    type: DemoEventType;
    /** Короткое человекочитаемое описание. */
    message: string;
    /** Зона, к которой относится событие, если применимо. */
    zoneName?: string;
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
