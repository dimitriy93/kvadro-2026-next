import type {
    ConnectionState,
    FireAlarmState,
    SecurityAlarmState,
} from '@/lib/account';
import {
    KIND_NAMES,
    getStateMeta,
    type StateMeta,
} from './state-meta';
import './object-state-badge.styles.scss';

export type ObjectStateKind = keyof typeof KIND_NAMES;

interface IObjectStateBadgeProps {
    kind: ObjectStateKind;
    value: SecurityAlarmState | FireAlarmState | ConnectionState;
    /** Скрыть название системы (для строк зон, где название — в соседней колонке). */
    showName?: boolean;
}

/** Индикатор состояния: цветная точка + название системы + значение. */
export const ObjectStateBadge = ({kind, value, showName = true}: IObjectStateBadgeProps) => {
    const meta: StateMeta = getStateMeta(kind, value);

    return (
        <span className={`acc-state acc-state--${meta.tone}`}>
            <span className="acc-state__dot" aria-hidden="true"/>
            {showName && <span className="acc-state__name">{KIND_NAMES[kind]}</span>}
            <span className="acc-state__value">{meta.label}</span>
        </span>
    );
};
