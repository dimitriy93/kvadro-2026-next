import Image from "next/image";
import logo from "@/app/_assets/images/logo.png";
import "./logo.styles.scss";

export const Logo = () => (
    <div className="logo">
        <Image src={logo} alt="Квадро-Арсенал" className="logo__image"/>
        <h1 className="logo__title">
            <span className="logo__sub-title">проектно-монтажная организация</span>
            <span className="logo__main-title">ООО «Квадро-Арсенал»</span>
        </h1>
    </div>
)