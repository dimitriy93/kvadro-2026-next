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
    title: {
        services: {
            eyebrow: "Основные направления",
            title: "Услуги компании"
        },
        client: {
            eyebrow: "Репутация и опыт",
            title: "Нам доверяют",
            text: `За годы работы реализованы проекты для государственных,
                промышленных и коммерческих организаций Московской области.`
        }
    },
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
    ],
    stats: [
        {
            value: '30+',
            label: 'лет опыта',
            text: 'Работаем в сфере безопасности и инженерных систем.',
        },
        {
            value: '24/7',
            label: 'пульт наблюдения',
            text: 'Круглосуточный контроль состояния объектов.',
        },
        {
            value: '400+',
            label: 'объектов',
            text: 'Коммерческие, промышленные и частные объекты.',
        },
        {
            value: '4',
            label: 'направления',
            text: 'Комплексные решения для безопасности объекта.',
        },
    ],
    clients: [
        {
            name: 'Администрация г.о. Электросталь',
            category: 'Государственный сектор',
            image: "/images/logo-electrostal-adm.svg"
        },
        {
            name: 'Почта России',
            category: 'Госструктуры',
            image: "/images/logo-pochta.svg"
        },
        {
            name: 'ЭЗТМ',
            category: 'Промышленность',
            image: "/images/logo-eztm.svg"
        },
        {
            name: 'Завод Электросталь',
            category: 'Промышленность',
            image: "/images/logo-elstal.svg"
        },
        {
            name: 'Неорганика',
            category: 'Промышленность',
            image: "/images/logo-elemash.svg"
        },
        {
            name: 'ТРЦ Парк Плаза',
            category: 'Коммерческий сектор',
            image: "/images/logo-plaza.svg"
        },
        {
            name: 'Банк Возрождение',
            category: 'Финансовый сектор',
            image: "/images/logo-vozrozhdenie.svg"
        },
        {
            name: 'Домотехника',
            category: 'Ритейл',
            image: "/images/logo-domotehnika.svg"
        },
        {
            name: 'Алекс-Фитнес',
            category: 'Сфера услуг',
            image: "/images/logo-alex.svg"
        },
    ],
    clients_bottom: "И другие предприятия и организации региона."
}