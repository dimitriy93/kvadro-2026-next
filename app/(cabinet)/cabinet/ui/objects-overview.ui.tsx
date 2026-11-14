import Link from 'next/link';
import {cabinetObjectRoute} from '@/config/routes/cabinet.routes';
import type {MonitorObject} from '@/lib/account';
import {ObjectStateBadge} from './object-state-badge.ui';
import {formatDateTime} from './format';
import './objects-overview.styles.scss';

interface IObjectsOverviewProps {
    userName: string;
    objects: MonitorObject[];
    /** true — демонстрационный источник данных; false — реальные данные GEORITM. */
    isDemoData: boolean;
}

export const ObjectsOverview = ({userName, objects, isDemoData}: IObjectsOverviewProps) => (
    <section className="acc-overview">
        <div className="acc-overview__head">
            <div className="acc-overview__heading">
                <span className="promo-eyebrow">Личный кабинет</span>
                <h1 className="acc-overview__title">Объекты мониторинга</h1>
                <p className="acc-overview__subtitle">
                    {userName}, вам доступно объектов: {objects.length}
                </p>
            </div>

            {isDemoData && (
                <span className="acc-demo-note" title="Прототип: значения вымышлены и не являются данными мониторинга">
                    Демонстрационные данные
                </span>
            )}
        </div>

        {objects.length === 0 ? (
            <p className="acc-overview__empty">
                К вашей учётной записи не привязано ни одного объекта.
                Обратитесь к специалистам компании.
            </p>
        ) : (
            <ul className="acc-overview__grid">
                {objects.map((object) => (
                    <li key={object.id}>
                        <Link
                            href={cabinetObjectRoute(object.id).state}
                            className="acc-overview__card"
                        >
                            <div className="acc-overview__card-head">
                                <h2 className="acc-overview__card-title">{object.name}</h2>
                                <span className="acc-overview__card-id">{object.id}</span>
                            </div>

                            <p className="acc-overview__card-address">{object.address}</p>

                            <ul className="acc-overview__states">
                                <li><ObjectStateBadge kind="security" value={object.securityAlarm}/></li>
                                <li><ObjectStateBadge kind="fire" value={object.fireAlarm}/></li>
                                <li><ObjectStateBadge kind="connection" value={object.connection}/></li>
                            </ul>

                            <p className="acc-overview__card-updated">
                                Обновлено: {formatDateTime(object.updatedAt)} (МСК)
                            </p>

                            <span className="acc-overview__card-open">
                                Состояние, события и карта →
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        )}
    </section>
);
