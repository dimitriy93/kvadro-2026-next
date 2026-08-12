import mapImage from '@/app/_assets/images/common/map.webp';
import officeImage from '@/app/_assets/images/office_pic.webp';
import Image from 'next/image';
import Link from 'next/link';
import {contacts} from "@/config/brand/contacts";
import {ConsultationBlock} from '@/components/consultation-block';
import {Breadcrumbs} from "@/components/breadcrumbs";
import {Heading} from '@/components/heading';
import './contacts.styles.scss';

const ContactsPage = () => (
    <main className="contacts">
        <div className="contacts__glow contacts__glow--left"/>
        <div className="contacts__glow contacts__glow--right"/>

        <div className="container">
            <Breadcrumbs/>
            <section className="contacts__hero">
                <Heading eyebrow={`ООО "КВАДРО-АРСЕНАЛ"`} mode="dark" as="h1">
                    Свяжитесь с нами удобным способом
                </Heading>
                <p className="contacts__description">
                    Ответим на вопросы, проконсультируем по оборудованию и поможем подобрать решение для
                    вашего объекта.
                </p>
            </section>

            <section className="contacts__cards">
                <article className="contacts-card">
                    <span className="contacts-card__label">Телефон</span>
                    <a href={contacts.phoneLink} className="contacts-card__value link">
                        {contacts.phone}
                    </a>
                    <p className="contacts-card__hint">Рабочие часы · 09:00–18:00</p>
                </article>

                <article className="contacts-card">
                    <span className="contacts-card__label">Электронная почта</span>
                    <a href={contacts.emailLink} className="contacts-card__value link">
                        {contacts.email}
                    </a>
                    <p className="contacts-card__hint">Отвечаем в течение рабочего дня</p>
                </article>

                <article className="contacts-card">
                    <span className="contacts-card__label">Адрес</span>
                    <div className="contacts-card__value">
                        Московская область, г. Электросталь, ул. Чернышевского 20
                    </div>
                    <p className="contacts-card__hint">Работаем по городу и Московской области</p>
                </article>
            </section>

            <section className="contacts__map">
                <div className="contacts__section-header">
                    <h2>Как нас найти</h2>
                    <p>Офис и расположение на карте</p>
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
                        href={contacts.mapLink}
                        target="_blank"
                        className="contacts-location__map"
                    >
                        <Image src={mapImage} alt="Карта проезда" fill className="contacts-location__image"/>
                        <div className="contacts-location__content">
                            <strong>Мы на Яндекс Картах</strong>
                            <span>Построить маршрут →</span>
                        </div>
                    </Link>
                </div>
            </section>

            <ConsultationBlock
                eyebrow="Нужна консультация?"
                heading="Подберём решение под ваш объект"
                buttonText="Связаться с нами"
            >
                Поможем определить состав оборудования, подготовим предварительный расчёт и ответим на
                технические вопросы.
            </ConsultationBlock>
        </div>
    </main>
);

export default ContactsPage;
