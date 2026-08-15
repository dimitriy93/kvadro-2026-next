'use client';

import {useEffect, useMemo, useRef, useState, type MouseEvent} from 'react';
import type {ArticleHeading} from '@/lib/articles';
import './article-navigation.styles.scss';

type ArticleNavigationProps = {
    headings: ArticleHeading[];
};

/** Селектор основного текста статьи (точка появления/скрытия на desktop). */
const BODY_SELECTOR = '.article-body';

/** Активная «линия чтения» от верха viewport для desktop scroll-spy.
  *
  * Пункт считается «начатым», когда верх соответствующего H2 поднялся
  * к этой линии (top ≤ offset). Значение намеренно НЕ меньше максимального
  * `scroll-margin-top` заголовков (clamp(100px, 14vh, 140px) ≈ 140px),
  * чтобы клик по пункту «Содержания» (прокрутка к H2 с этим отступом)
  * приводил к тому, что H2 сразу оказывается уже «начатым» → пункт
  * становится активным, как только де-факто прокрутка завершена.
  */
const ACTIVE_ANCHOR_OFFSET = 150;

/**
 * Дополнительный отступ появления панели на desktop.
 * Применяется как отрицательный rootMargin по нижней границе viewport:
 * панель появляется уже после того, как пользователь прокрутил начало
 * `.article-body` ещё примерно на это значение (в пикселях).
 */
const BODY_REVEAL_OFFSET = 80;

/**
 * Клиентская навигация «Содержание» по заголовкам h2 статьи.
 *
 * В навигацию попадают только `level === 2` и только если такие есть.
 *
 * - Desktop: плавающая панель у правого края viewport. Скрыта при открытии,
 *   плавно появляется, когда `.article-body` входит в viewport, и так же
 *   плавно исчезает при возврате выше начала текста.
 * - Mobile/tablet: компактный сворачиваемый блок в потоке страницы
 *   (по умолчанию свёрнут; после перехода по пункту сворачивается сам).
 */
