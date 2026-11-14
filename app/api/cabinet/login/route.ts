import {NextRequest, NextResponse} from 'next/server';
import {
    getSessionSecret,
    isDemoLoginEnabled,
    isSecureRequest,
    sessionCookieOptions,
    ACCOUNT_SESSION_COOKIE_NAME,
    verifyCredentials,
} from '@/lib/account';
import {GeoritmApiError} from '@/lib/georitm/api-client';

export const runtime = 'nodejs';

interface LoginRequestBody {
    login?: unknown;
    password?: unknown;
}

/**
 * Простой лимитер попыток входа в памяти процесса. Достаточен как первичная
 * мера против перебора на одиночном экземпляре Amvera; при нескольких
 * экземплярах или строгих требованиях заменяется распределённым решением.
 */
const LOGIN_ATTEMPTS_LIMIT = 5;
const LOGIN_ATTEMPTS_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, {count: number; resetAt: number}>();

const clientKey = (request: NextRequest): string =>
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';

const isRateLimited = (key: string): boolean => {
    const now = Date.now();
    const entry = attempts.get(key);
    if (!entry || entry.resetAt <= now) {
        return false;
    }
    return entry.count >= LOGIN_ATTEMPTS_LIMIT;
};

const registerFailedAttempt = (key: string): void => {
    const now = Date.now();
    const entry = attempts.get(key);
    if (!entry || entry.resetAt <= now) {
        attempts.set(key, {count: 1, resetAt: now + LOGIN_ATTEMPTS_WINDOW_MS});
        return;
    }
    entry.count += 1;
};

const clearAttempts = (key: string): void => {
    attempts.delete(key);
};

/**
 * Вход в кабинет. Учётные данные проверяет текущий источник данных
 * (ACCOUNT_DATA_SOURCE): 'demo' — тестовые учётные записи только вне
 * production; 'georitm' — users/login/ GEORITM с созданием серверной
 * сессии (credentials только на сервере, в cookie — непрозрачный ID).
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
    try {
        const source = process.env.ACCOUNT_DATA_SOURCE?.trim().toLowerCase() === 'georitm' ? 'georitm' : 'demo';

        if (source === 'demo' && (!isDemoLoginEnabled() || !getSessionSecret())) {
            return NextResponse.json(
                {success: false, error: 'Демонстрационный вход отключён в этой среде'},
                {status: 503},
            );
        }

        const key = clientKey(request);
        if (isRateLimited(key)) {
            return NextResponse.json(
                {success: false, error: 'Слишком много попыток входа. Повторите позже'},
                {status: 429},
            );
        }

        let body: LoginRequestBody | null = null;
        try {
            body = (await request.json()) as LoginRequestBody | null;
        } catch {
            body = null;
        }

        const login = typeof body?.login === 'string' ? body.login.trim() : '';
        const password = typeof body?.password === 'string' ? body.password : '';

        if (!login || !password) {
            return NextResponse.json(
                {success: false, error: 'Укажите логин и пароль'},
                {status: 400},
            );
        }

        // Сообщение не раскрывает, существует ли логин.
        let verified;
        try {
            verified = await verifyCredentials(login, password);
        } catch (error) {
            if (error instanceof GeoritmApiError) {
                // Недоступность GEORITM не маскируется под «неверный пароль»;
                // серверное сообщение (msg) не выводится — оно может быть непредсказуемым.
                console.error(`API /api/cabinet/login: GEORITM ${error.kind}${error.status ? ` HTTP ${error.status}` : ''}`);
                return NextResponse.json(
                    {success: false, error: 'Сервер мониторинга недоступен. Попробуйте позже'},
                    {status: 502},
                );
            }
            throw error;
        }

        if (!verified) {
            registerFailedAttempt(key);
            return NextResponse.json(
                {success: false, error: 'Неверный логин или пароль'},
                {status: 401},
            );
        }

        clearAttempts(key);

        const response = NextResponse.json({success: true, user: verified.user});
        response.cookies.set(
            ACCOUNT_SESSION_COOKIE_NAME,
            verified.sessionValue,
            sessionCookieOptions(isSecureRequest(request)),
        );

        return response;
    } catch (error) {
        console.error('API /api/cabinet/login ERROR:', error);

        return NextResponse.json({success: false, error: 'Ошибка сервера'}, {status: 500});
    }
};
