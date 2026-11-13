import Link from 'next/link';
import {cabinet, cabinetObjectRoute} from '@/config/routes/cabinet.routes';
import type {DemoMonitorObject} from '@/lib/account';
import './object-page-header.styles.scss';

export type ObjectPageTab = 'state' | 'events' | 'map';

interface IObjectPageHeaderProps {
    object: DemoMonitorObject;
    activeTab: ObjectPageTab;
}

const TABS: ReadonlyArray<{id: ObjectPageTab; title: string}> = [
    {id: 'state', title: 'Состояние'},
    {id: 'events', title: 'События'},
    {id: 'map', title: 'Карта'},
];

/**
 * Заголовок страницы объекта: возврат к списку, название, адрес,
 * отметка о демо-данных и вкладки «Состояние / События / Карта».
 */
export const ObjectPageHeader = ({object, activeTab}: IObjectPageHeaderProps) => {
    const routes = cabinetObjectRoute(object.id);

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

                <span
                    className="acc-demo-note"
                    title="Прототип: значения вымышлены и не являются данными мониторинга"
                >
                    Демонстрационные данные
                </span>
            </div>

            <nav className="obj-tabs" aria-label="Разделы объекта">
                {TABS.map((tab) => {
                    const href = tab.id === 'state' ? routes.state : routes[tab.id];
                    const isActive = tab.id === activeTab;

                    return (
                        <Link
                            key={tab.id}
                            href={href}
                            className={`obj-tabs__tab${isActive ? ' obj-tabs__tab--active' : ''}`}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            {tab.title}
                        </Link>
                    );
                })}
            </nav>
        </header>
    );
};
