/**
 * Серверный кэш справочника шаблонов событий (alert-template/list/).
 *
 * Справочник может содержать клиентские шаблоны (clientId != null), поэтому
 * его состав зависит от учётной записи GEORITM: кэш изолирован по
 * идентификатору GEORITM-пользователя. Содержимое справочника наружу
 * не отдаётся — используется только для классификации событий на сервере.
 *
 * Кэш в памяти процесса с ограниченным TTL. Turbopack может держать
 * несколько экземпляров модуля (RSC-слой и route handlers) — тогда
 * справочник запрашивается дважды, что допустимо: данные справочные,
 * меняются редко, TTL ограничивает устаревание. Файловое хранилище,
 * в отличие от session-store, не требуется: ошибки кэша не влияют на
 * корректность доступа, а только на число вызовов API.
 */

import {georitmAlertTemplates, type GeoritmAlertTemplate} from './api-client';

/** Время жизни записи кэша. Справочник меняется редко; 10 минут достаточно. */
const TTL_MS = 10 * 60 * 1000;
/** Предохранитель от роста: максимум пользователей с закэшированным справочником. */
const MAX_USERS = 20;

interface CacheEntry {
    /** Карта «числовой код шаблона → шаблон» (коды журнала «NNN.N» → NNNN). */
    byCode: Map<number, GeoritmAlertTemplate>;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Вытесняет самую старую запись, когда кэш достиг предела. */
const evictOldest = (): void => {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, entry] of cache) {
        if (entry.expiresAt < oldestAt) {
            oldestAt = entry.expiresAt;
            oldestKey = key;
        }
    }
    if (oldestKey) {
        cache.delete(oldestKey);
    }
};

/**
 * Карта «код → шаблон» для указанного GEORITM-пользователя. При промахе
 * справочник загружается через API; ошибка загрузки пробрасывается —
 * отсутствие справочника не подменяется пустым.
 */
export const getAlertTemplatesByCode = async (
    basic: string,
    georitmUserId: string,
): Promise<Map<number, GeoritmAlertTemplate>> => {
    const now = Date.now();
    // Устаревшие записи удаляются при каждом обращении — кэш не разрастается.
    for (const [key, entry] of cache) {
        if (entry.expiresAt <= now) {
            cache.delete(key);
        }
    }

    const existing = cache.get(georitmUserId);
    if (existing) {
        return existing.byCode;
    }

    const byCode = new Map<number, GeoritmAlertTemplate>();
    for (const template of await georitmAlertTemplates(basic)) {
        if (typeof template?.code === 'number') {
            byCode.set(template.code, template);
        }
    }

    if (cache.size >= MAX_USERS) {
        evictOldest();
    }
    cache.set(georitmUserId, {byCode, expiresAt: now + TTL_MS});

    return byCode;
};
