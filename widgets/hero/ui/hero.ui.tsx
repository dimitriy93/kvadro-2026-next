import {useState} from "react";
import {useIsMobile} from "@/hooks/use-is-mobile";
import {Logo} from "@/components/logo";
import {Marker} from "@/components/marker";
import {Button} from "@/components/button";
import {landing} from "@/config/content/landing";

export const Hero = ({ onOpenQuiz }) => {
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
            {isMobile && (
                <div className="mobile-header">
                    <Logo/>
                </div>
            )}

            <div className="main">
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
                        <div className="promo-subnote">
                            {landing.subnote.map((item, i, arr) => (
                                <span key={item} className="promo-subnote__item">
                                    {item}
                                    {(i !== arr.length - 1) && <Marker />}
                                </span>
                            ))}
                        </div>
                        <div className="promo-actions">
                            <Button mode="primary" onClick={onOpenQuiz}>
                                {landing.btn_primary}
                            </Button>
                            <Button mode="secondary">{landing.btn_secondary}</Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}