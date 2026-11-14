import type {MonitorObject, ObjectZone, ObjectZoneSection} from '@/lib/account';
import {ObjectPageHeader} from './object-page-header.ui';
import {ObjectStateBadge} from '@/app/(cabinet)/cabinet/ui/object-state-badge.ui';
import {ZONE_SYSTEM_NAMES} from '@/app/(cabinet)/cabinet/ui/state-meta';
import {formatDateTime} from '@/app/(cabinet)/cabinet/ui/format';
import './object-state.styles.scss';

interface IObjectStateViewProps {
    object: MonitorObject;
    zones: ObjectZoneSection[];
    /** true — раздел «Зоны» не удалось загрузить; остальные секции страницы рабочие. */
    zonesLoadFailed?: boolean;
    /** true — демонстрационный источник данных; false — реальные данные GEORITM. */
    isDemoData: boolean;
}

/** Русское склонение «зона/зоны/зон» (11–14 — «зон»). */
const pluralZones = (count: number): string => {
    const mod100 = count % 100;
    const mod10 = count % 10;
    if (mod100 >= 11 && mod100 <= 14) {
        return `${count} зон`;
    }
    if (mod10 === 1) {
        return `${count} зона`;
    }
    if (mod10 >= 2 && mod10 <= 4) {
        return `${count} зоны`;
    }
    return `${count} зон`;
};

/** Второстепенная строка зоны: номер, система (только demo) и комментарий. */
const zoneMeta = (zone: ObjectZone, isDemoData: boolean): string => {
    const parts = [
        zone.num !== undefined ? `№ ${zone.num}` : null,
        isDemoData ? ZONE_SYSTEM_NAMES[zone.system] : null,
        zone.comment ?? null,
    ];
    return parts.filter((part) => part !== null).join(' · ');
};

/**
 * Страница состояния объекта: общая информация, системы, разделы и зоны.
 * Только отображение — без управления оборудованием.
 *
 * Зоны сгруппированы по разделам (GEORITM areas[].zones[]). Системные метки
 * зон показываются только на демонстрационных данных: в GEORITM нет поля
 * «охранная/пожарная» на уровне зоны (вопрос B7), и подписывать реальные
 * зоны «охранной» значило бы выдавать классификацию, которой API не даёт.
 */
export const ObjectStateView = ({object, zones, zonesLoadFailed = false, isDemoData}: IObjectStateViewProps) => {
    const totalZones = zones.reduce((sum, section) => sum + section.zones.length, 0);

    return (
        <>
            <ObjectPageHeader object={object} activeTab="state" isDemoData={isDemoData}/>

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

                {zonesLoadFailed ? (
                    <p className="obj-zones-error" role="alert">
                        Не удалось загрузить зоны. Попробуйте обновить страницу позже.
                    </p>
                ) : zones.length === 0 ? (
                    <p className="obj-empty">Для этого объекта зоны не настроены.</p>
                ) : (
                    <>
                        <p className="obj-zones-count">{pluralZones(totalZones)}</p>
                        <ul className="obj-zones">
                            {zones.map((section) => (
                                <li key={section.id} className="obj-zone-section">
                                    <div className="obj-zone-section__header">
                                        <div className="obj-zone__info">
                                            <span className="obj-zone__name">
                                                {section.name}
                                                {section.num !== undefined && (
                                                    <span className="obj-zone-section__num"> · раздел № {section.num}</span>
                                                )}
                                            </span>
                                            {section.comment && (
                                                <span className="obj-zone__system">{section.comment}</span>
                                            )}
                                        </div>

                                        <ObjectStateBadge kind="security" value={section.state} showName={false}/>
                                    </div>

                                    {section.zones.length > 0 && (
                                        <ul className="obj-zone-section__zones">
                                            {section.zones.map((zone) => (
                                                <li key={zone.id} className="obj-zone">
                                                    <div className="obj-zone__info">
                                                        <span className="obj-zone__name">{zone.name}</span>
                                                        <span className="obj-zone__system">{zoneMeta(zone, isDemoData)}</span>
                                                    </div>

                                                    <ObjectStateBadge kind={zone.system} value={zone.state} showName={false}/>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>
        </>
    );
};
