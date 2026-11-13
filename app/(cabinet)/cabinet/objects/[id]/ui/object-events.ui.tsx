import Link from 'next/link';
import type {DemoEventType, DemoMonitorObject, DemoObjectEvent} from '@/lib/account';
import {cabinetObjectRoute} from '@/config/routes/cabinet.routes';
import {ObjectPageHeader} from './object-page-header.ui';
import {formatDateTime} from '@/app/(cabinet)/cabinet/ui/format';
import type {StateTone} from '@/app/(cabinet)/cabinet/ui/state-meta';
import './object-events.styles.scss';

interface IObjectEventsViewProps {
    object: DemoMonitorObject;
    /** Отфильтрованные события (от новых к старым). */
    events: DemoObjectEvent[];
    /** Типы, встречающиеся в полном журнале объекта — для чипов фильтра. */
    availableTypes: readonly DemoEventType[];
    /** Активный тип фильтра; undefined — «Все». */
    activeType?: DemoEventType;
}

const EVENT_META: Record<DemoEventType, {label: string; tone: StateTone}> = {
    security_armed: {label: 'Охрана: под охрану', tone: 'accent'},
    security_disarmed: {label: 'Охрана: снята', tone: 'neutral'},
    security_alarm: {label: 'Охрана: тревога', tone: 'danger'},
    security_fault: {label: 'Охрана: неисправность', tone: 'warn'},
    fire_alarm: {label: 'Пожарная: тревога', tone: 'danger'},
    fire_fault: {label: 'Пожарная: неисправность', tone: 'warn'},
    fire_maintenance: {label: 'Пожарная: обслуживание', tone: 'info'},
    connection_lost: {label: 'Связь: потеря', tone: 'danger'},
    connection_restored: {label: 'Связь: восстановление', tone: 'ok'},
    system: {label: 'Система', tone: 'info'},
};

/** Порядок типов в фильтре. */
export const DEMO_EVENT_FILTER_ORDER: readonly DemoEventType[] = [
    'security_armed',
    'security_disarmed',
    'security_alarm',
    'security_fault',
    'fire_alarm',
    'fire_fault',
    'fire_maintenance',
    'connection_lost',
    'connection_restored',
    'system',
];

/**
 * Журнал событий объекта. Демонстрационные записи от новых к старым;
 * фильтр по типу — серверный, через query-параметр ?type=.
 */
export const ObjectEventsView = ({object, events, availableTypes, activeType}: IObjectEventsViewProps) => {
    const routes = cabinetObjectRoute(object.id);

    return (
        <>
            <ObjectPageHeader object={object} activeTab="events"/>

            <section className="obj-section" aria-label="Журнал событий">
                <div className="obj-events__head">
                    <h2 className="obj-section__title">Журнал событий</h2>
                    <span className="obj-events__count">Записей: {events.length}</span>
                </div>

                <div className="obj-events__filters" role="group" aria-label="Фильтр по типу события">
                    <Link
                        href={routes.events}
                        className={`obj-chip${!activeType ? ' obj-chip--active' : ''}`}
                        aria-current={!activeType ? 'true' : undefined}
                    >
                        Все
                    </Link>
                    {availableTypes.map((type) => (
                        <Link
                            key={type}
                            href={`${routes.events}?type=${type}`}
                            className={`obj-chip${activeType === type ? ' obj-chip--active' : ''}`}
                            aria-current={activeType === type ? 'true' : undefined}
                        >
                            {EVENT_META[type].label}
                        </Link>
                    ))}
                </div>

                {events.length === 0 ? (
                    <p className="obj-empty">
                        {activeType
                            ? 'Событий выбранного типа пока нет.'
                            : 'Журнал событий этого объекта пуст.'}
                    </p>
                ) : (
                    <ol className="obj-events__list">
                        {events.map((event) => {
                            const meta = EVENT_META[event.type];

                            return (
                                <li key={event.id} className="obj-event">
                                    <time className="obj-event__time" dateTime={event.occurredAt}>
                                        {formatDateTime(event.occurredAt)}
                                    </time>

                                    <div className="obj-event__body">
                                        <span className={`obj-event__type acc-state--${meta.tone}`}>
                                            <span className="obj-event__dot" aria-hidden="true"/>
                                            {meta.label}
                                        </span>

                                        <p className="obj-event__message">{event.message}</p>

                                        {event.zoneName && (
                                            <span className="obj-event__zone">Зона: {event.zoneName}</span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}

                <p className="obj-events__note">
                    Журнал сформирован из демонстрационных данных и не отражает
                    показания реальной системы мониторинга.
                </p>
            </section>
        </>
    );
};
