import {Metadata} from 'next';
import {notFound, redirect} from 'next/navigation';
import {
    findObjectForUser,
    getAccountDataSource,
    getEventsForObject,
    getSessionUser,
    isKnownEventType,
} from '@/lib/account';
import {cabinet} from '@/config/routes/cabinet.routes';
import {DEMO_EVENT_FILTER_ORDER, ObjectEventsView} from '../ui/object-events.ui';

type ObjectEventsPageProps = {
    params: Promise<{id: string}>;
    searchParams: Promise<{type?: string}>;
};

async function loadOwnedObject(objectId: string) {
    const user = await getSessionUser();

    if (!user) {
        redirect(cabinet.login.href);
    }

    return findObjectForUser(user.id, objectId);
}

export async function generateMetadata({params}: ObjectEventsPageProps): Promise<Metadata> {
    const {id} = await params;
    const object = await loadOwnedObject(id);

    return object ? {title: `${object.name} — события`} : {};
}

export default async function ObjectEventsPage({params, searchParams}: ObjectEventsPageProps) {
    const [{id}, query] = await Promise.all([params, searchParams]);
    const object = await loadOwnedObject(id);

    if (!object) {
        notFound();
    }

    // Недопустимое значение фильтра игнорируется — показываются все события.
    const eventType =
        typeof query.type === 'string' && isKnownEventType(query.type) ? query.type : undefined;

    const allEvents = await getEventsForObject(object.id);
    // null — источник данных пока не поддерживает журнал событий
    // (методы alerts/* GEORITM не проверены). Это не «событий нет».
    const eventsUnavailable = allEvents === null;
    const events = eventsUnavailable
        ? []
        : eventType
            ? allEvents.filter((event) => event.type === eventType)
            : allEvents;
    const availableTypes = eventsUnavailable
        ? []
        : DEMO_EVENT_FILTER_ORDER.filter((type) =>
            allEvents.some((event) => event.type === type),
        );

    return (
        <ObjectEventsView
            object={object}
            events={events}
            availableTypes={availableTypes}
            activeType={eventType}
            unavailableNote={eventsUnavailable
                ? 'Журнал событий для этого источника данных пока не подключён.'
                : undefined}
            footerNote={getAccountDataSource() === 'demo'
                ? 'Журнал сформирован из демонстрационных данных и не отражает показания реальной системы мониторинга.'
                : undefined}
            isDemoData={getAccountDataSource() === 'demo'}
        />
    );
}
