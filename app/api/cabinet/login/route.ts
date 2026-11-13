import {NextRequest, NextResponse} from 'next/server';
import {
    createSessionToken,
    getSessionSecret,
    isDemoLoginEnabled,
    isSecureRequest,
    sessionCookieOptions,
    ACCOUNT_SESSION_COOKIE_NAME,
    verifyDemoCredentials,
} from '@/lib/account';

export const runtime = 'nodejs';

interface LoginRequestBody {
    login?: unknown;
    password?: unknown;
}

/**
 * Демонстрационный вход. В production отключён на уровне серверной проверки
 * и не использует небезопасный секрет по умолчанию (см. lib/account/session.ts).
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
    try {
        if (!isDemoLoginEnabled() || !getSessionSecret()) {
            return NextResponse.json(
                {success: false, error: 'Демонстрационный вход отключён в этой среде'},
                {status: 503},
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
        const user = verifyDemoCredentials(login, password);
        if (!user) {
            return NextResponse.json(
                {success: false, error: 'Неверный логин или пароль'},
                {status: 401},
            );
        }

        const response = NextResponse.json({success: true, user});
        response.cookies.set(
            ACCOUNT_SESSION_COOKIE_NAME,
            createSessionToken(user.id),
            sessionCookieOptions(isSecureRequest(request)),
        );

        return response;
    } catch (error) {
        console.error('API /api/cabinet/login ERROR:', error);

        return NextResponse.json({success: false, error: 'Ошибка сервера'}, {status: 500});
    }
};
