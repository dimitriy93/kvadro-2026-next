export const telegramMessageTemplate = {
    title: '🔔 <b>Заявка с сайта</b>',
    separator: '━━━━━━━━━━',
    source: 'квадро-арсенал.рф',
    labels: {
        clientSection: '👤 Клиент',
        name: '📝 Имя',
        phone: '📞 Телефон',
        direction: '🛠 Направление',
        comment: '💬 Комментарий',
        source: '🌐 Источник',
        page: '📄 Страница',
        date: '📅 Дата',
    },
    fallbacks: {
        message: '— не указан —',
        direction: 'Другое',
        pathname: '/',
    },
} as const;

/** Оборачивает подпись в HTML-жирный тег (parse_mode: HTML). */
export const boldTelegramLabel = (label: string): string => `<b>${label}</b>`;

/** Формирует строку поля: подпись (жирным) + перенос строки + значение. */
export const formatTelegramField = (label: string, value: string): string =>
    `${boldTelegramLabel(label)} | ${value}`;

/** Шаблон сообщения для заявок из квиза (расчёт). */
export const telegramQuizMessageTemplate = {
    title: '🔔 <b>Заявка с сайта на расчет</b>',
    separator: '━━━━━━━━━━',
    source: 'квадро-арсенал.рф',
    labels: {
        name: '📝 Имя',
        phone: '📞 Телефон',
        source: '🌐 Источник',
        page: '📄 Расчет с сайта',
        date: '📅 Дата',
        questionPrefix: '❓',
        answerPrefix: '💬',
    },
    questions: {
        object: 'Какой у вас объект?',
        area: 'Площадь объекта',
        systems: 'Какие системы нужны?',
    },
    fallbacks: {
        pathname: '/',
    },
} as const;
