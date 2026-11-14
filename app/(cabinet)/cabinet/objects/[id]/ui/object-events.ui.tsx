import type {MonitorEventType, MonitorObject, MonitorObjectEvent} from '@/lib/account';
import {cabinetObjectRoute} from '@/config/routes/cabinet.routes';
import {ObjectPageHeader} from './object-page-header.ui';
import {ObjectEventsFilters, type IObjectEventsFilterItem} from './object-events-filters.ui';
import {formatDateTime} from '@/app/(cabinet)/cabinet/ui/format';
import type {StateTone} from '@/app/(cabinet)/cabinet/ui/state-meta';
import './object-events.styles.scss';

interface IObjectEventsViewProps {
    object: MonitorObject;
    /** Отфильтрованные события (от новых к старым). */
    events: MonitorObjectEvent[];
    /** Типы, встречающиеся в полном журнале объекта — для чипов фильтра. */
    availableTypes: readonly MonitorEventType[];
    /** Активный тип фильтра; undefined — «Все». */
    activeType?: MonitorEventType;
    /** Журнал недоступен у текущего источника данных (не «пустой журнал»). */
    unavailableNote?: string;
    /** Примечание в подвале страницы; текст задаёт серверная страница. */
    footerNote?: string;
    /** true — демонстрационный источник данных; false — реальные данные GEORITM. */
    isDemoData: boolean;
}

const EVENT_META: Record<MonitorEventType, {label: string; tone: StateTone}> = {
    security_armed: {label: 'Охрана: под охрану', tone: 'accent'},
    security_disarmed: {label: 'Охрана: снята', tone: 'neutral'},
    security_alarm: {label: 'Охрана: тревога', tone: 'danger'},
    security_fault: {label: 'Охрана: неисправность', tone: 'warn'},
    fire_alarm: {label: 'Пожарная: тревога', tone: 'danger'},
    fire_fault: {label: 'Пожарная: неисправность', tone: 'warn'},
    fire_maintenance: {label: 'Пожарная: обслуживание', tone: 'info'},
    connection_lost: {label: 'Связь: потеря', tone: 'danger'},
    connection_restored: {label: 'Связь: восстановление', tone: 'ok'},
    restored: {label: 'Восстановление', tone: 'ok'},
    system: {label: 'Система', tone: 'info'},
};

/** Порядок типов в фильтре. */
export const DEMO_EVENT_FILTER_ORDER: readonly MonitorEventType[] = [
    'security_armed',
    'security_disarmed',
    'security_alarm',
    'security_fault',
    'fire_alarm',
    'fire_fault',
    'fire_maintenance',
    'connection_lost',
    'connection_restored',
    'restored',
    'system',
];

/**
 * Журнал событий объекта. Демонстрационные записи от новых к старым;
 * фильтр по типу — серверный, через query-параметр ?type=.
 */
export const ObjectEventsView = ({object, events, availableTypes, activeType, unavailableNote, footerNote, isDemoData}: IObjectEventsViewProps) => {
    const routes = cabinetObjectRoute(object.id);

    // Чипы фильтра собираются на сервере (подписи из EVENT_META), а навигация
    // и pending-состояние обрабатываются клиентским ObjectEventsFilters.
    const filterItems: IObjectEventsFilterItem[] = [
        {href: routes.events, label: 'Все', active: !activeType},
        ...availableTypes.map((type) => ({
            href: `${routes.events}?type=${type}`,
            label: EVENT_META[type].label,
            active: activeType === type,
        })),
    ];

    return (
        <>
            <ObjectPageHeader object={object} activeTab="events" isDemoData={isDemoData}/>

            <section className="obj-section" aria-label="Журнал событий">
                <div className="obj-events__head">
                    <h2 className="obj-section__title">Журнал событий</h2>
                    <span className="obj-events__count">Записей: {events.length}</span>
                </div>

                <ObjectEventsFilters items={filterItems}/>

                {unavailableNote && (
                    <p className="obj-empty" role="status">
                        {unavailableNote}
                    </p>
                )}

                {!unavailableNote && (events.length === 0 ? (
                    <p className="obj-empty">
                        {activeType
                            ? 'Событий выбранного типа пока нет.'
                            : 'Журнал событий этого объекта пуст.'}
                    </p>
                ) : (
                    <ol className="obj-events__list">
                        {events.map((event) => {
                            const meta = EVENT_META[event.type];
                            // Действие пользователя отображается своей меткой
                            // независимо от типа записи (тип у действия 'system').
                            const tone: StateTone = event.isUserAction ? 'info' : meta.tone;
                            const label = event.isUserAction ? 'Действие оператора' : meta.label;
                            // Время получения показываем, только если оно
                            // заметно отличается от времени события (у событий
                            // GEORITM задержка обычно 0–4 секунды, а заметный
                            // разрыв — импортированные записи).
                            const receivedLater = event.receivedAt !== undefined
                                && Math.abs(
                                    new Date(event.receivedAt).getTime() - new Date(event.occurredAt).getTime(),
                                ) >= 60_000;

                            return (
                                <li key={event.id} className="obj-event">
                                    <time className="obj-event__time" dateTime={event.occurredAt}>
                                        {formatDateTime(event.occurredAt)}
                                    </time>

                                    <div className="obj-event__body">
                                        <span className={`obj-event__type acc-state--${tone}`}>
                                            <span className="obj-event__dot" aria-hidden="true"/>
                                            {label}
                                        </span>

                                        <p className="obj-event__message">{event.message}</p>

                                        {(event.zoneName || (event.code && !event.isUserAction) || event.userName) && (
                                            <span className="obj-event__tags">
                                                {event.zoneName && (
                                                    <span className="obj-event__zone">Зона: {event.zoneName}</span>
                                                )}
                                                {event.code && !event.isUserAction && (
                                                    <span className="obj-event__zone">Код: {event.code}</span>
                                                )}
                                                {event.userName && (
                                                    <span className="obj-event__zone">Оператор: {event.userName}</span>
                                                )}
                                            </span>
                                        )}

                                        {receivedLater && (
                                            <span className="obj-event__received">
                                                Получено станцией: {formatDateTime(event.receivedAt)}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                ))}

                {footerNote && (
                    <p className="obj-events__note">{footerNote}</p>
                )}
            </section>
        </>
    );
};
