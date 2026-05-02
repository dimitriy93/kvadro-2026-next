import fireImg from "@/app/_assets/images/service_fire_safety.webp";
import alarmImg from "@/app/_assets/images/service_security_alarm.webp";
import lowVoltageImg from "@/app/_assets/images/service_low_voltage.webp";
import securityImg from "@/app/_assets/images/service_security_monitoring.webp";

export const landing = {
    categories: [
        {num: '01', id: 'bg-fire', title: 'Пожарная безопасность'},
        {num: '02', id: 'bg-alarm', title: 'Охранная сигнализация'},
        {num: '03', id: 'bg-low-voltage', title: 'Слаботочные системы'},
        {num: '04', id: 'bg-security-services', title: 'Охрана объектов'},
    ],
    eyebrow: "Проектирование и монтаж",
    heading: "Системы безопасности для бизнеса и объектов",
    text: `Проектируем, монтируем и обслуживаем системы
        безопасности для предприятий и объектов.
        Работаем в Электростали и Московской области.
        Берем на себя весь цикл — от обследования до
        круглосуточного мониторинга.`,
    subnote: [
        "30+ лет опыта",
        "лицензии",
        "собственный ПЦН"
    ],
    btn_primary: "Получить расчет",
    btn_secondary: "Консультация",
    services: [
        {
            id: '01',
            title: 'Пожарная безопасность',
            text: 'Проектирование, монтаж и обслуживание систем пожарной сигнализации, оповещения и противопожарной защиты объектов.',
            image: fireImg,
            href: '/services/fire-safety',
        },
        {
            id: '02',
            title: 'Охранная сигнализация',
            text: 'Установка охранной сигнализации, видеонаблюдения и контроля доступа с учетом особенностей объекта.',
            image: alarmImg,
            href: '/services/security-alarm',
        },
        {
            id: '03',
            title: 'Слаботочные системы',
            text: 'Проектирование и монтаж слаботочных систем: сети связи, видеонаблюдение, СКУД, СОУЭ, охранная и пожарная сигнализация.',
            image: lowVoltageImg,
            href: '/services/low-voltage',
        },
        {
            id: '04',
            title: 'Охрана объектов',
            text: 'Пультовая и физическая охрана объектов, круглосуточный мониторинг и оперативное реагирование для бизнеса и предприятий.',
            image: securityImg,
            href: '/services/security-services',
        },
    ]
}