import {NextResponse} from 'next/server';
import {getDemoObjectsForUser, getSessionUser} from '@/lib/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Объекты текущего пользователя. Разрешённый список определяется только
 * серверной функцией getDemoObjectsForUser — клиентский список полномочий
 * не принимается. Без действительной сессии данные не отдаются.
 */
export const GET = async (): Promise<NextResponse> => {
    const user = await getSessionUser();

    if (!user) {
        return NextResponse.json({success: false, error: 'Требуется авторизация'}, {status: 401});
    }

    return NextResponse.json({success: true, objects: getDemoObjectsForUser(user.id)});
};
