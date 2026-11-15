import {Metadata} from 'next';
import {notFound, redirect} from 'next/navigation';
import {
    decodeEventCursor,
    encodeEventCursor,
    findObjectForUser,
    getAccountDataSource,
    getSessionSecret,
    getSessionUser,
    getEventsPageForObject,
    isKnownEventType,
    type EventCursorPayload,
} from '@/lib/account';
import {cabinet} from '@/config/routes/cabinet.routes';
import {DEMO_EVENT_FILTER_ORDER, ObjectEventsView} from '../ui/object-events.ui';
import {DEFAULT_EVENT_PAGE_SIZE, EVENT_PAGE_SIZES} from '../ui/object-events-pagination.shared';

type ObjectEventsPageProps = {
    params: Promise<{id: string}>;
    searchParams: Promise<{type?: string; page?: string; size?: string; c?: string}>;
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
 * молча заменяются значениями по умолчанию.
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

    const {object} = owned;

    // Недопустимое значение фильтра игнорируется — показываются все события.
    const eventType =
        typeof query.type === 'string' && isKnownEventType(query.type) ? query.type : undefined;

    const basePath = `/cabinet/objects/${object.id}/events`;
    const pageSize = parseSizeParam(query.size);
    const page = parsePageParam(query.page);
    const cursorToken = typeof query.c === 'string' && query.c.length > 0 ? query.c : null;
    const cursorTypeKey = eventType ?? '';

    // Параметры в URL, при которых позиция не имеет смысла, канонизируются
    // на первую страницу: страница 1 якоря не имеет по определению, а сам
    // якорь проверяется подписью и привязкой к объекту/фильтру ниже.
    if (cursorToken !== null && page === 1) {
        redirect(buildEventsHref(basePath, eventType, 1, pageSize));
    }
    // Страница без якоря — всегда первая: позиция без якоря невосстановима,
    // фиктивный пересчёт цепочки страниц не выполняется.
    if (cursorToken === null && page > 1) {
        redirect(buildEventsHref(basePath, eventType, 1, pageSize));
    }

    const cursor: EventCursorPayload | null = cursorToken === null
        ? null
        : decodeEventCursor(cursorToken, getSessionSecret(), {objectId: object.id, eventType: cursorTypeKey});

    // Некорректный или чужой якорь (в том числе от другого фильтра) —
    // молча возвращаемся на первую страницу: причина пользователю не
    // раскрывается, фиксация «страница не существует» не делается.
    if (cursorToken !== null && cursor === null) {
        redirect(buildEventsHref(basePath, eventType, 1, pageSize));
    }

    const result = await getEventsPageForObject(
        object.id,
        pageSize,
        eventType,
        cursor === null ? null : {t: cursor.t, skip: cursor.skip},
        cursor === null ? 'older' : cursor.direction,
    );

    // «Предыдущая» от первой страницы контента (якорь оказался выше
    // начала журнала) — канонический URL без якоря.
    if (cursor !== null && cursor.direction === 'newer' && result.events.length < pageSize) {
        redirect(buildEventsHref(basePath, eventType, 1, pageSize));
    }

    // Чипы фильтра: источник отдаёт типы, встречающиеся в журнале; порядок —
    // общий справочник типов. Если источник вернул пусто (холодный кэш
    // GEORITM на страницах 2+), остаётся «Все» и активный тип.
    const availableTypes = result.availableTypes.length > 0
        ? DEMO_EVENT_FILTER_ORDER.filter((type) => result.availableTypes.includes(type))
        : eventType
            ? [eventType]
            : [];

    const nextCursorPayload: EventCursorPayload | null = result.hasMore && result.bottomCursor !== null
        ? {
            t: result.bottomCursor.t,
            skip: result.bottomCursor.skip,
            objectId: object.id,
            eventType: cursorTypeKey,
            direction: 'older',
        }
        : null;
    const upperCursorPayload: EventCursorPayload | null = page > 1 && result.upperCursor !== null
        ? {
            t: result.upperCursor.t,
            skip: result.upperCursor.skip,
            objectId: object.id,
            eventType: cursorTypeKey,
            direction: 'newer',
        }
        : null;

    const secret = getSessionSecret();
    const nextHref = nextCursorPayload && secret
        ? `${buildEventsHref(basePath, eventType, page + 1, pageSize, true)}&c=${encodeEventCursor(nextCursorPayload, secret)}`
        : null;
    const prevHref = upperCursorPayload && secret
        ? page - 1 === 1
            ? buildEventsHref(basePath, eventType, 1, pageSize)
            : `${buildEventsHref(basePath, eventType, page - 1, pageSize, true)}&c=${encodeEventCursor(upperCursorPayload, secret)}`
        : null;

    const shown = result.events.length;
    const rangeFrom = shown > 0 ? (page - 1) * pageSize + 1 : 0;
    const rangeTo = shown > 0 ? (page - 1) * pageSize + shown : 0;

    return (
        <ObjectEventsView
            object={object}
            userId={owned.userId}
            events={result.events}
            totalEvents={result.totalEvents}
            availableTypes={availableTypes}
            activeType={eventType}
            footerNote={getAccountDataSource() === 'demo'
                ? 'Журнал сформирован из демонстрационных данных и не отражает показания реальной системы мониторинга.'
                : undefined}
            isDemoData={getAccountDataSource() === 'demo'}
            refreshHref={buildEventsHref(basePath, eventType, 1, pageSize)}
            depthLimitedNote={result.depthLimited
                ? 'Загрузка остановлена ограничением глубины поиска по журналу; более старые записи могут существовать.'
                : undefined}
            pagination={{
                page,
                pageSize,
                shown,
                hasMore: result.hasMore,
                total: result.totalEvents,
                prevHref,
                nextHref,
                rangeFrom,
                rangeTo,
                basePath,
                activeType: eventType ?? '',
            }}
        />
    );
}

/** Ссылка журнала: фильтр, страница и размер; значения по умолчанию в URL не попадают. */
const buildEventsHref = (
    basePath: string,
    eventType: string | undefined,
    page: number,
    pageSize: number,
    forcePage = false,
): string => {
    const params = new URLSearchParams();
    if (eventType) {
        params.set('type', eventType);
    }
    if (page > 1 || forcePage) {
        params.set('page', String(page));
    }
    if (pageSize !== DEFAULT_EVENT_PAGE_SIZE) {
        params.set('size', String(pageSize));
    }
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
};
