export const telegramMessageTemplate = {
    title: '🔔 <b>Новая заявка с сайта</b>',
    separator: '━━━━━━━━━━━━━━━━━━━━',
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