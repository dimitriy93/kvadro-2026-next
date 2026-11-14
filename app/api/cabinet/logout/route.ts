import {NextRequest, NextResponse} from 'next/server';
import {
    ACCOUNT_SESSION_COOKIE_NAME,
    isSessionCookieSecure,
    performLogout,
    sessionCookieOptions,
} from '@/lib/account';

export const runtime = 'nodejs';

/**
 * Завершение сессии: cookie удаляется с теми же параметрами, с которыми
 * выдана. Для источника georitm серверная сессия дополнительно отзывается
 * в хранилище (logout работает даже при копировании cookie) и выполняется
 * users/logout/ на стороне GEORITM.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
    await performLogout();

    const response = NextResponse.json({success: true});

    response.cookies.set(ACCOUNT_SESSION_COOKIE_NAME, '', {
        ...sessionCookieOptions(isSessionCookieSecure(request)),
        maxAge: 0,
    });

    return response;
};
