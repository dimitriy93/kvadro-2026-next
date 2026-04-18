import {useState} from "react";
import "./styles.scss";

export const FloatingMenu = () => {
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const activeClass = menuOpen ? 'active' : '';

    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    }

    const closeMenu = () => {
        setMenuOpen(false);
    }

    return (
        <>
            <div className={`floating-menu ${activeClass}`} onClick={toggleMenu}>
                <div className="floating-menu__content">
                    <div className="floating-menu__label-wrap">
                        <div className="floating-menu__label">Меню</div>
                    </div>
                    <div className="floating-menu__burger">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>

            <div className={`menu-overlay ${activeClass}`} onClick={closeMenu}></div>
            <nav className={`menu-panel ${activeClass}`}>
                <span className="promo-eyebrow">
                  Меню
                </span>
                <ul className="menu-list">
                    <li>
                        <span className="menu-item-mask">
                          <a href="#">История компании</a>
                        </span>
                    </li>
                    <li>
                        <span className="menu-item-mask">
                          <a href="#">Наши преимущества</a>
                        </span>
                    </li>
                    <li>
                        <span className="menu-item-mask">
                          <a href="#">Услуги</a>
                        </span>
                    </li>
                    <li>
                        <span className="menu-item-mask">
                          <a href="#">Наши клиенты</a>
                        </span>
                    </li>
                    <li>
                        <span className="menu-item-mask">
                          <a href="#">Контакты</a>
                        </span>
                    </li>
                </ul>

                <div className="menu-footer">
                    <div className="menu-contact">
                        <div className="menu-phone">+7 (904) 123-45-67</div>
                        <div className="menu-address">г. Электросталь, ул. Чернышевского</div>
                    </div>
                    <button className="menu-cta">
                        Связаться с нами
                    </button>
                </div>
            </nav>
        </>
    )
}