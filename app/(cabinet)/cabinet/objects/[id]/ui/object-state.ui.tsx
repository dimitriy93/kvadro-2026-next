import type {DemoMonitorObject, DemoObjectZone} from '@/lib/account';
import {ObjectPageHeader} from './object-page-header.ui';
import {ObjectStateBadge} from '@/app/(cabinet)/cabinet/ui/object-state-badge.ui';
import {ZONE_SYSTEM_NAMES} from '@/app/(cabinet)/cabinet/ui/state-meta';
import {formatDateTime} from '@/app/(cabinet)/cabinet/ui/format';
import './object-state.styles.scss';

interface IObjectStateViewProps {
    object: DemoMonitorObject;
    zones: DemoObjectZone[];
}

/**
 * Страница состояния объекта: общая информация, системы, зоны.
 * Только отображение — без управления оборудованием.
 */
export const ObjectStateView = ({object, zones}: IObjectStateViewProps) => (
    <>
        <ObjectPageHeader object={object} activeTab="state"/>

        <section className="obj-section" aria-label="Общая информация">
            <h2 className="obj-section__title">Общая информация</h2>

            <div className="obj-info">
                <div className="obj-info__item">
                    <span className="obj-info__label">Связь с объектом</span>
                    <ObjectStateBadge kind="connection" value={object.connection}/>
                </div>
                <div className="obj-info__item">
                    <span className="obj-info__label">Последнее обновление</span>
                    <span className="obj-info__value">{formatDateTime(object.updatedAt)} (МСК)</span>
                </div>
            </div>
        </section>

        <section className="obj-section" aria-label="Состояние систем">
            <h2 className="obj-section__title">Состояние систем</h2>

            <div className="obj-systems">
                <div className="obj-system">
                    <ObjectStateBadge kind="security" value={object.securityAlarm}/>
                </div>
                <div className="obj-system">
                    <ObjectStateBadge kind="fire" value={object.fireAlarm}/>
                </div>
                <div className="obj-system">
                    <ObjectStateBadge kind="connection" value={object.connection}/>
                </div>
            </div>
        </section>

        <section className="obj-section" aria-label="Зоны объекта">
            <h2 className="obj-section__title">Зоны объекта</h2>

            {zones.length === 0 ? (
                <p className="obj-empty">Для этого объекта зоны не настроены.</p>
            ) : (
                <ul className="obj-zones">
                    {zones.map((zone) => (
                        <li key={zone.id} className="obj-zone">
                            <div className="obj-zone__info">
                                <span className="obj-zone__name">{zone.name}</span>
                                <span className="obj-zone__system">{ZONE_SYSTEM_NAMES[zone.system]}</span>
                            </div>

                            <ObjectStateBadge kind={zone.system} value={zone.state} showName={false}/>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    </>
);
