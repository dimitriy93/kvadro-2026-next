import { IHeadingProps } from '@/components/heading/heading.types';
import './heading.styles.scss';

export const Heading = ({ eyebrow, children, as: Tag = 'h2', mode = 'light' }: IHeadingProps) => (
  <div className={`heading heading--${mode}`}>
    {eyebrow && <span className="heading__eyebrow">{eyebrow}</span>}
    <Tag className="heading__title">{children}</Tag>
  </div>
);
