import {createHmac, timingSafeEqual} from 'node:crypto';
import type {EventJournalCursor, EventJournalDirection} from './event-journal';

/**
 * Подписанный якорь постраничной загрузки журнала (E10) — значение
 * URL-параметра ?c=. Формат повторяет токен сессии (session.ts):
 * `v1.<base64url(payload)>.<base64url(HMAC-SHA256)>`.
 *
 * Якорь не несёт данных и не даёт доступа: он только позиционирует окно
 * выборки внутри журнала ОДНОГО объекта и ОДНОГО фильтра. Сервер в любом
 * случае проверяет владение объектом перед обращением к источнику, но
 * подпись гарантирует, что значение пришло из ответа этого же приложения
 * (не сконструировано браузером), и связывает якорь с объектом, фильтром
 * и направлением выборки. Подделка или якорь другого объекта/фильтра
 * отклоняются — страница молча возвращается к первой странице.
 *
 * Секрет — общий с session.ts (ACCOUNT_SESSION_SECRET / dev-fallback):
 * без секрета (production без настройки) якоря не выпускаются и не
 * принимаются, журнал работает только с первой страницы.
 */

const TOKEN_VERSION = 'v1';

/** id записи журнала: 'alert:123', 'action:45', демо-'demo-event-…'. */
const EVENT_ID_PATTERN = /^[A-Za-z0-9:_-]{1,80}$/;
/** Максимум id в skip-списке (группа записей с одинаковой меткой). */
const MAX_SKIP_IDS = 64;
/** Жёсткая верхняя граница метки якоря (2100-01-01 UTC). */
const MAX_CURSOR_MS = 4_102_444_800_000;

export interface EventCursorPayload extends EventJournalCursor {
    /** Объект, в журнале которого выдан якорь. */
    objectId: string;
    /** Фильтр типа события ('' — без фильтра); якорь действует только в своём фильтре. */
    eventType: string;
    /** Направление выборки от якоря. */
    direction: EventJournalDirection;
}

const sign = (payloadB64: string, secret: string): string =>
    createHmac('sha256', secret).update(`${TOKEN_VERSION}.${payloadB64}`).digest('base64url');

/** Кодирует якорь в значение для ?c=. Без секрета бросает исключение. */
export const encodeEventCursor = (payload: EventCursorPayload, secret: string): string => {
    if (!Number.isInteger(payload.t) || payload.t < 0 || payload.t > MAX_CURSOR_MS) {
        throw new Error('Кодирование якоря: недопустимая метка времени');
    }
    const skip = payload.skip.filter((id) => EVENT_ID_PATTERN.test(id));
    if (skip.length > MAX_SKIP_IDS) {
        throw new Error('Кодирование якоря: слишком длинный skip-список');
    }
    const clean: EventCursorPayload = {
        t: payload.t,
        skip,
        objectId: payload.objectId,
        eventType: payload.eventType,
        direction: payload.direction === 'newer' ? 'newer' : 'older',
    };
    const payloadB64 = Buffer.from(JSON.stringify(clean), 'utf8').toString('base64url');
    return `${TOKEN_VERSION}.${payloadB64}.${sign(payloadB64, secret)}`;
};

/**
 * Декодирует и проверяет якорь; любое отклонение (подпись, структура,
 * границы, чужой объект/фильтр) → null — вызывающая сторона молча
 * возвращается к первой странице, не раскрывая причину.
 */
export const decodeEventCursor = (
    token: string,
    secret: string | null,
    expected: {objectId: string; eventType: string},
): EventCursorPayload | null => {
    if (!secret) {
        return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
        return null;
    }

    const [, payloadB64, signatureB64] = parts;
    if (payloadB64.length === 0 || payloadB64.length > 4096 || signatureB64.length === 0) {
        return null;
    }

    const given = Buffer.from(signatureB64, 'base64url');
    const expectedSignature = Buffer.from(sign(payloadB64, secret), 'base64url');
    if (given.length !== expectedSignature.length || !timingSafeEqual(given, expectedSignature)) {
        return null;
    }

    let payload: unknown;
    try {
        payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
    if (typeof payload !== 'object' || payload === null) {
        return null;
    }

    const record = payload as Record<string, unknown>;
    const t = record.t;
    const skip = record.skip;
    const isValidSkip = Array.isArray(skip)
        && skip.length <= MAX_SKIP_IDS
        && skip.every((id) => typeof id === 'string' && EVENT_ID_PATTERN.test(id));

    if (
        typeof t !== 'number'
        || !Number.isInteger(t)
        || t < 0
        || t > MAX_CURSOR_MS
        || !isValidSkip
        || record.objectId !== expected.objectId
        || record.eventType !== expected.eventType
        || (record.direction !== 'older' && record.direction !== 'newer')
    ) {
        return null;
    }

    return {
        t,
        skip: skip as string[],
        objectId: expected.objectId,
        eventType: expected.eventType,
        direction: record.direction,
    };
};
