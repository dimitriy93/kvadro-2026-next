import {NextRequest, NextResponse} from 'next/server';
import {
    ControlError,
    executeObjectControl,
    findObjectForUser,
    getSessionUser,
} from '@/lib/account';
import type {ControlAction, ControlErrorReason} from '@/lib/account';
import {isGeoritmControlEnabled} from '@/lib/account/control-gate';
import {GeoritmApiError} from '@/lib/georitm/api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = {'Cache-Control': 'no-store'} as const;

interface ControlRequestBody {
    action?: unknown;
    areaNum?: unknown;
}

/**
 * HTTP-статус причины отказа ControlError. Причины не раскрывают
 * внутренние параметры GEORITM (IMEI, номера серверных объектов) —
 * наружу идёт только человекочитаемое сообщение.
 */
const REASON_STATUS: Readonly<Record<ControlErrorReason, number>> = {
    'gate-disabled': 403,
    'no-permission': 403,
    'unsupported': 403,
    'unknown-capability': 403,
    'unknown-area': 400,
    'already-in-state': 409,
    'in-flight': 409,
    'cooldown': 409,
    'rate-limited': 429,
    'not-owned': 404,
};

/**
 * Команда управления охраной раздела (E12): постановка на охрану
 * (objects/arm/) и снятие с охраны (objects/disarm/).
 *
 * Гарантии сервера:
 *  - браузер передаёт только {action, areaNum}: IMEI, номера объектов
 *    GEORITM и разделы разрешаются исключительно на сервере после
 *    проверки владения объектом и прав пользователя (контракт E11);
 *  - feature gate GEORITM_CONTROL_ENABLED проверяется трижды: в маршруте
 *    ДО ownership-чтений, в источнике и в georitm-control. При выключенном
 *    gate (текущее состояние E12) маршрут отвечает 403 с пометкой
 *    controlDisabled и не выполняет НИ ОДНОГО вызова GEORITM — ни write-,
 *    ни read- (ownership-чтения findObjectForUser выполняются только при
 *    включённом gate, E14); браузер и demo-режим обойти запрет не могут;
 *  - результат — честная трёхзначность: 'confirmed' только по фактическому
 *    переходу состояния objects/state/, {success: 1} успехом не считается;
 *  - повторная отправка при неопределённом результате блокируется
 *    сервером (409 cooldown), не только UI.
 */
export const POST = async (
    request: NextRequest,
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

        let body: ControlRequestBody | null = null;
        try {
            body = (await request.json()) as ControlRequestBody | null;
        } catch {
            body = null;
        }

        // Белый список действия: произвольное действие передать нельзя —
        // контракт GEORITM содержит ровно два метода (arm/disarm).
        const action = body?.action;
        const isValidAction = action === 'arm' || action === 'disarm';

        const rawArea = body?.areaNum;
        // Номер раздела — целое число ≥ 0 (раздел 0 встречается у приборов,
        // E11 7.6); дробные, строковые и отрицательные значения отклоняются.
        const isValidArea = typeof rawArea === 'number'
            && Number.isInteger(rawArea)
            && rawArea >= 0
            && rawArea <= 9999;

        if (!isValidAction || !isValidArea) {
            return NextResponse.json(
                {success: false, error: 'Некорректный запрос управления'},
                {status: 400, headers: NO_STORE},
            );
        }

        // Feature gate — до ownership-чтений (E14): при выключенном gate
        // маршрут не выполняет ни одного вызова GEORITM (findObjectForUser
        // ниже делает read-запросы tree-set/obj/, которые при выключенном
        // gate не нужны). Ответ одинаков для несуществующего, чужого и
        // своего объекта — существование объектов не раскрывается; отзыв
        // сессии при 401 GEORITM на этом маршруте при выключенном gate
        // недостижим (вызовов нет) и сохранён на всех остальных путях
        // (страницы, partitions) и здесь при включённом gate.
        if (!isGeoritmControlEnabled()) {
            return NextResponse.json(
                {success: false, error: 'Управление охраной отключено', controlDisabled: true},
                {status: 403, headers: NO_STORE},
            );
        }

        // Владение объектом — до любых обращений с идентификаторами объекта:
        // чужой и несуществующий объект неотличимы (404), источник вызывается
        // только для владеемых объектов.
        const object = await findObjectForUser(user.id, id);
        if (!object) {
            return NextResponse.json(
                {success: false, error: 'Объект не найден'},
                {status: 404, headers: NO_STORE},
            );
        }

        const result = await executeObjectControl(user.id, object.id, action, rawArea);
        return NextResponse.json(
            {success: true, result: result.result, message: result.message, partitions: result.partitions},
            {headers: NO_STORE},
        );
    } catch (error) {
        if (error instanceof ControlError) {
            const status = REASON_STATUS[error.reason];
            return NextResponse.json(
                {
                    success: false,
                    error: error.message,
                    ...(error.reason === 'gate-disabled' ? {controlDisabled: true} : {}),
                },
                {status, headers: NO_STORE},
            );
        }

        if (error instanceof GeoritmApiError) {
            // 401 GEORITM — credentials отозваны (сессия удалена источником).
            if (error.isUnauthorized) {
                return NextResponse.json(
                    {success: false, error: 'Сессия истекла. Войдите в кабинет заново'},
                    {status: 401, headers: NO_STORE},
                );
            }
            console.error(`API control: GEORITM ${error.kind}${error.status ? ` HTTP ${error.status}` : ''}`);
            return NextResponse.json(
                {success: false, error: 'Сервер мониторинга недоступен. Попробуйте позже'},
                {status: 502, headers: NO_STORE},
            );
        }

        console.error('API /api/cabinet/objects/[id]/control ERROR:', error);
        return NextResponse.json(
            {success: false, error: 'Ошибка сервера'},
            {status: 500, headers: NO_STORE},
        );
    }
};
