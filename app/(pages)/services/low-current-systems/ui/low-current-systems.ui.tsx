'use client';

import {Breadcrumbs} from "@/components/breadcrumbs";
import Image from 'next/image';
import {useConsultation} from "@/providers/consultation-provider";
import {useState} from "react";
import {lowCurrentSystemImg} from "@/app/_assets/images/services";
import {getWorkIcon, IconCheck, IconDocument} from "@/components/service-icons";
import {ConsultationBlock} from "@/components/consultation-block";
import {SpotlightCard} from "@/components/spotlight-card";
import {Heading} from "@/components/heading";
import {Button} from "@/components/button";
import {
    advantages,
    deliverables,
    equipmentBrands,
    faq,
    heroIntro,
    objectTypes,
    regulations,
    systems,
    whyUs,
    workflowSteps,
    works
} from "../config/low-current-systems.data";

const LowCurrentSystemsPage = () => {
    const [activeFaq, setActiveFaq] = useState<number | null>(null);
    const {openConsultation} = useConsultation();

    return (
        <main className="sp sp--low-current">
            <div className="sp__glow sp__glow--left"/>
            <div className="sp__glow sp__glow--right"/>

            <div className="container">
                <Breadcrumbs/>
                <section className="sp-hero">
                    <div className="sp-hero__content">
                        <Heading eyebrow="Слаботочные системы" mode="dark" as="h1">
                            Проектирование и монтаж инженерных слаботочных систем
                        </Heading>

                        <p className="sp-hero__lead">{heroIntro[0]}</p>

                        <div className="sp-hero__actions">
                            <Button mode="primary-inverted" onClick={openConsultation}>
                                Получить консультацию
                            </Button>
                        </div>
                    </div>

                    <div className="sp-hero__image">

                        <Image src={lowCurrentSystemImg} alt="Слаботочные системы" fill priority/>
                        <span className="sp-hero__badge">
                          Комплексные инженерные решения
                        </span>
                    </div>
                </section>

                <section
                    className="sp-advantages"
                    aria-label="Преимущества компании"
                >
                    {advantages.map((item) => (
                        <article className="sp-advantage" key={item.label}>
                            <strong>{item.label}</strong>
                            <span>{item.text}</span>
                        </article>
                    ))}
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Комплексные инженерные системы
                    </Heading>

                    <div className="sp-intro">
                        {heroIntro.slice(1).map((paragraph) => (
                            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
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
                        Какие системы мы реализуем
                    </Heading>

                    <div className="sp-works">
                        {systems.map((system, index) => {
                            const Icon = getWorkIcon(index);

                            return (
                                <SpotlightCard
                                    className="sp-work"
                                    key={system.title}
                                >
                                    <div className="sp-work__head">
                                        <div className="sp-work__icon">
                                            <Icon/>
                                        </div>

                                        <h3>{system.title}</h3>
                                    </div>

                                    <p className="sp-work__desc">
                                        {system.description}
                                    </p>

                                    <ul>
                                        {system.items.map((item) => (
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
                        Как проходит работа
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
                        Для каких объектов
                    </Heading>

                    <p className="sp-regulations__intro">
                        Мы проектируем и внедряем инженерные слаботочные системы для объектов различного
                        назначения:
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
                        Что получает заказчик по завершении проекта
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
                        Используемое оборудование
                    </Heading>

                    <p className="sp-regulations__intro">
                        При реализации проектов применяем оборудование и комплектующие ведущих производителей,
                        что обеспечивает надежность инженерной инфраструктуры, совместимость компонентов и
                        возможность дальнейшего масштабирования системы.
                    </p>

                    <div className="sp-equipment">
                        {equipmentBrands.map((brand) => (
                            <article className="sp-brand" key={brand.name}>
                                <div className="sp-brand__logo-wrap">
                                    <img src={brand.logo.src || brand.logo} alt={brand.name}/>
                                </div>

                                <span className="sp-brand__name">
                                    {brand.name}
                                </span>

                                <p>{brand.text}</p>
                            </article>
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
                        При проектировании и монтаже инженерных слаботочных систем мы руководствуемся
                        действующим законодательством Российской Федерации, строительными нормами,
                        государственными стандартами и требованиями к инженерной инфраструктуре зданий.
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
                                className={`sp-faq__item ${
                                    activeFaq === index ? 'active' : ''
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setActiveFaq(
                                            activeFaq === index ? null : index,
                                        )
                                    }
                                    aria-expanded={activeFaq === index}
                                >
                                    <span>{item.title}</span>

                                    <span className="sp-faq__toggle" aria-hidden>+</span>
                                </button>

                                <div className="sp-faq__answer">
                                    <p>{item.text}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <ConsultationBlock
                    eyebrow="Создадим современную инженерную инфраструктуру вашего объекта"
                    heading="Получите консультацию инженера"
                    buttonText="Связаться с нами"
                >
                    Мы разработаем комплексное решение по созданию слаботочных систем с учётом назначения
                    объекта, требований нормативной документации и ваших задач. Выполним проектирование,
                    монтаж, пусконаладочные работы и дальнейшее техническое сопровождение инженерных систем.
                    Свяжитесь с нами, чтобы получить консультацию инженера и рассчитать стоимость проекта.
                </ConsultationBlock>
            </div>
        </main>
    );
};

export default LowCurrentSystemsPage;
