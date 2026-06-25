import {useState} from "react";
import {useIsMobile} from "@/hooks/use-is-mobile";
import {Logo} from "@/components/logo";
import {Marker} from "@/components/marker";
import {Button} from "@/components/button";
import {categories, subnote} from "./hero.data";

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
                {categories.map(elem => (
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
                            {categories.map(elem => (
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
                        <span className="promo-eyebrow">
                            Проектирование и монтаж
                        </span>
                        <h2 className="promo-heading">
                            Системы безопасности для бизнеса и объектов
                        </h2>
                        <p className="promo-text">
                            Проектируем, монтируем и обслуживаем системы
                            безопасности для предприятий и объектов.
                            Работаем в Электростали и Московской области.
                            Берем на себя весь цикл — от обследования до
                            круглосуточного мониторинга.
                        </p>
                        <div className="promo-subnote">
                            {subnote.map((item, i, arr) => (
                                <span key={item} className="promo-subnote__item">
                                    {item}
                                    {(i !== arr.length - 1) && <Marker />}
                                </span>
                            ))}
                        </div>
                        <div className="promo-actions">
                            <Button mode="primary" onClick={onOpenQuiz}>
                                Получить расчет
                            </Button>

                            <Button mode="secondary">
                                Консультация
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}