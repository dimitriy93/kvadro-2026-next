"use client";
import "./cta.styles.scss";
import { YMaps, Map, Placemark } from "@pbe/react-yandex-maps";
import { Button } from "@/components/button";
import { landing } from "@/config/content/landing";

const coords = [55.786994, 38.435561];

export const CTA = () => (
    <section className="cta">

        <div className="cta__map">
            <YMaps>
                <Map
                    defaultState={{
                        center: coords,
                        zoom: 18,
                    }}
                    width="100%"
                    height="100%"
                    options={{
                        suppressMapOpenBlock: true,
                    }}
                >
                    <Placemark
                        geometry={coords}
                        options={{
                            iconLayout: "default#image",
                            iconImageHref: "/images/logo_baloon.svg",
                            iconImageSize: [80, 60],
                            iconImageOffset: [-40, -50],
                        }}
                    />
                </Map>
            </YMaps>
        </div>

        {/* Затемнение */}
        <div className="cta__overlay" />

        {/* Контент поверх */}
        <div className="cta__content">
            <h2 className="cta__title">
                Нужна система безопасности для объекта?
            </h2>

            <p className="cta__text">
                Подберем решение под задачи предприятия, офиса или частного объекта.
                Работаем по Электростали и Московской области.
            </p>

            <div className="cta__actions">
                <Button mode="primary">{landing.btn_primary}</Button>
                <Button mode="secondary">{landing.btn_secondary}</Button>
            </div>
        </div>

    </section>
);