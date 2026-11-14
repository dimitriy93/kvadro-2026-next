import type {MonitorObject} from '@/lib/account';
import {ObjectPageHeader} from './object-page-header.ui';
import './object-map.styles.scss';

interface IObjectMapViewProps {
    object: MonitorObject;
    /** true — демонстрационный источник данных; false — реальные данные GEORITM. */
    isDemoData: boolean;
}

/**
 * Страница карты объекта — намеренная заглушка. Схема ниже декоративная,
 * не связана с реальной геометрией объекта; картографические сервисы
 * не подключаются.
 */
export const ObjectMapView = ({object, isDemoData}: IObjectMapViewProps) => (
    <>
        <ObjectPageHeader object={object} activeTab="map" isDemoData={isDemoData}/>

        <section className="obj-section" aria-label="Карта объекта">
            <h2 className="obj-section__title">Карта объекта</h2>

            <div className="obj-map__panel">
                {/* Декоративная схема-план без привязки к местности. */}
                <svg
                    className="obj-map__plan"
                    viewBox="0 0 640 420"
                    preserveAspectRatio="xMidYMid slice"
                    aria-hidden="true"
                    focusable="false"
                >
                    <defs>
                        <pattern id="obj-map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" strokeWidth="1"/>
                        </pattern>
                    </defs>

                    <rect x="0" y="0" width="640" height="420" fill="url(#obj-map-grid)" className="obj-map__grid"/>
                    <rect x="40" y="30" width="560" height="360" className="obj-map__wall"/>
                    <line x1="250" y1="30" x2="250" y2="200" className="obj-map__wall"/>
                    <line x1="250" y1="200" x2="600" y2="200" className="obj-map__wall"/>
                    <line x1="420" y1="200" x2="420" y2="390" className="obj-map__wall"/>
                    <line x1="40" y1="260" x2="250" y2="260" className="obj-map__wall"/>

                    {/* Проёмы дверей */}
                    <line x1="300" y1="30" x2="345" y2="30" className="obj-map__door"/>
                    <line x1="250" y1="110" x2="250" y2="150" className="obj-map__door"/>
                    <line x1="480" y1="200" x2="525" y2="200" className="obj-map__door"/>

                    {/* Условные точки оборудования */}
                    <circle cx="140" cy="120" r="5" className="obj-map__point"/>
                    <circle cx="520" cy="130" r="5" className="obj-map__point"/>
                    <circle cx="330" cy="300" r="5" className="obj-map__point"/>
                </svg>

                <div className="obj-map__overlay">
                    <svg className="obj-map__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>

                    <p className="obj-map__overlay-text">
                        {object.name}
                    </p>
                    <p className="obj-map__overlay-note">
                        Отображение карты будет доступно позднее. Сейчас показана
                        демонстрационная схема без привязки к местности.
                    </p>
                </div>
            </div>
        </section>
    </>
);
