import {NextRequest, NextResponse} from 'next/server';
import {findObjectForUser, getObjectControlState, getSessionUser} from '@/lib/account';
import type {ObjectControlState} from '@/lib/account';
import {GeoritmApiError} from '@/lib/georitm/api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = {'Cache-Control': 'no-store'} as const;

/**
 * Состояние управления охраной объекта (E12): разделы, их состояния
 * и подтверждённая доступность постановки/снятия. Read-only опрос;
 * UI обновляет состояние только из этого endpoint'а — клиентский кэш
 * и RSC-снимок источником истины не являются (E11, раздел 8).
 *
 * Feature gate GEORITM_CONTROL_ENABLED проверяется внутри диспетчера:
 * он управляет только каналом команд. Для GEORITM capability-оценка
 * вычисляется на реальных read-данных и при выключенном gate (E16):
 * DTO помечается enabled: false — видимость управления определяется
 * возможностями учётной записи, а write-команды остаются заблокированы.
 */
export const GET = async (
    _request: NextRequest,
    context: {params: Promise<{id: string}>},
): Promise<NextResponse> => {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json(
                {success: false, error: 'Требуется авторизация'},
                {status: 401, headers: NO_STORE},
            );
        }

        const {id} = await context.params;

        // Владение объектом — до любых обращений с идентификаторами;
        // чужой и несуществующий объект неотличимы (404).
        const object = await findObjectForUser(user.id, id);
        if (!object) {
            return NextResponse.json(
                {success: false, error: 'Объект не найден'},
                {status: 404, headers: NO_STORE},
            );
        }

        const control: ObjectControlState | null = await getObjectControlState(user.id, object.id);
        if (!control) {
            return NextResponse.json(
                {success: false, error: 'Объект не найден'},
                {status: 404, headers: NO_STORE},
            );
        }

        return NextResponse.json(
            {success: true, control},
            {headers: NO_STORE},
        );
    } catch (error) {
        if (error instanceof GeoritmApiError) {
            // 401 GEORITM — credentials отозваны (сессия удалена источником).
            if (error.isUnauthorized) {
                return NextResponse.json(
                    {success: false, error: 'Сессия истекла. Войдите в кабинет заново'},
                    {status: 401, headers: NO_STORE},
                );
            }
            console.error(`API partitions: GEORITM ${error.kind}${error.status ? ` HTTP ${error.status}` : ''}`);
            return NextResponse.json(
                {success: false, error: 'Сервер мониторинга недоступен. Попробуйте позже'},
                {status: 502, headers: NO_STORE},
            );
        }

        console.error('API /api/cabinet/objects/[id]/partitions ERROR:', error);
        return NextResponse.json(
            {success: false, error: 'Ошибка сервера'},
            {status: 500, headers: NO_STORE},
        );
    }
};
