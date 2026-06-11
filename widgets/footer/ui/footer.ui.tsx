import Link from "next/link";
import {footer} from "@/config/content/footer";
import {Logo} from "@/components/logo";
import "./footer.styles.scss";

export const Footer = () => (
    <footer className="footer">
        <div className="container">

            <div className="footer__grid">
                <div className="footer__brand">
                    <Logo/>
                    <p className="footer__description">{footer.description}</p>
                </div>

                <nav className="footer__column">
                    <span className="footer__title">{footer.services_title}</span>
                    <ul className="footer__list">
                        {footer.services.map((item) => (
                            <li key={item.label}>
                                <Link href={item.href} className="link">{item.label}</Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <nav className="footer__column">
                    <span className="footer__title">{footer.second_menu_title}</span>
                    <ul className="footer__list">
                        {footer.second_menu.map((item) => (
                            <li key={item.label}>
                                <Link href={item.href} className="link">{item.label}</Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="footer__column">
                    <span className="footer__title">{footer.contact_title}</span>

                    <address className="footer__contacts">
                        {footer.contact.map((item) => (
                            <li key={item.label}>
                                <Link href={item.href} className={`${item.className} link`.trim()}>{item.label}</Link>
                            </li>
                        ))}
                        <span className="footer__address">
                                {footer.contact_address.join('\n')}
                            </span>
                    </address>
                </div>
            </div>

            <div className="footer__bottom">
                <span>{footer.footer_bottom.copyright}</span>
                <Link href={footer.footer_bottom.privacy.href}>
                    {footer.footer_bottom.privacy.label}
                </Link>
            </div>
        </div>
    </footer>
)