'use client';

import Link from 'next/link';
import {services, servicesIntro} from '../config/service.data';
import {Heading} from '@/components/heading';
import './services.styles.scss';

const ServicesPage = () => (
    <main className="services">
        <div className="services__glow services__glow--left"/>
        <div className="services__glow services__glow--right"/>

        <div className="container">
            <section className="services__hero">
                <Heading eyebrow='ООО "КВАДРО-АРСЕНАЛ"' mode="dark" as="h1">
                    Системы безопасности для вашего объекта
                </Heading>

                <p className="services__description">
                    Проектируем, устанавливаем и обслуживаем инженерные системы безопасности. Подбираем
                    оборудование под задачи объекта.
                </p>
            </section>

            <section className="services-company">
                <Heading mode="dark">Услуги</Heading>
                <div className="services-company__content">
                    {servicesIntro.map((item) => (
                        <div key={item.title} className="services-company__item">
                            <div className="services-company__line"/>
                            <div className="services-company__text">
                                <h3>{item.title}</h3>
                                <p>{item.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="services__grid">
                {services.map((service) => (
                    <article className="service-card" key={service.slug}>
                        <div className="service-card__top">
                            <span>Услуга</span>
                            <h2>{service.title}</h2>
                        </div>
                        <p>{service.description}</p>

                        <ul>
                            {service.features.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>

                        <Link href={`/services/${service.slug}`} className="service-card__link">
                            <span>Подробнее</span>
                            <span className="service-card__arrow">→</span>
                        </Link>
                    </article>
                ))}
            </section>

            <section className="services__cta">
                <div className="services-cta">
                    <div>
                        <Heading eyebrow="Нужна система безопасности?" mode="dark" as="h2">
                            Подготовим решение под ваш объект
                        </Heading>
                        <p>Выполним обследование, подберём оборудование и рассчитаем стоимость.</p>
                    </div>

                    <a href="tel:+74951234567" className="services-cta__button">
                        Получить консультацию
                    </a>
                </div>
            </section>
        </div>
    </main>
);

export default ServicesPage;
