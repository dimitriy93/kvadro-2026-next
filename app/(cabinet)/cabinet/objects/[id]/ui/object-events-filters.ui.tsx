'use client';
import Link from 'next/link';
import {useLinkStatus} from 'next/link';

export interface IObjectEventsFilterItem {
    href: string;
    label: string;
    active: boolean;
}

/**
 * Содержимое чипа. useLinkStatus обязан вызываться в компоненте-потомке
 * <Link> (так устроен контекст хука, см. документацию Next.js): pending
 * активен, пока сервер готовит новый список по ?type=. loading.tsx при
 * смене только search-параметров не срабатывает, поэтому обратная связь —
 * прямо на чипе, а прежний список остаётся на месте — без скачков layout.
 */
const ObjectEventChipContent = ({label}: {label: string}) => {
    const {pending} = useLinkStatus();

    return (
        <span
            className={`obj-chip__content${pending ? ' obj-chip__content--pending' : ''}`}
            aria-busy={pending || undefined}
        >
            {label}
            {pending && <span className="obj-chip__spinner" aria-hidden="true"/>}
        </span>
    );
};

/**
 * Чип фильтра. prefetch={false} обязателен: у префетченного маршрута
 * useLinkStatus пропускает pending-состояние (документация Next.js), а
 * eager-префетч каждого чипа вызывал бы лишние серверные рендеры страницы
 * и запросы к источнику данных.
 */
const ObjectEventFilterChip = ({item}: {item: IObjectEventsFilterItem}) => (
    <Link
        href={item.href}
        prefetch={false}
        className={`obj-chip${item.active ? ' obj-chip--active' : ''}`}
        aria-current={item.active ? 'true' : undefined}
    >
        <ObjectEventChipContent label={item.label}/>
    </Link>
);

interface IObjectEventsFiltersProps {
    /** Чипы «Все» + присутствующие в журнале типы, в порядке DEMO_EVENT_FILTER_ORDER. */
    items: IObjectEventsFilterItem[];
}

export const ObjectEventsFilters = ({items}: IObjectEventsFiltersProps) => (
    <div className="obj-events__filters" role="group" aria-label="Фильтр по типу события">
        {items.map((item) => (
            <ObjectEventFilterChip key={item.href} item={item}/>
        ))}
    </div>
);
