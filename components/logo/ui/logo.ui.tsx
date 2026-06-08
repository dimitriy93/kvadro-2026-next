import logo from "@/app/_assets/images/logo.png";
import "./logo.styles.scss";

export const Logo = () => (
    <svg viewBox="0 0 450 50" className="logo">
        <image
            href={String(logo.src)}
            x="0"
            y="0"
            width="50"
            height="50"
        />
        <text x="65" y="18" className="logo__sub-title">проектно-монтажная организация</text>
        <text x="65" y="45" className="logo__main-title">ООО «Квадро-Арсенал»</text>
    </svg>
)