const ArticleNavigation = ({headings}: ArticleNavigationProps) => {
    const items = useMemo(
        () => headings.filter((heading) => heading.level === 2),
        [headings]
    );

    const [visible, setVisible] = useState(false);
    const [collapsed, setCollapsed] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const bodyObserver = useRef<IntersectionObserver | null>(null);
    const panelRef = useRef<HTMLElement | null>(null);
    const activeIdRef = useRef<string | null>(null);

    // Появление sidebar на desktop: считаем факт попадания `.article-body`.
    useEffect(() => {
        const body = document.querySelector<HTMLElement>(BODY_SELECTOR);
        if (!body || typeof IntersectionObserver === 'undefined') {
            return;
        }

        bodyObserver.current = new IntersectionObserver((entries) => {
            setVisible(entries.some((entry) => entry.isIntersecting));
        }, {
            // Отрицательный нижний rootMargin откладывает момент появления:
            // панель показывается, когда начало `.article-body` уже прошло
            // нижнюю границу viewport ещё на BODY_REVEAL_OFFSET px.
            rootMargin: `0px 0px -${BODY_REVEAL_OFFSET}px 0px`,
        });

        bodyObserver.current.observe(body);

        return () => {
            bodyObserver.current?.disconnect();
            bodyObserver.current = null;
        };
    }, []);

    // Активная секция: последний h2, уже пересекший линию чтения
    // (`ACTIVE_ANCHOR_OFFSET` от верха viewport). Работает одинаково при
    // прокрутке вниз и вверх — состояние всегда пересчитывается от реального
    // положения заголовков, поэтому при обратном скролле активность честно
    // возвращается к предыдущему пункту. Значения, не менявшиеся по факту,
    // в state не отправляются (аккуратно, без лишних re-render).
    useEffect(() => {
        if (items.length === 0) {
            if (activeIdRef.current !== null) {
                activeIdRef.current = null;
                setActiveId(null);
            }
            return;
        }

        let frame = 0;

        const update = () => {
            let current: string | null = null;

            // Положение берём относительно viewport (getBoundingClientRect),
            // а не относительно window.scrollY. На этой странице прокручивается
            // `document.body`, поэтому window.scrollY всегда 0 и window-события
            // scroll не приходят — такой способ не зависит от того, какой
            // элемент является настоящим скролл-контейнером.
            for (const heading of items) {
                const el = document.getElementById(heading.id);
                if (!el) {
                    continue;
                }
                // Заголовок «начался», если его верх поднялся не ниже линии чтения.
                if (el.getBoundingClientRect().top <= ACTIVE_ANCHOR_OFFSET) {
                    current = heading.id;
                }
            }

            if (current !== activeIdRef.current) {
                activeIdRef.current = current;
                setActiveId(current);
            }
        };

        // Реальный скролл-контейнер: window-события не всегда приходят (эта
        // страница скроллится через `document.body`). Помимо window подписываемся
        // на элемент, у которого контент реально переполняет его высоту.
        let scroller: Element | null = null;
        const candidates = [
            document.scrollingElement,
            document.documentElement,
            document.body,
        ] as const;
        for (const el of candidates) {
            if (el && el.scrollHeight > el.clientHeight) {
                scroller = el;
                break;
            }
        }

        const onScroll = () => {
            if (frame) {
                return;
            }
            frame = requestAnimationFrame(() => {
                update();
                frame = 0;
            });
        };

        update();
        window.addEventListener('scroll', onScroll, {passive: true});
        window.addEventListener('resize', onScroll);
        // `document.scrollingElement` прокручивается через viewport — его
        // отдельная подписка не нужна (покрывается window). Остальные — да.
        if (scroller && scroller !== document.scrollingElement) {
            scroller.addEventListener('scroll', onScroll, {passive: true});
        }

        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            scroller?.removeEventListener('scroll', onScroll);
            if (frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            }
        };
    }, [items]);

    // Внутренняя автопрокрутка панели: если активный пункт находится за
    // пределами видимой области scrollable-контейнера (длинный список),
    // мягко («nearest») подводим его в зону видимости. Срабатывает только
    // когда панель реально переполнена — на коротких списках и mobile
    // (где панель не скроллится) ничего не делаем и страницу не трогаем.
    useEffect(() => {
        if (!activeId) {
            return;
        }
        const panel = panelRef.current;
        if (!panel) {
            return;
        }
        if (panel.scrollHeight <= panel.clientHeight + 1) {
            return;
        }
        const activeLink = panel.querySelector<HTMLElement>('.article-nav__link--active');
        activeLink?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    }, [activeId]);

    if (items.length === 0) {
        return null;
    }

    const handleSelect = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
        event.preventDefault();
        const target = document.getElementById(id);
        if (target) {
            target.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
        // На мобильном после перехода сворачиваем содержание.
        setCollapsed(true);
    };

    const className = [
        'article-nav',
        visible ? 'article-nav--visible' : '',
        collapsed ? '' : 'article-nav--expanded',
    ].filter(Boolean).join(' ');

    return (
        <aside
            className={className}
            aria-label="Содержание статьи"
        >
            <button
                type="button"
                className="article-nav__toggle"
                onClick={() => setCollapsed((value) => !value)}
                aria-expanded={!collapsed}
                aria-controls="article-nav-list"
            >
                <span className="article-nav__toggle-label">Содержание</span>
                <span className="article-nav__toggle-icon" aria-hidden="true">
                    {collapsed ? '+' : '−'}
                </span>
            </button>

            <div className="article-nav__head">
                <span className="article-nav__head-label">Содержание</span>
                <span className="article-nav__head-line"/>
            </div>

            <nav
                id="article-nav-list"
                ref={panelRef}
                className="article-nav__panel"
                aria-label="Навигация по разделам"
            >
                <ul className="article-nav__list">
                    {items.map((heading) => (
                        <li className="article-nav__item" key={heading.id}>
                            <a
                                className={[
                                    'article-nav__link',
                                    heading.id === activeId
                                        ? 'article-nav__link--active'
                                        : '',
                                ].filter(Boolean).join(' ')}
                                href={`#${heading.id}`}
                                onClick={(event) => handleSelect(event, heading.id)}
                            >
                                {heading.text}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
};

export default ArticleNavigation;