'use client';

import {ConsultationBlock} from "@/components/consultation-block";
import {useState} from "react";
import Image from 'next/image';
import fireAlarmDesignImage from '@/app/_assets/images/services/fire-alarm-design.webp';
import {useConsultation} from "@/providers/consultation-provider";
import {Heading} from "@/components/heading";
import {
    advantages,
    deliverables,
    faq,
    heroIntro,
    objectTypes,
    projectDocumentation,
    regulations,
    whyUs,
    workflowSteps,
    works
} from "@/app/(pages)/services/fire-alarm-design/fire-alarm-design.data";
import {Button} from "@/components/button";
import {getWorkIcon, IconCheck, IconDocument} from "@/components/service-icons";
import {SpotlightCard} from "@/components/spotlight-card";

const FireAlarmDesignPage = () => {
    const [activeFaq, setActiveFaq] = useState<number | null>(null);
    const {openConsultation} = useConsultation();

    return (
        <main className="sp sp--fire-design">
            <div className="sp__glow sp__glow--left"/>
            <div className="sp__glow sp__glow--right"/>

            <div className="container">
                <section className="sp-hero">
                    <div className="sp-hero__content">
                        <Heading eyebrow="Проектирование ПС и СОУЭ" mode="dark" as="h1">
                            Разработка проектов пожарной сигнализации и систем оповещения
                        </Heading>

                        <p className="sp-hero__lead">
                            {heroIntro[0]}
                        </p>

                        <div className="sp-hero__actions">
                            <Button mode="primary-inverted" onClick={openConsultation}>
                                Получить консультацию
                            </Button>
                        </div>
                    </div>

                    <div className="sp-hero__image">
                        <Image
                            src={fireAlarmDesignImage}
                            alt="Проектирование систем пожарной сигнализации"
                            fill
                            priority
                        />

                        <span className="sp-hero__badge">
              Проектный отдел инженерных систем
            </span>
                    </div>
                </section>

                <section
                    className="sp-advantages"
                    aria-label="Преимущества проектирования"
                >
                    {advantages.map((item) => (
                        <article
                            className="sp-advantage"
                            key={item.label}
                        >
                            <strong>{item.label}</strong>

                            <span>
                {item.text}
              </span>
                        </article>
                    ))}
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Профессиональное проектирование систем пожарной безопасности
                    </Heading>

                    <div className="sp-intro">
                        {heroIntro.slice(1).map((paragraph) => (
                            <p key={paragraph.slice(0, 40)}>
                                {paragraph}
                            </p>
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
                                <SpotlightCard
                                    className="sp-work"
                                    key={work.title}
                                >
                                    <div className="sp-work__head">
                                        <div className="sp-work__icon">
                                            <Icon/>
                                        </div>

                                        <h3>
                                            {work.title}
                                        </h3>
                                    </div>

                                    <p className="sp-work__desc">
                                        {work.description}
                                    </p>

                                    <ul>
                                        {work.items.map((item) => (
                                            <li key={item}>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>

                                    {'note' in work && work.note && (
                                        <p className="sp-work__note">
                                            {/*{work.note}*/}
                                        </p>
                                    )}
                                </SpotlightCard>
                            );
                        })}
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Как проходит проектирование
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

                                <h3>
                                    {step.title}
                                </h3>

                                <p>
                                    {step.text}
                                </p>
                            </SpotlightCard>
                        ))}
                    </div>
                </section>
                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Для каких объектов выполняем проектирование
                    </Heading>

                    <p className="sp-regulations__intro">
                        Разрабатываем проектные решения для объектов различного назначения:
                    </p>

                    <div className="sp-objects">
                        {objectTypes.map((item) => (
                            <span className="sp-object-tag" key={item}>
                            {item}
                        </span>
                        ))}
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Состав проектной документации
                    </Heading>

                    <p className="sp-regulations__intro">
                        По завершении работ заказчик получает полный комплект документации,
                        необходимый для монтажа, согласования и дальнейшей эксплуатации системы.
                    </p>

                    <div className="sp-deliverables">
                        {projectDocumentation.map((item) => (
                            <SpotlightCard
                                className="sp-deliverable"
                                key={item.title}
                            >
                                <div className="sp-deliverable__icon">
                                    <IconDocument/>
                                </div>

                                <h3>
                                    {item.title}
                                </h3>

                                <p>
                                    {item.text}
                                </p>
                            </SpotlightCard>
                        ))}
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Что получает заказчик после выполнения проекта
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

                                <h3>
                                    {item.title}
                                </h3>

                                <p>
                                    {item.text}
                                </p>
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
                            <div className="sp-why__item" key={item}>
                                <IconCheck/>
                                <span>
                                  {item}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Нормативные документы
                    </Heading>

                    <p className="sp-regulations__intro">
                        При разработке проектной документации руководствуемся действующими
                        нормативными требованиями Российской Федерации в области пожарной
                        безопасности, проектирования и строительства.
                    </p>

                    <div className="sp-regulations">
                        {regulations.map((group) => (
                            <SpotlightCard
                                className="sp-regulation"
                                key={group.title}
                            >
                                <h3>
                                    {group.title}
                                </h3>
                                <ul>
                                    {group.items.map((item) => (
                                        <li key={item}>
                                            {item}
                                        </li>
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
                                className={`sp-faq__item ${activeFaq === index ? 'active' : ''}`}
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setActiveFaq(
                                            activeFaq === index ? null : index
                                        )
                                    }
                                    aria-expanded={activeFaq === index}
                                >
                                  <span>
                                    {item.title}
                                  </span>
                                    <span className="sp-faq__toggle" aria-hidden>
                                        +
                                    </span>
                                </button>

                                <div className="sp-faq__answer">
                                    <p>
                                        {item.text}
                                    </p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <ConsultationBlock
                    eyebrow="Разработаем проект пожарной сигнализации для вашего объекта"
                    heading="Получите консультацию инженера"
                    buttonText="Связаться с нами"
                >
                    Подготовим проектную документацию для систем пожарной сигнализации и
                    СОУЭ с учетом требований нормативных документов и особенностей вашего
                    объекта.

                    Наши специалисты помогут определить оптимальное техническое решение,
                    подготовят комплект документации и обеспечат сопровождение проекта
                    на всех этапах реализации.
                </ConsultationBlock>
            </div>
        </main>
    );
};

export default FireAlarmDesignPage;