'use client';

import Link from 'next/link';
import {breadcrumbTitles} from '../config/breadcrumbs.data';
import {usePathname} from 'next/navigation';
import {BreadcrumbsSeparator} from './breadcrumbs-separator.ui';
import './breadcrumbs.styles.scss';

type Crumb = {
    href: string;
    label: string;
};

export const Breadcrumbs = () => {
    const pathname = usePathname();

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

    segments.forEach((segment) => {
        currentPath += `/${segment}`;

        crumbs.push({
            href: currentPath,
            label:
                breadcrumbTitles[currentPath] ??
                decodeURIComponent(segment),
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
                                <span className="breadcrumbs__current" aria-current="page">
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