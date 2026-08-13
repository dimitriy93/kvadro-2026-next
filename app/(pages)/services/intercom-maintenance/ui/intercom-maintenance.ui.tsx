'use client';

import Image from 'next/image';
import {useConsultation} from "@/providers/consultation-provider";
import {useState} from "react";
import intercomMaintenanceImage from '@/app/_assets/images/services/intercom-maintenance.webp';
import {getWorkIcon, IconCheck, IconDocument} from "@/components/service-icons";
import {ConsultationBlock} from "@/components/consultation-block";
import {SpotlightCard} from "@/components/spotlight-card";
import {Heading} from "@/components/heading";
import {Button} from "@/components/button";
import {
    advantages, deliverables,
    faq,
    heroIntro, objectTypes, regulations, whyUs,
    workflowSteps,
    works
} from "../config/intercom-maintenance.data";

const IntercomMaintenancePage = () => {
    const [activeFaq, setActiveFaq] = useState<number | null>(null);
    const {openConsultation} = useConsultation();

    return (
        <main className="sp sp--intercom">
            <div className="sp__glow sp__glow--left"/>
            <div className="sp__glow sp__glow--right"/>

            <div className="container">
                <section className="sp-hero">
                    <div className="sp-hero__content">
                        <Heading eyebrow="Обслуживание домофонов" mode="dark" as="h1">
                            Техническое обслуживание и ремонт домофонных систем
                        </Heading>

                        <p className="sp-hero__lead">{heroIntro[0]}</p>

                        <div className="sp-hero__actions">
                            <Button mode="primary-inverted" onClick={openConsultation}>
                                Оставить заявку
                            </Button>
                        </div>
                    </div>

                    <div className="sp-hero__image">
                        <Image src={intercomMaintenanceImage} alt="Обслуживание домофонов" fill priority/>
                        <span className="sp-hero__badge">
              Надёжная эксплуатация систем доступа
            </span>
                    </div>
                </section>

                <section className="sp-advantages">
                    {advantages.map((item) => (
                        <article className="sp-advantage" key={item.label}>
                            <strong>{item.label}</strong>
                            <span>{item.text}</span>
                        </article>
                    ))}
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Профессиональное сервисное обслуживание
                    </Heading>

                    <div className="sp-intro">
                        {heroIntro.slice(1).map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                        ))}
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Какие работы мы выполняем
                    </Heading>

                    <div className="sp-works">
                        {works.map((work, index) => {
                            const Icon = getWorkIcon(index);

                            return (
                                <SpotlightCard className="sp-work" key={work.title}>
                                    <div className="sp-work__head">
                                        <div className="sp-work__icon">
                                            <Icon/>
                                        </div>

                                        <h3>{work.title}</h3>
                                    </div>

                                    <p className="sp-work__desc">
                                        {work.description}
                                    </p>

                                    <ul>
                                        {work.items.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                </SpotlightCard>
                            );
                        })}
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Как проходит обслуживание
                    </Heading>

                    <div className="sp-workflow">
                        {workflowSteps.map((step, index) => (
                            <SpotlightCard
                                className="sp-step"
                                key={step.title}
                            >
                <span className="sp-step__num">
                  {String(index + 1).padStart(2, '0')}
                </span>

                                <h3>{step.title}</h3>

                                <p>{step.text}</p>
                            </SpotlightCard>
                        ))}
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Какие объекты обслуживаем
                    </Heading>

                    <p className="sp-regulations__intro">
                        Выполняем обслуживание домофонных систем на объектах любого
                        назначения.
                    </p>

                    <div className="sp-objects">
                        {objectTypes.map((item) => (
                            <span
                                className="sp-object-tag"
                                key={item}
                            >
                {item}
              </span>
                        ))}
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Что получает заказчик
                    </Heading>

                    <div className="sp-deliverables">
                        {deliverables.map((item) => (
                            <SpotlightCard
                                className="sp-deliverable"
                                key={item.title}
                            >
                                <div className="sp-deliverable__icon">
                                    <IconDocument/>
                                </div>

                                <h3>{item.title}</h3>

                                <p>{item.text}</p>
                            </SpotlightCard>
                        ))}
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Почему выбирают нас
                    </Heading>

                    <div className="sp-why">
                        {whyUs.map((item) => (
                            <div
                                className="sp-why__item"
                                key={item}
                            >
                                <IconCheck/>
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Нормативные документы
                    </Heading>

                    <p className="sp-regulations__intro">
                        При техническом обслуживании домофонных систем мы руководствуемся
                        действующим законодательством Российской Федерации, требованиями
                        производителей оборудования и нормативными документами,
                        регламентирующими эксплуатацию инженерных систем зданий.
                    </p>

                    <div className="sp-regulations">
                        {regulations.map((group) => (
                            <SpotlightCard
                                className="sp-regulation"
                                key={group.title}
                            >
                                <h3>{group.title}</h3>

                                <ul>
                                    {group.items.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            </SpotlightCard>
                        ))}
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Часто задаваемые вопросы
                    </Heading>

                    <div className="sp-faq">
                        {faq.map((item, index) => (
                            <article
                                key={item.title}
                                className={`sp-faq__item ${
                                    activeFaq === index ? 'active' : ''
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setActiveFaq(activeFaq === index ? null : index)
                                    }
                                    aria-expanded={activeFaq === index}
                                >
                                    <span>{item.title}</span>

                                    <span
                                        className="sp-faq__toggle"
                                        aria-hidden
                                    >
                    +
                  </span>
                                </button>

                                <div className="sp-faq__answer">
                                    <p>{item.text}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <ConsultationBlock
                    eyebrow="Надёжная работа домофонной системы начинается с регулярного обслуживания"
                    heading="Получите консультацию инженера"
                    buttonText="Оставить заявку"
                >
                    Мы выполняем техническое обслуживание, диагностику, ремонт и
                    модернизацию домофонных систем на объектах любого назначения.
                    Поможем восстановить работоспособность оборудования, организуем
                    регулярное сервисное сопровождение и обеспечим стабильную работу
                    системы контроля доступа. Свяжитесь с нами, чтобы получить
                    консультацию специалиста и подобрать оптимальный вариант
                    обслуживания.
                </ConsultationBlock>
            </div>
        </main>
    );
};

export default IntercomMaintenancePage;