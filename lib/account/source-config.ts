/**
 * Конфигурация источника данных кабинета — выделена в отдельный модуль
 * без зависимостей, чтобы session.ts мог определять вид сессии без
 * циклического импорта диспетчера (source.ts → georitm-source.ts → session.ts).
 */

export type AccountDataSourceKind = 'demo' | 'georitm';

/**
 * Разрешение источника данных по значению переменной и среде (E15).
 * Чистая функция — выделена для тестирования; диспетчер и маршруты
 * используют getAccountDataSource, смоук-сценарии — её напрямую.
 *
 * Правила (E15, этап 2):
 *  - production работает ТОЛЬКО на реальном источнике GEORITM: демо-данные
 *    не попадают в реальный кабинет ни при каком значении переменной —
 *    отсутствие настройки, явный 'demo', опечатка ведут к 'georitm';
 *    демо-вход в production дополнительно блокируется isDemoLoginEnabled
 *    (session.ts), а demo-токены сессий не аутентифицируют, т.к. вид сессии
 *    проверяется по тому же источнику;
 *  - вне production (development, смоук-сценарии): значение 'georitm'
 *    (после trim, без учёта регистра) включает реальный источник; любое
 *    прочее значение и отсутствие настройки — 'demo' (прежнее поведение
 *    разработки, demo-фикстуры и тесты продолжают работать).
 */
export const parseAccountDataSource = (value: string | undefined, isProduction: boolean): AccountDataSourceKind => {
    if (isProduction) {
        return 'georitm';
    }
    return value?.trim().toLowerCase() === 'georitm' ? 'georitm' : 'demo';
};

/** Текущий источник данных. В production — всегда 'georitm' (E15, этап 2). */
export const getAccountDataSource = (): AccountDataSourceKind =>
    parseAccountDataSource(process.env.ACCOUNT_DATA_SOURCE, process.env.NODE_ENV === 'production');
