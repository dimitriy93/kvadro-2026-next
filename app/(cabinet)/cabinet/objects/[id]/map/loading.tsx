import {Skeleton, SkeletonStatus} from '../../../ui/skeleton.ui';
import {ObjectPageSkeleton, SectionTitleSkeleton} from '../ui/object-skeletons.ui';
import '../ui/object-map.styles.scss';

/**
 * Skeleton вкладки «Карта» (E2.2). Повторяет структуру ObjectMapView:
 * заголовок секции и панель карты с карточкой-оверлеем по центру.
 */
export default function ObjectMapLoading() {
    return (
        <SkeletonStatus>
            <ObjectPageSkeleton activeTab="map"/>

            <section className="obj-section">
                <SectionTitleSkeleton width={150}/>

                <div className="obj-map__panel">
                    <Skeleton width="min(420px, 80%)" height={130}/>
                </div>
            </section>
        </SkeletonStatus>
    );
}
