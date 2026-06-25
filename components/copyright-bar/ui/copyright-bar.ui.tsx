import {routes} from "@/config/routes/main.routes";
import "./copyright-bar.styles.scss";

export const CopyrightBar =  () => (
    <div className="copyright">
        <div className="copyright__item">
            © 1992-{new Date().getFullYear()} ООО ПМО "Квадро-Арсенал"
        </div>
        <a href={routes.privacy.href} className="copyright__privacy link">
            {routes.privacy.title}
        </a>
    </div>
)