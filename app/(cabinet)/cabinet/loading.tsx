import {Skeleton, SkeletonStatus} from './ui/skeleton.ui';
import './ui/objects-overview.styles.scss';

const SKELETON_CARD_COUNT = 3;

/**
 * Мгновенный skeleton-отклик главной страницы кабинета (E2.2). Повторяет
 * структуру ObjectsOverview: шапка раздела + сетка карточек объектов.
 * Названия объектов и их статусы неизвестны до завершения серверного
 * запроса — placeholder-полосы; пустое состояние карточками не имитируется.
 */
export default function CabinetLoading() {
    return (
        <SkeletonStatus>
            <section className="acc-overview">
                <div className="acc-overview__head">
                    <div className="acc-overview__heading">
                        <Skeleton width={130} height={12}/>
                        <Skeleton width={320} height={30}/>
                        <Skeleton width={280} height={15}/>
                    </div>

                    <Skeleton width={190} height={30} pill/>
                </div>

                <ul className="acc-overview__grid">
                    {Array.from({length: SKELETON_CARD_COUNT}, (_, index) => (
                        <li key={index}>
                            <div className="acc-skel-card">
                                <div className="acc-overview__card-head">
                                    <Skeleton width={180} height={20}/>
                                    <Skeleton width={70} height={12}/>
                                </div>

                                <Skeleton width="85%" height={14}/>

                                <ul className="acc-overview__states">
                                    <li><Skeleton width={170} height={14}/></li>
                                    <li><Skeleton width={190} height={14}/></li>
                                    <li><Skeleton width={150} height={14}/></li>
                                </ul>

                                <div className="acc-skel-card__foot">
                                    <Skeleton width={210} height={12}/>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        </SkeletonStatus>
    );
}
