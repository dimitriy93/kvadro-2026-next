import {Skeleton} from '@/app/(cabinet)/cabinet/ui/skeleton.ui';
import type {ObjectPageTab} from './object-page-header.ui';
import './object-page-header.styles.scss';

const TABS: ReadonlyArray<{id: ObjectPageTab; title: string}> = [
    {id: 'state', title: 'Состояние'},
    {id: 'events', title: 'События'},
    {id: 'map', title: 'Карта'},
    {id: 'reports', title: 'Отчёты'},
];

interface IObjectPageSkeletonProps {
    activeTab: ObjectPageTab;
}

/**
 * Skeleton заголовка страницы объекта: повторяет структуру ObjectPageHeader
 * (возврат к списку, eyebrow, название, адрес, плашка демо-данных, вкладки)
 * и её вертикальный ритм — группа «возврат» отделена от инфо-блока, внутри
 * блока отступы как у реальных title/address (классы .obj-skel-* в стилях
 * шапки), высоты полос соответствуют реальным строкам. Название и адрес
 * объекта неизвестны до завершения запроса — placeholder-полосы; подписи
 * вкладок статичны, активная вкладка подсвечена, поэтому при переключении
 * вкладок навигация визуально не исчезает. Вкладки — неинтерактивные span:
 * навигация невозможна, пока данные не загружены.
 */
export const ObjectPageSkeleton = ({activeTab}: IObjectPageSkeletonProps) => (
    <header className="obj-header">
        <div className="obj-skel-back">
            <Skeleton width={150} height={16}/>
        </div>

        <div className="obj-header__top">
            <div className="obj-header__info">
                <Skeleton width={150} height={17}/>
                <Skeleton width={300} height={36} className="obj-skel-title"/>
                <Skeleton width={240} height={20} className="obj-skel-address"/>
            </div>

            <Skeleton width={190} height={30} pill/>
        </div>

        <div className="obj-tabs">
            {TABS.map((tab) => (
                <span
                    key={tab.id}
                    className={`obj-tabs__tab${tab.id === activeTab ? ' obj-tabs__tab--active' : ''}`}
                >
                    {tab.title}
                </span>
            ))}
        </div>
    </header>
);

/** Skeleton заголовка секции внутри страницы объекта. */
export const SectionTitleSkeleton = ({width = 170}: {width?: number}) => (
    <Skeleton width={width} height={19}/>
);
