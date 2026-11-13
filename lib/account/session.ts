import {createHmac, timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
import {findPublicDemoUserById} from './demo-data';
import type {PublicAccountUser} from './contracts';

/**
 * Тестовая cookie-сессия личного кабинета (только для прототипа).
 *
 * Механизм: stateless-токен `v1.<base64url(payload)>.<base64url(HMAC-SHA256)>`.
 * Сервер доверяет только подписи и сроку действия; `userId` из payload
 * считается легитимным исключительно после проверки подписи. Клиентский
 * `userId` полномочий не даёт.
 *
 * Это не production-авторизация: нет отзыва сессий, нет rate limit,
 * в production демо-вход отключён (см. isDemoLoginEnabled).
 */

const COOKIE_NAME = 'ka_account_session';
const TOKEN_VERSION = 'v1';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

/**
 * Секрет подписи. В production — только из переменной окружения
 * ACCOUNT_SESSION_SECRET; небезопасного значения по умолчанию нет.
 * Фиксированный секрет ниже применяется исключительно в development.
 */
const DEV_FALLBACK_SECRET = 'kvadro-account-dev-secret-development-only';

const isProduction = () => process.env.NODE_ENV === 'production';

export const getSessionSecret = (): string | null => {
    const secret = process.env.ACCOUNT_SESSION_SECRET;
    if (secret && secret.length > 0) {
        return secret;
    }

    return isProduction() ? null : DEV_FALLBACK_SECRET;
};

/**
 * Демо-вход разрешён только вне production. Автоматического включения
 * демо-режима в production нет ни при каком окружении.
 */
export const isDemoLoginEnabled = () => !isProduction();

interface SessionPayload {
    /** id пользователя (подтверждается поиском в демо-данных). */
    sub: string;
    /** Выдано, epoch seconds. */
    iat: number;
    /** Истекает, epoch seconds. */
    exp: number;
}

const sign = (payloadB64: string, secret: string): string =>
    createHmac('sha256', secret).update(`${TOKEN_VERSION}.${payloadB64}`).digest('base64url');

export const createSessionToken = (userId: string): string => {
    const secret = getSessionSecret();
    if (!secret) {
        throw new Error('Секрет сессии недоступен: выпуск токена невозможен');
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
        sub: userId,
        iat: issuedAt,
        exp: issuedAt + SESSION_TTL_SECONDS,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

    return `${TOKEN_VERSION}.${payloadB64}.${sign(payloadB64, secret)}`;
};

/** Проверяет подпись, структуру и срок действия; иначе null. */
export const verifySessionToken = (token: string): SessionPayload | null => {
    const secret = getSessionSecret();
    if (!secret) {
        return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
        return null;
    }

    const [, payloadB64, signatureB64] = parts;
    if (payloadB64.length === 0 || signatureB64.length === 0) {
        return null;
    }

    const givenSignature = Buffer.from(signatureB64, 'base64url');
    const expectedSignature = Buffer.from(sign(payloadB64, secret), 'base64url');
    if (givenSignature.length !== expectedSignature.length || !timingSafeEqual(givenSignature, expectedSignature)) {
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

    const {sub, iat, exp} = payload as Record<string, unknown>;
    const isValidId = typeof sub === 'string' && /^[a-z0-9-]+$/i.test(sub);
    const isValidNumber = (value: unknown): value is number =>
        typeof value === 'number' && Number.isFinite(value) && value > 0;

    if (!isValidId || !isValidNumber(iat) || !isValidNumber(exp)) {
        return null;
    }

    if (exp <= Math.floor(Date.now() / 1000)) {
        return null;
    }

    return {sub, iat, exp};
};

/**
 * Текущий пользователь по cookie-сессии. Единая серверная проверка для
 * защищённых страниц и API. Аноним/недействительная сессия → null.
 */
export const getSessionUser = async (): Promise<PublicAccountUser | null> => {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return null;
    }

    const payload = verifySessionToken(token);
    if (!payload) {
        return null;
    }

    // Пользователь должен существовать в источнике данных (иначе сессия
    // отозвана вместе с учётной записью).
    return findPublicDemoUserById(payload.sub);
};

export const ACCOUNT_SESSION_COOKIE_NAME = COOKIE_NAME;
export const ACCOUNT_SESSION_TTL_SECONDS = SESSION_TTL_SECONDS;

/** Параметры cookie-сессии; одинаковые для выпуска и удаления. */
export const sessionCookieOptions = (secure: boolean) => ({
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure,
    maxAge: SESSION_TTL_SECONDS,
});

/**
 * Признак HTTPS-запроса: за прокси Amvera ориентируемся на
 * `x-forwarded-proto`, при прямом обращении — на протокол URL.
 */
export const isSecureRequest = (request: Request): boolean => {
    const forwardedProto = request.headers.get('x-forwarded-proto');
    if (forwardedProto) {
        return forwardedProto.split(',')[0].trim() === 'https';
    }

    return new URL(request.url).protocol === 'https:';
};
