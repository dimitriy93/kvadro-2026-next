import {NextRequest, NextResponse} from 'next/server';
import {
    ACCOUNT_SESSION_COOKIE_NAME,
    isSecureRequest,
    sessionCookieOptions,
} from '@/lib/account';

export const runtime = 'nodejs';

/** Завершение сессии: cookie удаляется с теми же параметрами, с которыми выдана. */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
    const response = NextResponse.json({success: true});

    response.cookies.set(ACCOUNT_SESSION_COOKIE_NAME, '', {
        ...sessionCookieOptions(isSecureRequest(request)),
        maxAge: 0,
    });

    return response;
};
