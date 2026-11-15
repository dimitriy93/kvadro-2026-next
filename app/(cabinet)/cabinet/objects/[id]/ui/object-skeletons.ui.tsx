'use client';
import {Skeleton} from '@/app/(cabinet)/cabinet/ui/skeleton.ui';
import {
    defaultObjectSectionsSettings,
    peekObjectSectionsSettings,
    type CabinetObjectSectionId,
} from './object-sections.shared';
import type {ObjectPageTab} from './object-page-header.ui';
import './object-page-header.styles.scss';

interface IObjectPageSkeletonProps {
    activeTab: ObjectPageTab;
}

/* Ширины placeholder-полос вкладок (px) — приближают ширину реальных
   подписей «Состояние», «События», «Отчёты» при font-size 13–14px, чтобы
   скелетон и настоящая навигация совпадали по геометрии без layout shift. */
const SECTION_BAR_WIDTHS: Record<CabinetObjectSectionId, number> = {
    state: 80,
    events: 58,
    reports: 50,
};

/**
 * Skeleton заголовка страницы объекта (E7.5): повторяет структуру
 * ObjectPageHeader (возврат к списку, eyebrow, название, адрес, плашка
 * демо-данных, вкладки) и её вертикальный ритм — группа «возврат» отделена
 * от инфо-блока, внутри блока отступы как у реальных title/address (классы
 * .obj-skel-* в стилях шапки), высоты полос соответствуют реальным строкам.
 *
 * Вкладки — нейтральные placeholder-полосы без реальных названий: во время
 * перехода не показываются ни подписи разделов, ни отсутствующий раздел
 * «Карта», ни несуществующие разделы. Количество и порядок полос берутся
 * из кэша пользовательских настроек (см. peekObjectSectionsSettings); до
 * первой загрузки настроек — набор по умолчанию, как и в реальной шапке до
 * применения сохранённых настроек. Полосы — неинтерактивные span: навигация
 * невозможна, пока данные не загружены. Блок вкладок декоративный
 * (aria-hidden), состояние загрузки сообщает обёртка SkeletonStatus.
 * Активная вкладка обозначается оранжевой чертой — как в реальной навигации.
 */
export const ObjectPageSkeleton = ({activeTab}: IObjectPageSkeletonProps) => {
    const settings = peekObjectSectionsSettings() ?? defaultObjectSectionsSettings();
    const sections = settings.sectionOrder.filter((id) => settings.visibleSections.includes(id));

    return (
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

            <div className="obj-tabs" aria-hidden="true">
                {sections.map((id) => (
                    <span
                        key={id}
                        className={`obj-tabs__tab${id === activeTab ? ' obj-tabs__tab--active' : ''}`}
                    >
                        <Skeleton width={SECTION_BAR_WIDTHS[id]} height={14}/>
                    </span>
                ))}
            </div>
        </header>
    );
};

/** Skeleton заголовка секции внутри страницы объекта. */
export const SectionTitleSkeleton = ({width = 170}: {width?: number}) => (
    <Skeleton width={width} height={19}/>
);
