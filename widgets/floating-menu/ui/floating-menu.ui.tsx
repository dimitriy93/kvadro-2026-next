"use client"
import {useState} from "react";
import {Button} from "@/components/button";
import {contacts} from "@/config/brand/contacts";
import {floatingMenu} from "@/config/navigation/menu";
import "./floating-menu.styles.scss";

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
                        <div className="floating-menu__label">
                            Меню
                        </div>
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
                    {floatingMenu.map((link, i) => (
                        <li key={i}>
                            <span className="menu-item-mask">
                              <a href={link.href} className="link">{link.title}</a>
                            </span>
                        </li>
                    ))}
                </ul>

                <div className="menu-footer">
                    <div className="menu-contact">
                        <div className="menu-phone">{contacts.phone}</div>
                        <div className="menu-address">{contacts.address}</div>
                    </div>
                    <Button mode="primary-inverted">
                        Связаться с нами
                    </Button>
                </div>
            </nav>
        </>
    )
}