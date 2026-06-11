"use client";
import {useMemo, useState} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {calculatePrice} from "../lib/calculate-price";
import {QuizAnswers} from "@/widgets/quiz/quis.types";
import "./quiz.styles.scss";

const QUIZ_STEPS = ["object", "area", "systems", "contact", "result"] as const;

export const Quiz = () => {
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState<1 | -1>(1);
    const [answers, setAnswers] = useState<QuizAnswers>({
        systems: [],
    });
    const [systemsError, setSystemsError] = useState("");

    const [errors, setErrors] = useState<{
        name?: string;
        phone?: string;
    }>({});

    const next = () => {
        setDirection(1);
        setStep((prev) => Math.min(prev + 1, 4));
    };

    const prev = () => {
        setDirection(-1);
        setStep((prev) => Math.max(prev - 1, 0));
    };

    const toggleSystem = (value: string) => {
        setSystemsError("");

        setAnswers((prev) => {
            const current = prev.systems || [];
            const exists = current.includes(value);

            return {
                ...prev,
                systems: exists
                    ? current.filter((s) => s !== value)
                    : [...current, value],
            };
        });
    };

    const price = useMemo(() => {
        return calculatePrice(answers.area, answers.systems);
    }, [answers.area, answers.systems]);

    const handleLeadWithContact = () => {
        const newErrors: typeof errors = {};

        if (!answers.phone?.trim()) {
            newErrors.phone = "Укажите телефон или выберите просмотр без контактов";
        }

        if (!answers.name?.trim()) {
            newErrors.name = "Укажите имя или выберите просмотр без контактов";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const lead = {
            id: crypto.randomUUID(),
            answers,
            contact: {
                name: answers.name,
                phone: answers.phone,
            },
            meta: {
                completedAt: Date.now(),
                hasContact: true,
                source: "quiz_popup",
            },
        };

        console.log("LEAD:", lead);
        next();
    };

    const handleLeadAnonymous = () => {
        const lead = {
            id: crypto.randomUUID(),
            answers,
            meta: {
                completedAt: Date.now(),
                hasContact: false,
                source: "quiz_popup",
            },
        };

        console.log("ANONYMOUS LEAD:", lead);
        next();
    };

    const handleSystemsNext = () => {
        if (!answers.systems?.length) {
            setSystemsError(
                "Выберите один или несколько вариантов"
            );
            return;
        }

        next();
    };

    return (
        <div className="quiz">

            <div className="quiz__progress">
                {QUIZ_STEPS.slice(0, 4).map((_, i) => (
                    <div
                        key={i}
                        className={`quiz__progress-item ${(i <= step) ? "is-active" : ""}`}
                    />
                ))}
            </div>

            <div className="quiz__body">
                <AnimatePresence
                    mode="wait"
                    custom={direction}
                >
                    <motion.div
                        key={step}
                        className="quiz-step"
                        custom={direction}
                        initial={{
                            x: direction > 0 ? 80 : -80,
                            opacity: 0,
                        }}
                        animate={{
                            x: 0,
                            opacity: 1,
                        }}
                        exit={{
                            x: direction > 0 ? -80 : 80,
                            opacity: 0,
                        }}
                        transition={{
                            duration: 0.3,
                            ease: "easeInOut",
                        }}
                    >
                        {step === 0 && (
                            <div className="quiz-step">
                                <h2 className="quiz__title">Какой у вас объект?</h2>

                                <div className="quiz__grid">
                                    {["Офис", "Магазин", "Производство", "Склад", "Дом"].map(
                                        (item) => (
                                            <button
                                                key={item}
                                                className="quiz__card"
                                                onClick={() => {
                                                    setAnswers({...answers, objectType: item});
                                                    next();
                                                }}
                                            >
                                                {item}
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="quiz-step">
                                <h2 className="quiz__title">Площадь объекта</h2>

                                <div className="quiz__grid">
                                    {["до 100", "100–500", "500–1000", "1000+"].map(
                                        (item) => (
                                            <button
                                                key={item}
                                                className="quiz__card"
                                                onClick={() => {
                                                    setAnswers({...answers, area: item});
                                                    next();
                                                }}
                                            >
                                                {item} м²
                                            </button>
                                        )
                                    )}
                                </div>
                                <div className="quiz__actions">
                                    <button onClick={prev} className="quiz__back">Назад</button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="quiz-step">
                                <h2 className="quiz__title">Какие системы нужны?</h2>
                                <p className="quiz__subtitle">
                                    Выберите один или несколько вариантов
                                </p>

                                <div className="quiz__grid">
                                    {[
                                        "Пожарная",
                                        "Охранная",
                                        "Видеонаблюдение",
                                        "СКУД",
                                        "Слаботочка",
                                    ].map((item) => (
                                        <button
                                            key={item}
                                            className={`quiz__card ${
                                                answers.systems?.includes(item) ? "is-active" : ""}`}
                                            onClick={() => toggleSystem(item)}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>

                                {systemsError && (
                                    <div className="quiz__error">
                                        {systemsError}
                                    </div>
                                )}

                                <div className="quiz__actions">
                                    <button onClick={prev} className="quiz__back">Назад</button>
                                    <button
                                        className="quiz__next"
                                        onClick={handleSystemsNext}
                                        disabled={!answers.systems?.length}
                                    >Далее →</button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="quiz-step">
                                <h2 className="quiz__title">Получите предварительный расчёт</h2>

                                <p className="quiz__subtitle">
                                    Предварительный расчёт формируется автоматически.<br/>
                                    Оставьте контакты — при необходимости уточним детали и подготовим точную смету.
                                </p>

                                <div className="quiz__form">
                                    <label htmlFor="quiz_name">
                                        <input
                                            placeholder="Имя"
                                            id="quiz_name"
                                            name="quiz_name"
                                            value={answers.name || ""}
                                            onChange={(e) =>
                                                setAnswers({...answers, name: e.target.value})
                                            }
                                        />
                                        {errors.name && (
                                            <div className="quiz__error">{errors.name}</div>
                                        )}
                                    </label>

                                    <label htmlFor="quiz_phone">
                                        <input
                                            placeholder="Телефон"
                                            id="quiz_phone"
                                            name="quiz_phone"
                                            value={answers.phone || ""}
                                            onChange={(e) =>
                                                setAnswers({...answers, phone: e.target.value})
                                            }
                                        />
                                        {errors.phone && (
                                            <div className="quiz__error">{errors.phone}</div>
                                        )}
                                    </label>

                                    <div className="quiz__actions">
                                        <button className="quiz__primary" onClick={handleLeadWithContact}>
                                            Получить предварительный расчёт
                                        </button>

                                        <button className="quiz__secondary" onClick={handleLeadAnonymous}>
                                            Смотреть расчёт без контактов
                                        </button>
                                    </div>
                                </div>

                                <p className="quiz__hint">
                                    Без спама и навязчивых звонков — только расчёт и при необходимости уточнение деталей
                                </p>

                                <div className="quiz__actions">
                                    <button onClick={prev} className="quiz__back">Назад</button>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="quiz__result quiz-step">
                            <h2 className="quiz__title">Предварительная стоимость</h2>

                                <div className="quiz__price">
                                    от {price.min.toLocaleString()} ₽<br/>
                                    до {price.max.toLocaleString()} ₽
                                </div>

                                <p>
                                    Точная стоимость определяется после обследования объекта.
                                </p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>


        </div>
    );
};