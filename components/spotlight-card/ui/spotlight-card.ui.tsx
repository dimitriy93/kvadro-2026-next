import {ElementType, MouseEvent, ReactNode} from 'react';
import "./spotlight-card.style.scss";

interface ISpotlightCardProps {
    className?: string;
    children: ReactNode;
    as?: ElementType;
}

export const SpotlightCard = ({
                                  className = '',
                                  children,
                                  as: Component = 'article',
                              }: ISpotlightCardProps) => {
    const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
        const target = event.currentTarget;
        const rect = target.getBoundingClientRect();

        target.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
        target.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
    };

    const handleMouseLeave = (event: MouseEvent<HTMLElement>) => {
        const target = event.currentTarget;

        target.style.removeProperty('--mouse-x');
        target.style.removeProperty('--mouse-y');
    };

    return (
        <Component
            className={`spotlight ${className}`.trim()}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <span className="spotlight__glow" aria-hidden="true"/>
            <div className="spotlight__content">{children}</div>
        </Component>
    );
};