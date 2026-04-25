import {copyright} from "@/config/content/copyright";
import "./styles.scss";

export const CopyrightBar =  () => (
    <div className="copyright">
        <div className="copyright__item">
            © {copyright.foundation_year}-{new Date().getFullYear()} {copyright.company}
        </div>
        <a href={copyright.privacy_link} className="copyright__privacy">{copyright.privacy_text}</a>
    </div>
)