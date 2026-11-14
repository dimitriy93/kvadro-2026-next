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
import {DEFAULT_EVENT_PAGE_SIZE, EVENT_PAGE_SIZES} from '../ui/object-events-pagination.shared';

type ObjectEventsPageProps = {
    params: Promise<{id: string}>;
    searchParams: Promise<{type?: string; page?: string; size?: string}>;
};

async function loadOwnedObject(objectId: string) {
    const user = await getSessionUser();

    if (!user) {
        redirect(cabinet.login.href);
    }

    // Чужой и несуществующий объект одинаково дают null → 404 без раскрытия.
    // userId — namespace пользовательских настроек разделов (E7.3.5).
    const object = await findObjectForUser(user.id, objectId);

    return object ? {object, userId: user.id} : null;
}

/**
 * Нормализация параметров пагинации (E7.3.2): некорректные значения
 * молча заменяются значениями по умолчанию, а выход за последнюю
 * страницу — перенаправлением на последнюю доступную (записи могли
 * добавиться или удалиться после того, как ссылка была сохранена).
 */
const parsePageParam = (value: string | undefined): number => {
    const parsed = Number(value);
    return value !== undefined && Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
};

const parseSizeParam = (value: string | undefined): number => {
    const parsed = Number(value);
    return value !== undefined
        && Number.isInteger(parsed)
        && (EVENT_PAGE_SIZES as readonly number[]).includes(parsed)
        ? parsed
        : DEFAULT_EVENT_PAGE_SIZE;
};

export async function generateMetadata({params}: ObjectEventsPageProps): Promise<Metadata> {
    const {id} = await params;
    const owned = await loadOwnedObject(id);

    return owned ? {title: `${owned.object.name} — события`} : {};
}

export default async function ObjectEventsPage({params, searchParams}: ObjectEventsPageProps) {
    const [{id}, query] = await Promise.all([params, searchParams]);
    const owned = await loadOwnedObject(id);

    if (!owned) {
        notFound();
    }

    const {object, userId} = owned;

    // Недопустимое значение фильтра игнорируется — показываются все события.
    const eventType =
        typeof query.type === 'string' && isKnownEventType(query.type) ? query.type : undefined;

    const allEvents = await getEventsForObject(object.id);
    // null — источник данных пока не поддерживает журнал событий
    // (методы alerts/* GEORITM не проверены). Это не «событий нет».
    const eventsUnavailable = allEvents === null;
    const filtered = eventsUnavailable
        ? []
        : eventType
            ? allEvents.filter((event) => event.type === eventType)
            : allEvents;
    const availableTypes = eventsUnavailable
        ? []
        : DEMO_EVENT_FILTER_ORDER.filter((type) =>
            allEvents.some((event) => event.type === type),
        );

    const basePath = `/cabinet/objects/${object.id}/events`;
    const pageSize = parseSizeParam(query.size);
    const pageCount = Math.ceil(filtered.length / pageSize);
    const requestedPage = parsePageParam(query.page);

    // Текущая страница недоступна (устаревшая ссылка, сменённый фильтр или
    // размер страницы) — корректно переходим на последнюю доступную.
    const page = Math.min(requestedPage, Math.max(pageCount, 1));
    if (requestedPage > page) {
        redirect(`${basePath}?page=${page}${pageSize !== DEFAULT_EVENT_PAGE_SIZE ? `&size=${pageSize}` : ''}${eventType ? `&type=${eventType}` : ''}`);
    }

    const pageSlice = filtered.slice((page - 1) * pageSize, page * pageSize);

    return (
        <ObjectEventsView
            object={object}
            userId={userId}
            events={pageSlice}
            totalEvents={filtered.length}
            availableTypes={availableTypes}
            activeType={eventType}
            pagination={{
                basePath,
                activeType: eventType ?? '',
                page,
                pageSize,
                pageCount,
                total: filtered.length,
            }}
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
