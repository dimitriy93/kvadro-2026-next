import mapImage from "@/app/_assets/images/common/map.webp";
import officeImage from "@/app/_assets/images/office_pic.webp";
import Image from "next/image";
import Link from "next/link";
import {Heading} from "@/components/heading";
import "./contacts.styles.scss";

const ContactsPage = () => (
    <main className="contacts">
        <div className="contacts__glow contacts__glow--left"/>
        <div className="contacts__glow contacts__glow--right"/>

        <div className="container">
            <section className="contacts__hero">
                <Heading eyebrow={`ООО "КВАДРО-АРСЕНАЛ"`} mode="dark" as="h1">
                    Свяжитесь с нами удобным способом
                </Heading>
                <p className="contacts__description">
                    Ответим на вопросы, проконсультируем по оборудованию
                    и поможем подобрать решение для вашего объекта.
                </p>
            </section>

            <section className="contacts__cards">
                <article className="contacts-card">
                <span className="contacts-card__label">
                    Телефон
                </span>
                    <a href="tel:+74951234567" className="contacts-card__value link">
                        +7 (495) 123-45-67
                    </a>
                    <p className="contacts-card__hint">
                        Рабочие часы · 09:00–18:00
                    </p>
                </article>

                <article className="contacts-card">
                <span className="contacts-card__label">
                    Электронная почта
                </span>
                    <a href="mailto:info@kvadro-arsenal.ru" className="contacts-card__value link">
                        info@kvadro-arsenal.ru
                    </a>
                    <p className="contacts-card__hint">
                        Отвечаем в течение рабочего дня
                    </p>
                </article>

                <article className="contacts-card">
                <span className="contacts-card__label">
                    Адрес
                </span>
                    <div className="contacts-card__value">
                        Московская область,
                        Электросталь, ул.&nbsp;Чернышевского 20
                    </div>
                    <p className="contacts-card__hint">
                        Работаем по городу и Московской области
                    </p>
                </article>
            </section>

            <section className="contacts__map">
                <div className="contacts__section-header">
                    <h2>Как нас найти</h2>
                    <p>
                        Офис и расположение на карте
                    </p>
                </div>

                <div className="contacts-location">
                    <div className="contacts-location__photo">
                        <Image
                            src={officeImage}
                            alt="Офис Квадро-Арсенал"
                            fill
                            className="contacts-location__image"
                        />
                        <div className="contacts-location__overlay">
                            <span>Наш офис</span>
                        </div>
                    </div>

                    <Link
                        href="https://yandex.ru/maps/org/kvadro_arsenal/1290904928/"
                        target="_blank"
                        className="contacts-location__map"
                    >
                        <Image
                            src={mapImage}
                            alt="Карта проезда"
                            fill
                            className="contacts-location__image"
                        />
                        <div className="contacts-location__content">
                            <strong>
                                Мы на Яндекс Картах
                            </strong>
                            <span>Построить маршрут →</span>
                        </div>
                    </Link>

                </div>

            </section>

            <section className="contacts__cta">
                <div className="contacts-cta">
                    <div className="contacts-cta__content">
                        <Heading eyebrow="Нужна консультация?" mode="dark" as="h2">
                            Подберём решение под ваш объект
                        </Heading>
                        <p>
                            Поможем определить состав оборудования,
                            подготовим предварительный расчёт
                            и ответим на технические вопросы.
                        </p>
                    </div>
                    <a href="tel:+74951234567" className="contacts-cta__button">
                        Связаться с нами
                    </a>
                </div>
            </section>
        </div>

    </main>
);

export default ContactsPage;