"use client";
import Image from "next/image";
import {motion} from "framer-motion";
import {useLayoutEffect, useRef, useState} from "react";
import {Heading} from "@/components/heading";
import {useScrollProgress} from "@/hooks/use-scroll-progress";
import {useScrollMotion} from "@/hooks/use-scroll-motion";
import {FireDetectorIcon} from "@/components/fire-detector-icon";
import {whiteSmokeImg, smartSecurityImg} from "@/app/_assets/images/about";
import {directions, stats, team, timeline} from "./about.data";
import "./about.style.scss";

const AboutPage = () => {
    const historyRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    const progress = useScrollProgress(historyRef, 0.4);
    const { offset, velocity } = useScrollMotion(timelineRef);
    const [imagePositions, setImagePositions] = useState<{top:number; left:number}[]>([]);

    useLayoutEffect(() => {

        const updatePositions = () => {
            const items = timelineRef.current?.querySelectorAll(".timeline-item");
            if (!items) return;
            const container = timelineRef.current!.getBoundingClientRect();

            const positions =
                Array.from(items).map((item)=>{
                    const rect = item.getBoundingClientRect();
                    return { top: rect.top - container.top, left: rect.left - container.left };
                });
            setImagePositions(positions);
        };

        updatePositions();

        window.addEventListener(
            "resize",
            updatePositions
        );

        return ()=> {
            window.removeEventListener(
                "resize",
                updatePositions
            );
        };
    }, [timeline]);

    return (
        <main className="about">
            <div className="about__glow about__glow--left"/>
            <div className="about__glow about__glow--right"/>

            <div className="container">
                <section className="about__hero">
                    <motion.div
                        className="about__hero-content"
                        initial={{opacity: 0, y: 40}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: .7}}
                    >
                        <Heading eyebrow='ООО "КВАДРО-АРСЕНАЛ"' mode="dark" as="h1">
                            Надёжность, проверенная временем
                        </Heading>
                        <p className="about-text">
                            Проектирование, монтаж и обслуживание
                            инженерных систем безопасности.
                            Комплексный подход для бизнеса и объектов.
                        </p>
                    </motion.div>
                </section>

                <motion.section
                    className="about-company"
                    whileInView={{opacity: 1, y: 0}}
                    initial={{opacity: 0, y: 40}}
                    viewport={{once: true}}
                >
                    <Heading mode="dark">
                        О компании
                    </Heading>

                    <div className="about-grid">
                        <article className="about-card about-image-wrapper">
                            <Image
                                src={smartSecurityImg}
                                fill
                                alt="Smart Security System"
                            />
                        </article>

                        <article className="about-card">
                            <h3>Кто мы</h3>
                            <p className="about-text">
                                ООО ПМО «Квадро-Арсенал»
                                специализируется на создании
                                комплексных решений безопасности.
                            </p>
                            <p className="about-text">
                                Мы объединяем проектирование,
                                монтаж оборудования и дальнейшее
                                обслуживание объектов.
                            </p>
                        </article>
                    </div>
                </motion.section>

                <section className="about-history" ref={historyRef}>
                    <Heading eyebrow="Наш путь" mode="dark">
                        История компании
                    </Heading>

                    <div className="timeline" style={{position: "relative"}} ref={timelineRef}>
                        <div className="timeline__backgrounds">

                            {timeline.map((item, index) => {
                                const pos = imagePositions[index];
                                if (!pos) return null;

                                return (
                                    <div
                                        key={item.year}
                                        className={`timeline-bg timeline-bg-${index}`}
                                        style={{
                                            top: pos.top * 1.1,
                                            transform: `translateY(${offset * item.parallax}px)`
                                        }}
                                    >
                                        <Image src={item.image} alt="" fill/>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="timeline__line">
                            <span style={{height: `${progress * 1.2 * 100}%`}}/>
                        </div>

                        <div className="timeline__fog">
                            <Image src={whiteSmokeImg} alt="" fill style={{transform: `translateY(${offset * 0.1}px)`}}/>
                        </div>

                        {timeline.map((item, index) => (
                            <motion.article
                                key={item.year}
                                className={`timeline-item timeline-item-${index}`}
                                viewport={{amount: 0.3}}
                                initial={{opacity: 0, y: 50, filter: "blur(8px)"}}
                                whileInView={{opacity: 1, y: 0, filter: "blur(0px)"}}
                                transition={{duration: 0.8, ease: "easeOut"}}
                            >
                                <div className="timeline-item__glass">
                                    <strong>{item.year}</strong>
                                    <p>{item.text}</p>
                                </div>
                            </motion.article>
                        ))}
                        <div className="fire-detector-wrap">
                            <FireDetectorIcon size={90} isActive={progress >= 0.9}/>
                        </div>
                    </div>
                </section>

                <section className="about-stats">
                    {stats.map(([value, label]) => (
                        <div className="stat-card" key={value}>
                            <strong>
                                {value}
                            </strong>
                            <span>{label}</span>
                        </div>
                    ))}
                </section>

                <section className="about-directions">
                    <Heading mode="dark">
                        Наши направления
                    </Heading>

                    <p className="about-directions__subtext">
                        Ключевые области инженерной экспертизы и реализации систем безопасности
                    </p>

                    <div className="about-directions__list">
                        {directions.map((item, index) => (
                            <motion.article
                                key={item}
                                className="direction-item"
                                initial={{opacity: 0, y: 20}}
                                whileInView={{opacity: 1, y: 0}}
                                viewport={{once: true, amount: 0.3}}
                                transition={{
                                    duration: 0.6,
                                    delay: index * 0.08
                                }}
                            >
                                <div className="direction-item__index">
                                    {String(index + 1).padStart(2, "0")}
                                </div>
                                <div className="direction-item__content">
                                    <h3 className="direction-item__title">
                                        {item}
                                    </h3>
                                    <div className="direction-item__line"/>
                                </div>
                            </motion.article>
                        ))}
                    </div>
                </section>

                <section className="about-team-air">
                    <Heading mode="dark">
                        Инженерная команда
                    </Heading>

                    <p className="about-team-air__subtext">
                        Специалисты, обеспечивающие полный цикл внедрения и сопровождения систем
                    </p>
                    <div className="team-air">
                        {team.map((item, index) => (
                            <motion.div
                                key={item.title}
                                className="team-air__item"
                                initial={{opacity: 0, y: 20}}
                                whileInView={{opacity: 1, y: 0}}
                                viewport={{once: true, amount: 0.3}}
                                transition={{duration: 0.6, delay: index * 0.08}}
                            >
                                <div className="team-air__line"/>
                                <div className="team-air__content">
                                    <h3>{item.title}</h3>
                                    <p>{item.text}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

            </div>
        </main>
    );
}

export default AboutPage;