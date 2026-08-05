'use client';

import Image from 'next/image';
import {documentsImg} from '@/app/_assets/images/documents';
import {ConsultationBlock} from '@/components/consultation-block';
import {SpotlightCard} from '@/components/spotlight-card';
import {IconDocument} from "@/components/service-icons";
import {Breadcrumbs} from "@/components/breadcrumbs";
import {Heading} from '@/components/heading';
import './documents.styles.scss';

const DocumentsPage = () => (
    <main className="documents">

        <div className="documents__glow documents__glow--left"/>
        <div className="documents__glow documents__glow--right"/>

        <div className="container">
            <Breadcrumbs/>
            <section className="documents-hero">
                <div className="documents-hero__content">
                    <Heading eyebrow='ООО "КВАДРО-АРСЕНАЛ"' mode="dark" as="h1">
                        Лицензии, допуски и документы компании
                    </Heading>
                    <p className="documents-hero__lead">
                        Работаем официально и подтверждаем квалификацию компании
                        открытыми государственными реестрами.
                        Предоставляем полный комплект документов для объектов
                        различного назначения.
                    </p>
                </div>
                <div className="documents-hero__image">
                    <Image src={documentsImg} alt="Документы проектно-монтажной организации" fill priority/>
                    <div className="documents-hero__badge">
                        <span className="documents-status">
                          <i/>
                          Официальные реестры и лицензии
                        </span>
                    </div>
                </div>
            </section>

            <section className="documents-section">
                <Heading mode="dark" as="h2">
                    Лицензии МЧС России
                </Heading>
                <p className="documents-section__intro">
                    Компания имеет необходимые разрешительные документы
                    для выполнения работ в области пожарной безопасности.
                    Проверка доступна через официальный цифровой сервис
                    МЧС России.
                </p>
                <div className="documents-grid">
                    <SpotlightCard className="documents-card">
                        <div className="documents-card__top">
                            <div className="documents-card__icon">
                                <IconDocument/>
                            </div>
                            <div className="documents-card__status">
                                <span/>
                                Данные подтверждены
                            </div>
                        </div>
                        <div className="documents-card__content">
                        <span className="documents-card__type">
                            Лицензия МЧС
                        </span>
                            <h3>
                                ООО ПМО «Квадро-Арсенал»
                            </h3>
                            <p>
                                Проектирование, монтаж, техническое обслуживание
                                и ремонт систем противопожарной защиты.
                            </p>
                            <a
                                href="https://digital.mchs.gov.ru/fgpn/license?search=5053032189"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link"
                            >
                                Проверить в реестре →
                            </a>
                        </div>
                    </SpotlightCard>

                    <SpotlightCard className="documents-card">
                        <div className="documents-card__top">
                            <div className="documents-card__icon">
                                <IconDocument/>
                            </div>
                            <div className="documents-card__status">
                                <span/>
                                Данные подтверждены
                            </div>
                        </div>
                        <div className="documents-card__content">
                            <span className="documents-card__type">
                                Лицензия МЧС
                            </span>
                            <h3>
                                ООО СМФ «Арсенал-Сервис»
                            </h3>
                            <p>
                                Организация с действующими разрешительными
                                документами в сфере пожарной безопасности.
                            </p>
                            <a
                                href="https://digital.mchs.gov.ru/fgpn/license?search=5053033810"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link"
                            >
                                Проверить в реестре →
                            </a>
                        </div>
                    </SpotlightCard>
                </div>
            </section>

            <section className="documents-section">
                <Heading mode="dark" as="h2">
                    Лицензии, членство и официальные реестры
                </Heading>
                <p className="documents-section__intro">
                    Сведения о компании и руководителе, доступные в официальных государственных реестрах.
                </p>
                <div className="documents-grid">
                    <SpotlightCard className="documents-card">
                        <div className="documents-card__content">
                            <span className="documents-card__type">
                                Реестр МЧС России
                            </span>
                            <h3>
                                Иванов Константин Борисович
                            </h3>
                            <p>
                                Руководитель компании, имеющий действующую лицензию
                                МЧС России на выполнение профильных работ.
                            </p>
                            <a
                                href="https://digital.mchs.gov.ru/fgpn/license?search=505301182406"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link"
                            >
                                Проверить сведения →
                            </a>
                        </div>
                    </SpotlightCard>

                    <SpotlightCard className="documents-card">
                        <div className="documents-card__content">
                            <span className="documents-card__type">
                                СРО НОПРИЗ
                            </span>
                            <h3>
                                ООО ПМО «Квадро-Арсенал»
                            </h3>
                            <p>
                                Членство в саморегулируемой организации
                                в области инженерных изысканий и проектирования.
                            </p>
                            <a
                                href="https://reestr.nopriz.ru/member/19201438"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link"
                            >
                                Проверить в реестре →
                            </a>
                        </div>
                    </SpotlightCard>
                </div>
            </section>

            <section className="documents-section">
                <Heading mode="dark" as="h2">
                    Что получает заказчик
                </Heading>
                <div className="documents-benefits">
                    <SpotlightCard className="documents-benefit">
                        <h3>
                            Официальность работ
                        </h3>
                        <p>
                            Все работы выполняются от имени организации
                            с необходимыми разрешительными документами.
                        </p>
                    </SpotlightCard>

                    <SpotlightCard className="documents-benefit">
                        <h3>
                            Полный пакет документации
                        </h3>
                        <p>
                            Передаём исполнительную документацию,
                            акты выполненных работ и необходимые подтверждения.
                        </p>
                    </SpotlightCard>

                    <SpotlightCard className="documents-benefit">
                        <h3>
                            Контроль качества
                        </h3>
                        <p>
                            Используем проектный подход, соблюдаем требования
                            нормативных документов и обеспечиваем сопровождение.
                        </p>
                    </SpotlightCard>

                    <SpotlightCard className="documents-benefit">
                        <h3>
                            Работа с объектами различного назначения
                        </h3>
                        <p>
                            Проектируем и устанавливаем инженерные системы
                            безопасности для коммерческих и частных объектов.
                        </p>
                    </SpotlightCard>
                </div>
            </section>

            <ConsultationBlock
                eyebrow="ОФИЦИАЛЬНЫЕ ДОКУМЕНТЫ"
                heading="Нужен пакет документов для объекта?"
                buttonText="Получить консультацию"
            >
                Подготовим необходимые документы,
                ответим на вопросы по лицензиям,
                проектированию и монтажу систем безопасности.
            </ConsultationBlock>
        </div>
    </main>
);

export default DocumentsPage;