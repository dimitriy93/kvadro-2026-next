'use client';
import Link from 'next/link';
import {useEffect, useMemo, useRef, useState} from 'react';
import {cabinet, cabinetObjectRoute} from '@/config/routes/cabinet.routes';
import type {MonitorObject} from '@/lib/account';
import {
    loadObjectSectionsSettings,
    subscribeObjectSectionsSettings,
    defaultObjectSectionsSettings,
    type CabinetObjectSectionId,
    type CabinetObjectSectionsSettings,
} from './object-sections.shared';
import {ObjectSectionsSettingsModal} from './object-sections-settings.ui';
import './object-page-header.styles.scss';

export type ObjectPageTab = 'state' | 'events' | 'map' | 'reports';

interface IObjectPageHeaderProps {
    object: MonitorObject;
    activeTab: ObjectPageTab;
    /** id пользователя кабинета — namespace настроек разделов; undefined — настройки недоступны. */
    userId?: string;
    /** true — демонстрационный источник данных; false — реальные данные GEORITM. */
    isDemoData: boolean;
}

/**
 * Заголовок страницы объекта: возврат к списку, название, адрес,
 * отметка о демо-данных, вкладки разделов и кнопка настроек отображения.
 *
 * «Карта» — заглушка (E7.3.5), поэтому в составе вкладок и в настройках
 * разделов отсутствует; маршрут сохранён для совместимости URL.
 *
 * Настройки хранятся в localStorage и применяются только на клиенте,
 * поэтому первый рендер всегда показывает разделы по умолчанию (совпадает
 * с серверной разметкой — без рассинхрона гидратации), затем применяется
 * сохранённый порядок и состав. Данные для вкладок и подписи разделов —
 * серверные, окно настроек обращений к источнику данных не выполняет.
 */
export const ObjectPageHeader = ({object, activeTab, userId, isDemoData}: IObjectPageHeaderProps) => {
    const routes = cabinetObjectRoute(object.id);
    const [settings, setSettings] = useState<CabinetObjectSectionsSettings>(defaultObjectSectionsSettings());
    const [settingsOpen, setSettingsOpen] = useState(false);
    const gearRef = useRef<HTMLButtonElement>(null);

    // Настройки читаются один раз при монтировании и обновляются, когда
    // их меняет окно настроек; userId при клиентских переходах между
    // объектами не меняется — перечитывать его не требуется.
    useEffect(() => {
        if (!userId) {
            return;
        }
        setSettings(loadObjectSectionsSettings(userId));
        return subscribeObjectSectionsSettings(setSettings);
    }, [userId]);

    // Вкладки объекта строятся из реально существующих разделов в
    // сохранённом порядке; маршруты зависят только от id объекта.
    const sectionRoutes = useMemo<Record<CabinetObjectSectionId, string>>(() => ({
        state: routes.state,
        events: routes.events,
        reports: routes.reports,
    }), [routes.state, routes.events, routes.reports]);

    const tabs = settings.sectionOrder
        .filter((id) => settings.visibleSections.includes(id))
        .map((id) => ({id, title: SECTION_TITLES[id], href: sectionRoutes[id]}));

    // Прямой URL скрытого раздела: страница остаётся рабочей (сервер её
    // не прячет), но пользователь видит объяснение и способ вернуть раздел.
    const hiddenActive = (SECTION_IDS as readonly string[]).includes(activeTab)
        && !settings.visibleSections.includes(activeTab as CabinetObjectSectionId);

    const openSettings = () => setSettingsOpen(true);
    const closeSettings = () => {
        setSettingsOpen(false);
        gearRef.current?.focus();
    };

    return (
        <header className="obj-header">
            <Link href={cabinet.href} className="obj-back">
                ← К списку объектов
            </Link>

            <div className="obj-header__top">
                <div className="obj-header__info">
                    <span className="promo-eyebrow">Объект мониторинга</span>
                    <h1 className="obj-header__title">{object.name}</h1>
                    <p className="obj-header__address">{object.address}</p>
                </div>

                <div className="obj-header__top-side">
                    {isDemoData && (
                        <span
                            className="acc-demo-note"
                            title="Прототип: значения вымышлены и не являются данными мониторинга"
                        >
                            Демонстрационные данные
                        </span>
                    )}
                    {userId && (
                        <button
                            ref={gearRef}
                            type="button"
                            className="obj-header__settings"
                            onClick={openSettings}
                            aria-haspopup="dialog"
                            aria-label="Настройка отображения разделов"
                            title="Настройка отображения разделов"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {hiddenActive && (
                <div className="obj-header__hidden-note" role="status">
                    <span>
                        Раздел «{SECTION_TITLES[activeTab as CabinetObjectSectionId]}» скрыт в настройках
                        отображения — страница открыта по прямой ссылке.
                    </span>
                    <button
                        type="button"
                        className="obj-header__settings-link"
                        onClick={openSettings}
                    >
                        Открыть настройки
                    </button>
                </div>
            )}

            <nav className="obj-tabs" aria-label="Разделы объекта">
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTab;

                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={`obj-tabs__tab${isActive ? ' obj-tabs__tab--active' : ''}`}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            {tab.title}
                        </Link>
                    );
                })}
            </nav>

            {settingsOpen && userId && (
                <ObjectSectionsSettingsModal
                    userId={userId}
                    current={settings}
                    onClose={closeSettings}
                />
            )}
        </header>
    );
};

const SECTION_TITLES: Record<CabinetObjectSectionId, string> = {
    state: 'Состояние',
    events: 'События',
    reports: 'Отчёты',
};

const SECTION_IDS: ReadonlyArray<CabinetObjectSectionId> = ['state', 'events', 'reports'];
