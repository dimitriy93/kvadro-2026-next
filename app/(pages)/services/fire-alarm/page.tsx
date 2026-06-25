"use client";
import {useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {faq, includes, objects, stages, works} from "./fire-alarm.data";
import fireAlarmImage from "@/app/_assets/images/services/fire-alarm.webp";
import {Heading} from "@/components/heading";
import {ConsultationBlock} from "@/components/consultation-block";
import "./fire-alarm.styles.scss";

const FireAlarmPage = () => {
    const [activeFaq, setActiveFaq] = useState<number | null>(null);

    return (
        <main className="service-page">
            <div className="service-page__glow"/>

            <div className="container">
                <section className="service-hero">
                    <div className="service-hero__content">
                        <Heading eyebrow="Пожарная безопасность" mode="dark" as="h1">
                            Проектирование и монтаж пожарных систем
                        </Heading>

                        <p>
                            Создаём комплексные системы пожарной безопасности
                            для коммерческих и промышленных объектов.
                            От проекта до технического обслуживания.
                        </p>
                        <Link href="/contacts" className="service-button">
                            Получить консультацию
                        </Link>
                    </div>
                    <div className="service-hero__image">
                        <Image src={fireAlarmImage} alt="Монтаж пожарной сигнализации" fill />
                    </div>
                </section>

                <section className="service-section">
                    <Heading mode="dark">
                        Пожарная сигнализация
                    </Heading>

                    <div className="service-text">
                        <p>
                            Система пожарной сигнализации предназначена
                            для своевременного обнаружения признаков возгорания
                            и передачи сигнала о пожаре.
                        </p>
                        <p>
                            Решения разрабатываются с учётом назначения объекта,
                            особенностей здания и требований пожарной безопасности.
                        </p>
                    </div>
                </section>

                <section className="service-section">
                    <Heading mode="dark" as="h3">
                        Нормативная база
                    </Heading>

                    <div className="service-regulations">
                        <p>
                            При проектировании и монтаже систем безопасности
                            руководствуемся требованиями действующих документов:
                        </p>
                        <ul>
                            <li>Федеральный закон №69-ФЗ «О пожарной безопасности»</li>
                            <li>Федеральный закон №123-ФЗ «Технический регламент о требованиях пожарной безопасности»</li>
                            <li>СП 484.1311500.2020 «Системы пожарной сигнализации»</li>
                            <li>СП 3.13130.2009 «Системы оповещения и управления эвакуацией»</li>
                        </ul>
                    </div>
                </section>

                <section className="service-section">
                    <Heading mode="dark" as="h3">
                        Что мы выполняем
                    </Heading>

                    <div className="service-list">
                        {works.map(item => (
                            <article className="service-list__item" key={item.title}>
                                <div className="service-list__line"/>
                                <div>
                                    <h3>{item.title}</h3>
                                    <p>{item.text}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="service-grid">
                    <article className="service-card">
                        <h3>
                            В состав работ входит
                        </h3>

                        <ul className="service-tags">
                            {includes.map(item => (
                                <li key={item}>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </article>

                    <article className="service-card">
                        <h3>
                            Объекты применения
                        </h3>

                        <ul className="service-tags">
                            {objects.map(item => (
                                <li key={item}>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </article>
                </section>

                <section className="service-section">
                    <Heading mode="dark" as="h3">
                        Этапы работы
                    </Heading>

                    <div className="service-timeline">
                        {stages.map((item,index) => (
                            <div
                                className="service-timeline__item"
                                key={item}
                            >
                                <div className="service-timeline__number">
                                    {index + 1}
                                </div>
                                <p>
                                    {item}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="service-section">
                    <Heading mode="dark" as="h3">
                        Частые вопросы
                    </Heading>

                    <div className="service-faq">
                        {faq.map((item,index) => (
                            <article
                                key={item.title}
                                className={`service-faq__item ${activeFaq === index ? "active" : ""}`}
                            >
                                <button onClick={() => setActiveFaq(activeFaq === index ? null : index)}>
                                    <span>
                                        {item.title}
                                    </span>
                                    <b>
                                        +
                                    </b>
                                </button>
                                <div className="service-faq__answer">
                                    <p>
                                        {item.text}
                                    </p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <ConsultationBlock
                    eyebrow="Квадро-Арсенал"
                    heading="Рассчитаем решение под ваш объект"
                    buttonText="Связаться с нами"
                />
            </div>

        </main>
    );
};

export default FireAlarmPage;