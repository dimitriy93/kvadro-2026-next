'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect, useState} from 'react';
import {breadcrumbTitles} from '../config/breadcrumbs.data';
import {BreadcrumbsSeparator} from './breadcrumbs-separator.ui';
import './breadcrumbs.styles.scss';

type Crumb = {
    href: string;
    label: string;
};

type BreadcrumbsProps = {
    /**
     * Название текущей страницы.
     *
     * Для обычных страниц может передаваться из page.tsx.
     * Для статей заголовок подтягивается автоматически из `meta.ts`
     * через серверный адаптер `/api/articles/[slug]`.
     */
    currentTitle?: string;
};

/** Префикс маршрута отдельной статьи (`/articles/<slug>`). */
const ARTICLE_PATH_PREFIX = '/articles/';

/**
 * Извлекает slug из пути `/articles/:slug` или возвращает `null`,
 * если путь не относится к странице конкретной статьи.
 */
function getArticleSlug(pathname: string): string | null {
    if (!pathname.startsWith(ARTICLE_PATH_PREFIX)) {
        return null;
    }

    const slug = decodeURIComponent(pathname.slice(ARTICLE_PATH_PREFIX.length));

    // На странице самого списка статей (`/articles`) slug нет,
    // а во вложенных путях — не статья.
    if (!slug || slug.includes('/')) {
        return null;
    }

    return slug;
}

export const Breadcrumbs = ({currentTitle}: BreadcrumbsProps) => {
    const pathname = usePathname();

    // Title статьи, полученный из meta.ts через серверный адаптер.
    // null — статья не найдена/неопубликована → используем существующий fallback.
    const [articleTitle, setArticleTitle] = useState<string | null>(null);

    useEffect(() => {
        const slug = getArticleSlug(pathname);

        if (!slug) {
            setArticleTitle(null);
            return;
        }

        let cancelled = false;

        fetch(`/api/articles/${encodeURIComponent(slug)}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((data: {title?: string | null} | null) => {
                if (cancelled) {
                    return;
                }

                const title = data?.title;
                setArticleTitle(typeof title === 'string' && title.length > 0 ? title : null);
            })
            .catch(() => {
                if (!cancelled) {
                    setArticleTitle(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [pathname]);

    if (pathname === '/') {
        return null;
    }

    const segments = pathname
        .split('/')
        .filter(Boolean);

    const crumbs: Crumb[] = [
        {
            href: '/',
            label: 'Главная',
        },
    ];

    let currentPath = '';

    segments.forEach((segment, index) => {
        currentPath += `/${segment}`;

        const isLast = index === segments.length - 1;

        let label: string;

        if (isLast && (currentTitle ?? articleTitle)) {
            label = currentTitle ?? (articleTitle as string);
        } else {
            label =
                breadcrumbTitles[currentPath] ??
                decodeURIComponent(segment);
        }

        crumbs.push({
            href: currentPath,
            label,
        });
    });

    return (
        <nav
            className="breadcrumbs"
            aria-label="Хлебные крошки"
        >
            <ol className="breadcrumbs__list">
                {crumbs.map((crumb, index) => {
                    const isLast = index === crumbs.length - 1;

                    return (
                        <li
                            key={crumb.href}
                            className="breadcrumbs__item"
                        >
                            {isLast ? (
                                <span
                                    className="breadcrumbs__current"
                                    aria-current="page"
                                >
                                    {crumb.label}
                                </span>
                            ) : (
                                <>
                                    <Link
                                        href={crumb.href}
                                        className="breadcrumbs__link"
                                    >
                                        {crumb.label}
                                    </Link>

                                    <BreadcrumbsSeparator className="breadcrumbs__separator"/>
                                </>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};