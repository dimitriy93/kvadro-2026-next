import './section-header.styles.scss';

interface ISectionHeaderProps {
  title: string;
  eyebrow: string;
  text?: string;
}

export const SectionHeader = ({ title, eyebrow, text }: ISectionHeaderProps) => (
  <div className="section-header">
    <span className="section-header__eyebrow">{eyebrow}</span>
    <h2 className="section-header__title">{title}</h2>
    {text && <p className="section-header__text">{text}</p>}
  </div>
);
