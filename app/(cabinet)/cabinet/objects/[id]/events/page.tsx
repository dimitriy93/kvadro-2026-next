import {Metadata} from 'next';
import {notFound, redirect} from 'next/navigation';
import {
    findDemoObjectForUser,
    getDemoEventsForObject,
    getSessionUser,
    isDemoEventType,
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

    return findDemoObjectForUser(user.id, objectId);
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
        typeof query.type === 'string' && isDemoEventType(query.type) ? query.type : undefined;

    const allEvents = getDemoEventsForObject(object.id);
    const events = eventType
        ? allEvents.filter((event) => event.type === eventType)
        : allEvents;
    const availableTypes = DEMO_EVENT_FILTER_ORDER.filter((type) =>
        allEvents.some((event) => event.type === type),
    );

    return <ObjectEventsView object={object} events={events} availableTypes={availableTypes} activeType={eventType}/>;
}
