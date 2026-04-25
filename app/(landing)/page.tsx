"use client";
import {useState} from "react";
import {useIsMobile} from "@/hooks/useIsMobile";
import {FloatingMenu} from "@/widgets/FloatingMenu";
import {Logo} from "@/components/Logo";
import {Button} from "@/components/Button";
import {CopyrightBar} from "@/components/CopyrightBar";
import {landing} from "@/config/content/landing";

function Page () {
    const isMobile = useIsMobile(992);
    const [activeBg, setActiveBg] = useState<string | null>(null);

    const handleCategoryEnter = (bg: string) => {
        if (isMobile) return;
        setActiveBg(bg);
    }

    const handleCategoryLeave = () => {
        if (isMobile) return;
        setActiveBg(null);
    }

    return (
        <>
            <div className="main-overlay"></div>
            {landing.categories.map(elem => (
                <div
                    key={elem.id}
                    id={elem.id}
                    className={`category-bg ${activeBg === elem.id ? 'is-active' : ''}`}
                    style={{
                        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('/images/${elem.id}.webp')`
                    }}
                ></div>
            ))}

            {isMobile && (
                <div className="mobile-header">
                    <Logo/>
                </div>
            )}

            <div className="main">
                <div className="main__wrap">
                    <div className="main__left">
                        {!isMobile && (<Logo />)}
                        {isMobile && (
                            <h2 className="promo-heading">
                                Наши услуги
                            </h2>
                        )}
                        <ul className="categories">
                            {landing.categories.map(elem => (
                                <li
                                    className="categories__item"
                                    data-bg={elem.id}
                                    key={elem.num}
                                    onMouseEnter={() => handleCategoryEnter(elem.id)}
                                    onMouseLeave={handleCategoryLeave}
                                >
                                    <span className="categories__number">{elem.num}</span>
                                    <span className="categories__text">{elem.title}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="main__right">
                        <span className="promo-eyebrow">{landing.eyebrow}</span>
                        <h2 className="promo-heading">{landing.heading}</h2>
                        <p className="promo-text">{landing.text}</p>
                        <div className="promo-actions">
                            <Button mode="primary">{landing.btn_call}</Button>
                            <Button mode="secondary">{landing.btn_vacancy}</Button>
                        </div>
                    </div>
                </div>
                <CopyrightBar />
            </div>

            <FloatingMenu />
        </>
    )
}

export default Page;