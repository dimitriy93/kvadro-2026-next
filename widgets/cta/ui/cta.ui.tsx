"use client";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/button";
import { landing } from "@/config/content/landing";
import mapImage from "@/app/_assets/images/map.webp";
import "./cta.styles.scss";

export const CTA = () => {
    return (
        <section className="cta">

            <Link
                href="https://yandex.ru/maps/org/kvadro_arsenal/1290904928/"
                target="_blank"
                rel="noopener noreferrer"
                className="cta__map"
                aria-label="Открыть адрес компании на Яндекс Картах"
            >
                <Image
                    src={mapImage}
                    alt="Расположение офиса Квадро-Арсенал"
                    fill
                    sizes="100vw"
                    className="cta__map-image"
                />
            </Link>

            <div className="cta__overlay" />

            <div className="container">
                <div className="cta__layout">
                    <div className="cta__content">
                        <span className="cta__eyebrow">
                            Контакты
                        </span>
                        <h2 className="cta__title">
                            Нужна система безопасности для объекта?
                        </h2>
                        <p className="cta__text">
                            Подберем решение под задачи предприятия,
                            офиса или частного объекта.
                            Работаем по Электростали и Московской области.
                        </p>
                        <div className="cta__actions">
                            <Button mode="primary">
                                {landing.btn_primary}
                            </Button>

                            <Button mode="secondary">
                                Контакты
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};