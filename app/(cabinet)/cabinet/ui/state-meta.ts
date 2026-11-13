import type {
    ConnectionState,
    FireAlarmState,
    SecurityAlarmState,
    ZoneSystem,
} from '@/lib/account';

/**
 * Общие подписи и визуальные тона состояний для интерфейса кабинета.
 * Чистый серверный модуль без JSX — используется индикаторами состояний,
 * зонами и журналом событий.
 */

/** Визуальный тон индикатора (цвет задаются в SCSS по модификатору тона). */
export type StateTone = 'ok' | 'warn' | 'danger' | 'accent' | 'neutral' | 'info';

export interface StateMeta {
    label: string;
    tone: StateTone;
}

export const SECURITY_STATES: Record<SecurityAlarmState, StateMeta> = {
    armed: {label: 'Под охраной', tone: 'accent'},
    disarmed: {label: 'Снята с охраны', tone: 'neutral'},
    alarm: {label: 'Тревога', tone: 'danger'},
    fault: {label: 'Неисправность', tone: 'warn'},
};

export const FIRE_STATES: Record<FireAlarmState, StateMeta> = {
    normal: {label: 'Норма', tone: 'ok'},
    alarm: {label: 'Тревога', tone: 'danger'},
    fault: {label: 'Неисправность', tone: 'warn'},
    maintenance: {label: 'Обслуживание', tone: 'info'},
};

export const CONNECTION_STATES: Record<ConnectionState, StateMeta> = {
    online: {label: 'Установлена', tone: 'ok'},
    unstable: {label: 'Неустойчивая', tone: 'warn'},
    offline: {label: 'Нет связи', tone: 'danger'},
};

export const KIND_NAMES = {
    security: 'Охранная сигнализация',
    fire: 'Пожарная сигнализация',
    connection: 'Связь с объектом',
} as const;

/** Подписи систем для зон (короткая форма). */
export const ZONE_SYSTEM_NAMES: Record<ZoneSystem, string> = {
    security: 'Охранная',
    fire: 'Пожарная',
};

/** Подпись и тон для значения состояния конкретной системы. */
export const getStateMeta = (
    kind: 'security' | 'fire' | 'connection',
    value: SecurityAlarmState | FireAlarmState | ConnectionState,
): StateMeta => {
    if (kind === 'security') {
        return SECURITY_STATES[value as SecurityAlarmState];
    }
    if (kind === 'fire') {
        return FIRE_STATES[value as FireAlarmState];
    }
    return CONNECTION_STATES[value as ConnectionState];
};
