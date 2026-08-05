'use client';

import Image from 'next/image';
import {useState} from 'react';
import {useConsultation} from '@/providers/consultation-provider';
import videoSurveillanceImage from '@/app/_assets/images/service_security_monitoring.webp';
import {getWorkIcon, IconCheck, IconDocument} from "@/components/service-icons";
import {ConsultationBlock} from '@/components/consultation-block';
import {SpotlightCard} from "@/components/spotlight-card";
import {Heading} from '@/components/heading';
import {Button} from '@/components/button';
import {
    deliverables,
    equipmentBrands,
    faq,
    heroIntro,
    objectTypes,
    regulations,
    whyUs,
    workflowSteps,
    works,
} from '../config/video-surveillance.data';
import './video-surveillance.styles.scss';

const VideoSurveillancePage = () => {
    const [activeFaq, setActiveFaq] = useState<number | null>(null);
    const {openConsultation} = useConsultation();

    return (
        <main className="sp sp--video">
            <div className="sp__glow sp__glow--left"/>
            <div className="sp__glow sp__glow--right"/>

            <div className="container">
                <section className="sp-hero">
                    <div className="sp-hero__content">
                        <Heading eyebrow="Видеонаблюдение" mode="dark" as="h1">
                            Проектирование и монтаж систем видеонаблюдения
                        </Heading>
                        <p className="sp-hero__lead">{heroIntro[0]}</p>
                        <div className="sp-hero__actions">
                            <Button mode="primary-inverted" onClick={openConsultation}>
                                Получить консультацию
                            </Button>
                        </div>
                    </div>

                    <div className="sp-hero__image">
                        <Image src={videoSurveillanceImage} alt="Система видеонаблюдения" fill priority/>
                        <span className="sp-hero__badge">Видеоконтроль и безопасность</span>
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Современные системы видеоконтроля
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
                                <SpotlightCard className="sp-work" key={work.title}>
                                    <div className="sp-work__head">
                                        <div className="sp-work__icon">
                                            <Icon/>
                                        </div>
                                        <h3>{work.title}</h3>
                                    </div>
                                    <p className="sp-work__desc">{work.description}</p>
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
                        Для каких объектов
                    </Heading>
                    <p className="sp-regulations__intro">
                        Мы устанавливаем системы видеонаблюдения на объектах любого назначения:
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
                        Как проходит работа
                    </Heading>
                    <div className="sp-workflow">
                        {workflowSteps.map((step, index) => (
                            <SpotlightCard className="sp-step" key={step.title}>
                                <span className="sp-step__num">{String(index + 1).padStart(2, '0')}</span>
                                <h3>{step.title}</h3>
                                <p>{step.text}</p>
                            </SpotlightCard>
                        ))}
                    </div>
                </section>

                <section className="sp-section">
                    <Heading mode="dark" as="h2">
                        Что получает заказчик
                    </Heading>
                    <div className="sp-deliverables">
                        {deliverables.map((item) => (
                            <SpotlightCard className="sp-deliverable" key={item.title}>
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
                        Мы применяем оборудование ведущих производителей систем видеонаблюдения.
                    </p>
                    <div className="sp-equipment">
                        {equipmentBrands.map((brand) => (
                            <article className="sp-brand" key={brand.name}>
                                <div className="sp-brand__logo-wrap">
                                    <img src={brand.logo.src || brand.logo} alt={brand.name}/>
                                </div>
                                <span className="sp-brand__name">{brand.name}</span>
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
                        Проектирование и монтаж систем видеонаблюдения выполняются с учётом действующих
                        нормативных требований Российской Федерации.
                    </p>
                    <div className="sp-regulations">
                        {regulations.map((group) => (
                            <SpotlightCard className="sp-regulation" key={group.title}>
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
                                className={`sp-faq__item ${activeFaq === index ? 'active' : ''}`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                                    aria-expanded={activeFaq === index}
                                >
                                    <span>{item.title}</span>
                                    <span className="sp-faq__toggle" aria-hidden>
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
                    eyebrow="Современные системы видеонаблюдения для надёжной защиты вашего объекта"
                    heading="Получите консультацию специалиста"
                    buttonText="Связаться с нами"
                >
                    Разработаем эффективную систему видеоконтроля, выполним профессиональный монтаж
                    оборудования, настроим удалённый доступ и обеспечим дальнейшее техническое
                    сопровождение. Свяжитесь с нашими специалистами, чтобы получить консультацию и подобрать
                    оптимальное решение для вашего объекта.
                </ConsultationBlock>
            </div>
        </main>
    );
};

export default VideoSurveillancePage;
