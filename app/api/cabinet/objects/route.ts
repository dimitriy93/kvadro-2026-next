import {NextResponse} from 'next/server';
import {getObjectsForUser, getSessionUser} from '@/lib/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Объекты текущего пользователя. Разрешённый список определяется только
 * серверной функцией getObjectsForUser — клиентский список полномочий
 * не принимается. Без действительной сессии данные не отдаются.
 *
 * `Cache-Control: no-store` — ответ персональный: ни браузеру, ни
 * промежуточным прокси кешировать его нельзя.
 */
const NO_STORE_HEADERS = {'Cache-Control': 'no-store'} as const;

export const GET = async (): Promise<NextResponse> => {
    const user = await getSessionUser();

    if (!user) {
        return NextResponse.json(
            {success: false, error: 'Требуется авторизация'},
            {status: 401, headers: NO_STORE_HEADERS},
        );
    }

    return NextResponse.json(
        {success: true, objects: await getObjectsForUser(user.id)},
        {headers: NO_STORE_HEADERS},
    );
};
