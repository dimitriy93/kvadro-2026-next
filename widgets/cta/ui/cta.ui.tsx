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
                aria-label={landing.cta.link_map_label}
            >
                <Image
                    src={mapImage}
                    alt={landing.cta.image_map_label}
                    fill
                    priority
                    className="cta__map-image"
                />
                <div className="cta__map-overlay">
                    <div className="cta__map-card">
                        <span className="cta__map-icon">📍</span>
                        <div className="cta__map-info">
                            <span className="cta__map-label">{landing.cta.map_label}</span>
                            <span className="cta__map-text">{landing.cta.map_text}</span>
                    </div>
                    <span className="cta__map-arrow">→</span>
                    </div>
                </div>
            </Link>

            <div className="cta__panel">
                <div className="container">
                    <div className="cta__content">
                        <span className="cta__eyebrow">{landing.cta.eyebrow}</span>
                        <h2 className="cta__title">
                            {landing.cta.title}
                        </h2>
                        <p className="cta__text">{landing.cta.text}</p>

                        <div className="cta__actions">
                            <Button mode="primary">{landing.btn_primary}</Button>
                            <Button mode="secondary">{landing.cta.btn_secondary}</Button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};