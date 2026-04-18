"use client";
import {useState} from "react";
import {Logo} from "@/components/Logo";
import {FloatingMenu} from "@/widgets/FloatingMenu";

const categories = [
    {num: '01', id: 'bg-fire', title: 'Пожарная безопасность'},
    {num: '02', id: 'bg-alarm', title: 'Охранная сигнализация'},
    {num: '03', id: 'bg-low-voltage', title: 'Слаботочные инженерные системы'},
    {num: '04', id: 'bg-security-services', title: 'Охранные услуги'},
]

function Page () {
    const [activeBg, setActiveBg] = useState<string | null>(null);
    // const [menuOpen, setMenuOpen] = useState<boolean>(false);

    const handleCategoryEnter = (bg: string) => {
        setActiveBg(bg);
    }

    const handleCategoryLeave = () => {
        setActiveBg(null);
    }

    return (
        <>
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

            <div className="main">
                <div className="main__wrap container">
                    <div className="main__left">
                        <Logo />
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
                      Системы безопасности
                    </span>
                        <h2 className="promo-heading">
                            Комплексные решения
                            в сфере безопасности
                        </h2>
                        <p className="promo-text">
                            ООО ПМО «Квадро-Арсенал» реализует инженерные
                            системы безопасности, противопожарные комплексы
                            и охранные решения для предприятий и объектов
                            различной сложности.
                        </p>

                        <div className="promo-actions">
                            <button className="btn-primary">Позвонить нам</button>
                            <button className="btn-secondary">Вакансии</button>
                        </div>
                    </div>
                </div>
            </div>

            <FloatingMenu />
        </>
    )
}

export default Page;