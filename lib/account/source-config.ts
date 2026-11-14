/**
 * Конфигурация источника данных кабинета — выделена в отдельный модуль
 * без зависимостей, чтобы session.ts мог определять вид сессии без
 * циклического импорта диспетчера (source.ts → georitm-source.ts → session.ts).
 */

export type AccountDataSourceKind = 'demo' | 'georitm';

/** Текущий источник данных. Отсутствие настройки — безопасное значение 'demo'. */
export const getAccountDataSource = (): AccountDataSourceKind => {
    const value = process.env.ACCOUNT_DATA_SOURCE?.trim().toLowerCase();
    return value === 'georitm' ? 'georitm' : 'demo';
};
