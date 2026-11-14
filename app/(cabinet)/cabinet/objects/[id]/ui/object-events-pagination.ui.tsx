'use client';
import Link from 'next/link';
import {useLinkStatus} from 'next/link';
import {useRouter} from 'next/navigation';
import type {ChangeEvent, ReactNode} from 'react';
import {DEFAULT_EVENT_PAGE_SIZE, EVENT_PAGE_SIZES} from './object-events-pagination.shared';

/**
 * Пагинация журнала событий (E7.3.2). Источник данных (GEORITM
 * alerts/history-by-obj/) возвращает журнал целиком без серверных
 * offset/limit, поэтому разбивка выполняется на стороне приложения:
 * серверная страница режет уже отсортированный массив, а страница и
 * размер хранятся в URL (?page=, ?size=) — ссылка передаётся и
 * восстанавливается после обновления, Back/Forward работают нативно.
 *
 * Значения URL-параметров валидирует серверная страница; здесь приходят
 * уже нормализованные числа.
 */

export {DEFAULT_EVENT_PAGE_SIZE, EVENT_PAGE_SIZES};

interface IObjectEventsPaginationProps {
    /** Базовый маршрут журнала, например /cabinet/objects/13/events. */
    basePath: string;
    /** Активный фильтр ?type= (без ключа) или пустая строка — «Все». */
    activeType: string;
    page: number;
    pageSize: number;
    pageCount: number;
    /** Общее количество записей журнала после фильтрации. */
    total: number;
}

/** Собирает href журнала с фильтром и пагинацией; значения по умолчанию в URL не попадают. */
const eventsHref = (basePath: string, activeType: string, page: number, pageSize: number): string => {
    const params = new URLSearchParams();
    if (activeType) {
        params.set('type', activeType);
    }
    if (page > 1) {
        params.set('page', String(page));
    }
    if (pageSize !== DEFAULT_EVENT_PAGE_SIZE) {
        params.set('size', String(pageSize));
    }
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
};

/**
 * Содержимое ссылки с pending-индикатором. useLinkStatus обязан вызываться
 * в потомке <Link> (см. объект-чипы фильтра): loading.tsx при смене только
 * search-параметров не срабатывает, поэтому обратная связь — на самой кнопке.
 */
const PageNavLinkContent = ({children, pending}: {children: ReactNode; pending: boolean}) => (
    <span className={`obj-page-nav__content${pending ? ' obj-page-nav__content--pending' : ''}`}>
        {children}
    </span>
);

const PageNavLink = ({href, label, disabled, children}: {
    href: string;
    label: string;
    disabled: boolean;
    children: ReactNode;
}) => {
    if (disabled) {
        return (
            <span className="obj-page-nav__link obj-page-nav__link--disabled" aria-disabled="true" title={label}>
                {children}
            </span>
        );
    }

    return (
        <Link href={href} prefetch={false} className="obj-page-nav__link" aria-label={label} title={label}>
            <PageNavLinkPending>{children}</PageNavLinkPending>
        </Link>
    );
};

/** Обёртка нужна, чтобы useLinkStatus вызывался внутри <Link>, а не рядом с ним. */
const PageNavLinkPending = ({children}: {children: ReactNode}) => {
    const {pending} = useLinkStatus();
    return <PageNavLinkContent pending={pending}>{children}</PageNavLinkContent>;
};

const ChevronIcon = ({direction}: {direction: 'left' | 'right'}) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`obj-page-nav__icon${direction === 'right' ? ' obj-page-nav__icon--right' : ''}`}
    >
        <polyline points="15 18 9 12 15 6"/>
    </svg>
);

/**
 * Выбор количества записей на странице. Смена размера возвращают журнал
 * на первую страницу (сброс ?page=).
 */
export const ObjectEventsPageSizeSelect = ({basePath, activeType, pageSize}: {
    basePath: string;
    activeType: string;
    pageSize: number;
}) => {
    const router = useRouter();

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        router.push(eventsHref(basePath, activeType, 1, Number(event.target.value)));
    };

    return (
        <label className="obj-page-size">
            <span className="obj-page-size__label">Записей на странице:</span>
            <select
                className="obj-page-size__select"
                value={pageSize}
                onChange={handleChange}
                aria-label="Количество записей на странице"
            >
                {EVENT_PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                ))}
            </select>
        </label>
    );
};

/**
 * Компактная навигация «|<  <<  1 / 17  >>  >|». При одной странице
 * навигация скрывается целиком — самый аккуратный вариант для типового
 * журнала, где страниц обычно немного.
 */
export const ObjectEventsPagination = ({basePath, activeType, page, pageSize, pageCount, total}: IObjectEventsPaginationProps) => {
    if (pageCount <= 1) {
        return null;
    }

    const first = eventsHref(basePath, activeType, 1, pageSize);
    const prev = eventsHref(basePath, activeType, page - 1, pageSize);
    const next = eventsHref(basePath, activeType, page + 1, pageSize);
    const last = eventsHref(basePath, activeType, pageCount, pageSize);

    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    return (
        <nav className="obj-page-nav" aria-label="Страницы журнала событий">
            <span className="obj-page-nav__range">
                Показаны {from}–{to} из {total}
            </span>

            <div className="obj-page-nav__controls">
                <PageNavLink href={first} label="Перейти на первую страницу" disabled={page <= 1}>
                    <span className="obj-page-nav__first" aria-hidden="true">
                        <ChevronIcon direction="left"/><span className="obj-page-nav__bar"/>
                    </span>
                </PageNavLink>
                <PageNavLink href={prev} label="Предыдущая страница" disabled={page <= 1}>
                    <ChevronIcon direction="left"/>
                </PageNavLink>

                <span className="obj-page-nav__status" aria-label={`Страница ${page} из ${pageCount}`}>
                    {page}&nbsp;/&nbsp;{pageCount}
                </span>

                <PageNavLink href={next} label="Следующая страница" disabled={page >= pageCount}>
                    <ChevronIcon direction="right"/>
                </PageNavLink>
                <PageNavLink href={last} label="Перейти на последнюю страницу" disabled={page >= pageCount}>
                    <span className="obj-page-nav__first" aria-hidden="true">
                        <span className="obj-page-nav__bar"/><ChevronIcon direction="right"/>
                    </span>
                </PageNavLink>
            </div>
        </nav>
    );
};
