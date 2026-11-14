import type {CSSProperties, ReactNode} from 'react';
import './skeleton.styles.scss';

interface ISkeletonProps {
    /** Ширина (px или CSS-значение); undefined — вся ширина контейнера. */
    width?: number | string;
    /** Высота в px. */
    height?: number;
    /** Форма таблетки — чипы фильтров, бейджи, плашки. */
    pill?: boolean;
    className?: string;
    style?: CSSProperties;
}

/**
 * Одиночный skeleton-блок — анимированный placeholder вместо контента.
 * Анимация (шиммер) определена в skeleton.styles.scss и отключается
 * при prefers-reduced-motion; aria-hidden — это чисто визуальный элемент.
 */
export const Skeleton = ({width, height, pill, className, style}: ISkeletonProps) => (
    <span
        className={['acc-skel', pill ? 'acc-skel--pill' : '', className ?? ''].filter(Boolean).join(' ')}
        style={{width, height, ...style}}
        aria-hidden="true"
    />
);

/**
 * Обёртка состояния загрузки раздела кабинета: для вспомогательных
 * технологий сообщает role="status" и aria-busy, видимое содержимое —
 * skeleton соответствующего раздела.
 */
export const SkeletonStatus = ({children}: {children: ReactNode}) => (
    <div className="acc-skel-status" role="status" aria-busy="true">
        <span className="acc-visually-hidden">Загрузка…</span>
        {children}
    </div>
);
