import {Skeleton, SkeletonStatus} from '../../../ui/skeleton.ui';
import {ObjectPageSkeleton, SectionTitleSkeleton} from '../ui/object-skeletons.ui';
import '../ui/object-events.styles.scss';

/**
 * Skeleton вкладки «События» (E2.2). Повторяет структуру ObjectEventsView:
 * заголовок журнала, чипы фильтра, список записей. Используется и при
 * переходе на вкладку с других вкладок, и при прямом открытии страницы.
 */
export default function ObjectEventsLoading() {
    return (
        <SkeletonStatus>
            <ObjectPageSkeleton activeTab="events"/>

            <section className="obj-section">
                <div className="obj-events__head">
                    <SectionTitleSkeleton width={160}/>
                    <Skeleton width={110} height={13}/>
                </div>

                <div className="obj-events__filters">
                    {[60, 150, 150, 170, 130, 150].map((chipWidth, index) => (
                        <Skeleton key={index} width={chipWidth} height={36} pill/>
                    ))}
                </div>

                <ol className="obj-events__list">
                    {[65, 75, 55, 70].map((messageWidth, index) => (
                        <li key={index} className="obj-event">
                            <Skeleton width={120} height={13}/>

                            <div className="obj-event__body">
                                <Skeleton width={170} height={12}/>
                                <Skeleton width={`${messageWidth}%`} height={14}/>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>
        </SkeletonStatus>
    );
}
