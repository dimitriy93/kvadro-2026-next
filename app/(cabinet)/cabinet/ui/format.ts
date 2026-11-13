/**
 * Единое форматирование демо-дат и времени для интерфейса кабинета.
 * Часовой пояс компании (МСК), фиксированный формат dd.MM.yyyy, HH:mm.
 */
export const formatDateTime = (iso: string): string =>
    new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow',
    }).format(new Date(iso));
