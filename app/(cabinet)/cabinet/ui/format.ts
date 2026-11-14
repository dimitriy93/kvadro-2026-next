/**
 * Единое форматирование дат и времени для интерфейса кабинета.
 * Часовой пояс компании (МСК), фиксированный формат dd.MM.yyyy, HH:mm.
 * Отсутствующее время обновления (источник его не сообщил) — прочерк
 * вместо даты.
 */
export const formatDateTime = (iso: string | undefined): string => {
    if (!iso) {
        return '—';
    }

    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow',
    }).format(new Date(iso));
};
