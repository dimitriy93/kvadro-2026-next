import {NextResponse} from 'next/server';
import {getSessionUser} from '@/lib/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Минимальная информация о текущем пользователе; аноним — 401 без данных. */
export const GET = async (): Promise<NextResponse> => {
    const user = await getSessionUser();

    if (!user) {
        return NextResponse.json(
            {success: false, user: null},
            {status: 401, headers: {'Cache-Control': 'no-store'}},
        );
    }

    return NextResponse.json(
        {success: true, user},
        {headers: {'Cache-Control': 'no-store'}},
    );
};
