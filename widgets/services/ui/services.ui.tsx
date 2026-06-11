"use client";
import Image from "next/image";
import Link from "next/link";
import {landing} from "@/config/content/landing";
import {SectionHeader} from "@/components/section-header";
import "./services.styles.scss";

const {services, title} = landing;

export const Services = () => {
    return (
        <section className="services">
            <div className="services__container">
                <SectionHeader
                    title={title.services.title}
                    eyebrow={title.services.eyebrow}
                />
            </div>

            <div className="services__list">
                {services.map((item, index) => (
                    <article
                        key={item.id}
                        className={`service ${index % 2 !== 0 ? 'service--reverse' : ''}`}
                    >
                        <div className="service__media">
                            <Image
                                src={item.image}
                                alt={item.title}
                                fill
                                className="service__image"
                            />
                            <div className="service__overlay" />
                        </div>

                        <div className="service__content">
                            <span className="service__number">{item.id}</span>

                            <h3 className="service__name">{item.title}</h3>

                            <p className="service__text">{item.text}</p>

                            <Link href={item.href} className="service__link link">
                                Подробнее
                                <span className="service__arrow">→</span>
                            </Link>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
};