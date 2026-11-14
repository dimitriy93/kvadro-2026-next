import {createHash, randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import type {PublicAccountUser} from './contracts';

/**
 * Серверное хранилище сессий личного кабинета.
 *
 * Зачем: HMAC-cookie (`session.ts`) подписана, но не зашифрована — её payload
 * читается любым, у кого есть cookie. GEORITM Basic-credentials
 * (base64(login:password)) хранить в ней нельзя. Здесь браузер получает
 * только непрозрачный идентификатор сессии, а credentials лежат на сервере.
 *
 * Хранилище — JSON-файл на постоянном томе Amvera `/data`
 * (amvera.yml → persistenceMount). Переживает перезапуск контейнера;
 * приложение Amvera выполняется в одном экземпляре, поэтому файлового
 * хранилища достаточно. При переходе на несколько экземпляров или при
 * появлении управляемой БД (PostgreSQL/Redis на Amvera) хранилище
 * заменяется реализацией с тем же интерфейсом — потребители не меняются.
 *
 * Безопасность:
 *  - идентификатор сессии — 256 бит энтропии (randomBytes), в файле
 *    хранится только его SHA-256 (утечка файла не даёт живых сессий);
 *  - Basic-credentials никогда не логируются и не покидают этот модуль,
 *    кроме как в заголовке запроса к GEORITM;
 *  - истекшие записи удаляются при загрузке и при создании сессии.
 */

/** Формат записи в хранилище. Доступен только серверному коду. */
interface StoredSessionRecord {
    /** Выдано, epoch seconds. */
    createdAt: number;
    /** Истекает, epoch seconds. */
    expiresAt: number;
    /** Пользователь кабинета (без секретов). */
    user: PublicAccountUser;
    /** GEORITM Basic (base64(login:password)). Не логировать. */
    georitmBasic: string;
}

const FILE_NAME = 'sessions.json';

const storeDir = (): string => {
    const configured = process.env.ACCOUNT_SESSION_STORE_DIR?.trim();
    if (configured) {
        return configured;
    }
    return process.env.NODE_ENV === 'production'
        ? '/data/account-sessions'
        : path.join(process.cwd(), '.data', 'account-sessions');
};

const filePath = () => path.join(storeDir(), FILE_NAME);

/** Ключ записи — SHA-256 идентификатора; сам идентификатор в файл не попадает. */
const recordKey = (sessionId: string): string =>
    createHash('sha256').update(sessionId, 'utf8').digest('hex');

// Без кэша в памяти: Turbopack может держать несколько экземпляров модуля
// (RSC-слой и слой route handlers), и тогда кэш одного слоя отставал от
// изменений другого (наблюдается в dev: отзыв сессии не виден страницам).
// Файл крошечный — чтение на каждое обращение гарантирует консистентность.
const load = (): Map<string, StoredSessionRecord> => {
    const store = new Map<string, StoredSessionRecord>();
    const file = filePath();
    if (!existsSync(file)) {
        return store;
    }

    try {
        const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const now = Math.floor(Date.now() / 1000);
            for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
                const record = value as Partial<StoredSessionRecord> | null;
                if (
                    record &&
                    typeof record.expiresAt === 'number' &&
                    record.expiresAt > now &&
                    record.user &&
                    typeof record.georitmBasic === 'string'
                ) {
                    store.set(key, value as StoredSessionRecord);
                }
            }
        }
    } catch {
        // Повреждённый файл трактуем как пустое хранилище: сессии придётся
        // пройти заново — это fail-closed поведение, не раскрытие данных.
    }

    return store;
};

/** Атомарная запись состояния: временный файл + rename (частичный JSON не виден читателю). */
const persist = (store: Map<string, StoredSessionRecord>): void => {
    const dir = storeDir();
    if (!existsSync(dir)) {
        mkdirSync(dir, {recursive: true});
    }
    const file = filePath();
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(store)), 'utf8');
    renameSync(tmp, file);
};

/**
 * Создаёт сессию входа через GEORITM. Возвращает непрозрачный
 * идентификатор для HttpOnly-cookie.
 */
export const createGeoritmSession = (
    user: PublicAccountUser,
    georitmBasic: string,
    ttlSeconds: number,
): string => {
    const sessionId = `g${randomBytes(32).toString('base64url')}`;
    const now = Math.floor(Date.now() / 1000);

    const store = load();
    // Заодно чистим истекшие записи.
    for (const [key, record] of store) {
        if (record.expiresAt <= now) {
            store.delete(key);
        }
    }
    store.set(recordKey(sessionId), {
        createdAt: now,
        expiresAt: now + ttlSeconds,
        user,
        georitmBasic,
    });
    persist(store);

    return sessionId;
};

/**
 * Запись сессии по непрозрачному идентификатору (или null).
 * Истекшая сессия удаляется и возвращается как null.
 */
export const getSessionRecord = (sessionId: string): StoredSessionRecord | null => {
    const key = recordKey(sessionId);
    const store = load();
    const record = store.get(key);
    if (!record) {
        return null;
    }

    if (record.expiresAt <= Math.floor(Date.now() / 1000)) {
        store.delete(key);
        persist(store);
        return null;
    }

    return record;
};

/** Отзыв сессии (logout, инвалидация при 401 от GEORITM). */
export const deleteSession = (sessionId: string): boolean => {
    const store = load();
    const removed = store.delete(recordKey(sessionId));
    if (removed) {
        persist(store);
    }
    return removed;
};
