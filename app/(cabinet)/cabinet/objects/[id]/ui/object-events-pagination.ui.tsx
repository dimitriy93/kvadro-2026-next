'use client';
import Link from 'next/link';
import {useLinkStatus} from 'next/link';
import {useRouter} from 'next/navigation';
import type {ChangeEvent, ReactNode} from 'react';
import {DEFAULT_EVENT_PAGE_SIZE, EVENT_PAGE_SIZES} from './object-events-pagination.shared';

/**
 * Пагинация журнала событий (E7.3.2, постраничная загрузка E10). Источник
 * (GEORITM) не предоставляет offset/total, поэтому страницы выбираются
 * порциями от якорной границы: страница и размер хранятся в URL
 * (?page=, ?size=), позиция — в подписанном якоре ?c=, который выдаёт
 * серверная страница. Ссылки «предыдущая/следующая» приходят готовыми —
 * якорь кодируется на сервере (секрет в браузер не попадает). Ссылка
 * передаётся и восстанавливается после обновления, Back/Forward работают
 * нативно.
 *
 * Общего количества страниц у GEORITM нет: показывается текущая страница
 * и достоверный ориентир доступности следующей (total отображается только
 * когда источник его знает — демо-режим). Перехода «в конец» нет:
 * последняя страница недостижима без полной загрузки истории.
 */

export {DEFAULT_EVENT_PAGE_SIZE, EVENT_PAGE_SIZES};

interface IObjectEventsPaginationProps {
    /** Текущая страница (нумерация для отображения, с 1). */
    page: number;
    pageSize: number;
    /** Записей показано на текущей странице. */
    shown: number;
    /** Достоверно известно, что есть следующая страница. */
    hasMore: boolean;
    /** Точное общее количество после фильтра или null (GEORITM не даёт total). */
    total: number | null;
    /** Готовые ссылки навигации; null — действие недоступно. */
    prevHref: string | null;
    nextHref: string | null;
    /** Диапазон номеров показанных записей (позиция в журнале). */
    rangeFrom: number;
    rangeTo: number;
    /** Базовый маршрут журнала и активный фильтр — для селектора размера. */
    basePath: string;
    activeType: string;
}

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
    href: string | null;
    label: string;
    disabled: boolean;
    children: ReactNode;
}) => {
    if (disabled || href === null) {
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
 * Выбор количества записей на странице. Смена размера возвращает журнал
 * на первую страницу (позиция без якоря сбрасывается вместе с ?page= и ?c=).
 */
export const ObjectEventsPageSizeSelect = ({basePath, activeType, pageSize}: {
    basePath: string;
    activeType: string;
    pageSize: number;
}) => {
    const router = useRouter();

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const params = new URLSearchParams();
        if (activeType) {
            params.set('type', activeType);
        }
        params.set('size', event.target.value);
        router.push(`${basePath}?${params.toString()}`);
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
 * Компактная навигация «|<  <<  Страница N  >>». При пустой странице
 * навигация скрывается. Без total статус — «Страница N» без общего
 * количества: фиктивное число страниц не показывается.
 */
export const ObjectEventsPagination = ({page, pageSize, shown, hasMore, total, prevHref, nextHref, rangeFrom, rangeTo, basePath, activeType}: IObjectEventsPaginationProps) => {
    if (shown === 0 && page === 1) {
        return null;
    }

    const first = (() => {
        const params = new URLSearchParams();
        if (activeType) {
            params.set('type', activeType);
        }
        if (pageSize !== DEFAULT_EVENT_PAGE_SIZE) {
            params.set('size', String(pageSize));
        }
        const query = params.toString();
        return query ? `${basePath}?${query}` : basePath;
    })();
    const pageCount = total !== null ? Math.max(Math.ceil(total / pageSize), 1) : null;

    return (
        <nav className="obj-page-nav" aria-label="Страницы журнала событий">
            <span className="obj-page-nav__range">
                {shown > 0 ? (
                    <>
                        Показаны {rangeFrom}–{rangeTo}
                        {total !== null ? ` из ${total}` : ''}
                    </>
                ) : (
                    'Записи не найдены'
                )}
            </span>

            <div className="obj-page-nav__controls">
                <PageNavLink href={first} label="Перейти на первую страницу" disabled={page <= 1}>
                    <span className="obj-page-nav__first" aria-hidden="true">
                        <ChevronIcon direction="left"/><span className="obj-page-nav__bar"/>
                    </span>
                </PageNavLink>
                <PageNavLink href={prevHref} label="Предыдущая страница" disabled={page <= 1 || prevHref === null}>
                    <ChevronIcon direction="left"/>
                </PageNavLink>

                <span
                    className="obj-page-nav__status"
                    aria-label={pageCount !== null ? `Страница ${page} из ${pageCount}` : `Страница ${page}`}
                >
                    {pageCount !== null ? (
                        <>{page}&nbsp;/&nbsp;{pageCount}</>
                    ) : (
                        <>Страница&nbsp;{page}</>
                    )}
                </span>

                <PageNavLink href={nextHref} label="Следующая страница" disabled={!hasMore || nextHref === null}>
                    <ChevronIcon direction="right"/>
                </PageNavLink>
            </div>
        </nav>
    );
};
