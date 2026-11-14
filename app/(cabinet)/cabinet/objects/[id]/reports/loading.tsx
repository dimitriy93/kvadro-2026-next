import {Skeleton, SkeletonStatus} from '../../../ui/skeleton.ui';
import {ObjectPageSkeleton, SectionTitleSkeleton} from '../ui/object-skeletons.ui';
import './ui/object-reports.styles.scss';

/**
 * Skeleton вкладки «Отчёты» (E4.3). Повторяет структуру ObjectReportsView:
 * типы отчёта, готовые периоды и поля дат, кнопка. Используется и при
 * переходе на вкладку с других вкладок, и при прямом открытии страницы.
 */
export default function ObjectReportsLoading() {
    return (
        <SkeletonStatus>
            <ObjectPageSkeleton activeTab="reports"/>

            <section className="obj-section">
                <SectionTitleSkeleton width={190}/>

                <div className="obj-reports">
                    <div className="obj-reports__options">
                        <Skeleton width="100%" height={64}/>
                        <Skeleton width="100%" height={64}/>
                    </div>

                    <div className="obj-reports__presets">
                        <Skeleton width={90} height={34} pill/>
                        <Skeleton width={90} height={34} pill/>
                    </div>

                    <div className="obj-reports__dates">
                        <Skeleton width={170} height={38}/>
                        <Skeleton width={170} height={38}/>
                    </div>

                    <Skeleton width={230} height={44}/>
                </div>
            </section>
        </SkeletonStatus>
    );
}
