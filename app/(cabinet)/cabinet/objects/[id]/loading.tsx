import {Skeleton, SkeletonStatus} from '../../ui/skeleton.ui';
import {ObjectPageSkeleton, SectionTitleSkeleton} from './ui/object-skeletons.ui';
import './ui/object-state.styles.scss';

/**
 * Skeleton вкладки «Состояние» (E2.2). Повторяет структуру ObjectStateView:
 * общая информация, состояние систем, зоны объекта. Число зон неизвестно
 * до ответа источника — показывается несколько строк; реальные данные
 * при необходимости добавляют или убирают строки без сдвига макета.
 */
export default function ObjectStateLoading() {
    return (
        <SkeletonStatus>
            <ObjectPageSkeleton activeTab="state"/>

            <section className="obj-section">
                <SectionTitleSkeleton width={160}/>

                <div className="obj-info">
                    <div className="obj-info__item">
                        <Skeleton width={150} height={11}/>
                        <Skeleton width={190} height={15}/>
                    </div>
                    <div className="obj-info__item">
                        <Skeleton width={170} height={11}/>
                        <Skeleton width={180} height={15}/>
                    </div>
                </div>
            </section>

            <section className="obj-section">
                <SectionTitleSkeleton width={170}/>

                <div className="obj-systems">
                    <div className="obj-system"><Skeleton width={170} height={14}/></div>
                    <div className="obj-system"><Skeleton width={150} height={14}/></div>
                    <div className="obj-system"><Skeleton width={180} height={14}/></div>
                </div>
            </section>

            <section className="obj-section">
                <SectionTitleSkeleton width={130}/>

                <ul className="obj-zones">
                    {[190, 230, 160, 210].map((nameWidth, index) => (
                        <li key={index} className="obj-zone">
                            <div className="obj-zone__info">
                                <Skeleton width={nameWidth} height={15}/>
                                <Skeleton width={110} height={12}/>
                            </div>

                            <Skeleton width={100} height={13}/>
                        </li>
                    ))}
                </ul>
            </section>
        </SkeletonStatus>
    );
}
