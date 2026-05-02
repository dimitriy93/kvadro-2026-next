import "./styles.scss";

interface ISectionHeaderProps {
    title: string;
    eyebrow: string;
}

export const SectionHeader = ({ title, eyebrow }: ISectionHeaderProps) => (
    <div className="section-header">
        <span className="section-header__eyebrow">{eyebrow}</span>
        <h2 className="section-header__title">{title}</h2>
    </div>
)