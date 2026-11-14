import {NextRequest, NextResponse} from 'next/server';
import {
    findObjectForUser,
    getReportForObject,
    getSessionUser,
    isKnownReportFormat,
    isKnownReportType,
    REPORT_MAX_PERIOD_DAYS,
} from '@/lib/account';
import {GeoritmApiError} from '@/lib/georitm/api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReportRequestBody {
    type?: unknown;
    from?: unknown;
    to?: unknown;
    format?: unknown;
}

/** Строгая дата YYYY-MM-DD (валидный календарный день). */
const isIsoDate = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Сегодняшняя календарная дата в МСК (период отчёта задан по МСК). */
const todayMsk = (): string =>
    new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'})
        .format(new Date());

/**
 * ASCII-fallback для Content-Disposition: строка без кавычек, обратных
 * слэшей и не-ASCII (имя файла полностью передаётся в filename* RFC 5987).
 */
const asciiFilename = (value: string): string => {
    const cleaned = value.replace(/[^\x20-\x7E]/g, '').replace(/["\\]/g, '').trim();
    return cleaned.length > 0 ? cleaned.slice(0, 120) : 'report';
};

/**
 * Формирование и скачивание отчёта объекта (E4.3).
 *
 * Сценарий: клиент выбирает подтверждённый тип отчёта, период и формат;
 * сервер проверяет сессию и владение объектом, вызывает GEORITM
 * (синхронное формирование — файл в теле ответа) и отдаёт бинарный ответ
 * со своим Content-Type/Content-Disposition. Заголовки GEORITM и его
 * имя файла наружу не пробрасываются, бинарное содержимое в JSON не
 * сериализуется.
 */
export const POST = async (
    request: NextRequest,
    context: {params: Promise<{id: string}>},
): Promise<NextResponse> => {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({success: false, error: 'Требуется авторизация'}, {status: 401});
        }

        const {id} = await context.params;

        let body: ReportRequestBody | null = null;
        try {
            body = (await request.json()) as ReportRequestBody | null;
        } catch {
            body = null;
        }

        const type = typeof body?.type === 'string' ? body.type : '';
        const from = typeof body?.from === 'string' ? body.from : '';
        const to = typeof body?.to === 'string' ? body.to : '';
        const format = typeof body?.format === 'string' ? body.format : '';

        // Белые списки типа и формата: произвольный тип отчёта передать нельзя —
        // только подтверждённые на сервере GEORITM.
        if (!isKnownReportType(type) || !isKnownReportFormat(format)) {
            return NextResponse.json({success: false, error: 'Недопустимый тип или формат отчёта'}, {status: 400});
        }

        if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
            return NextResponse.json({success: false, error: 'Некорректный период отчёта'}, {status: 400});
        }

        if (to > todayMsk()) {
            return NextResponse.json({success: false, error: 'Период не может быть в будущем'}, {status: 400});
        }

        const spanDays = Math.round(
            (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
        ) + 1;
        if (spanDays > REPORT_MAX_PERIOD_DAYS) {
            return NextResponse.json(
                {success: false, error: `Максимальный период отчёта — ${REPORT_MAX_PERIOD_DAYS} дней`},
                {status: 400},
            );
        }

        // Владение объектом проверяется до любого вызова отчёта: чужой и
        // несуществующий объект неотличимы (404), данные не раскрываются.
        const object = await findObjectForUser(user.id, id);
        if (!object) {
            return NextResponse.json({success: false, error: 'Объект не найден'}, {status: 404});
        }

        const file = await getReportForObject(object.id, {type, from, to, format});

        // filename* (RFC 5987) — кириллица; ASCII-fallback — для старых клиентов.
        const encodedName = encodeURIComponent(file.filename);
        return new NextResponse(Buffer.from(file.content), {
            status: 200,
            headers: {
                'Content-Type': file.contentType,
                'Content-Disposition': `attachment; filename="${asciiFilename(file.filename)}"; filename*=UTF-8''${encodedName}`,
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        if (error instanceof GeoritmApiError) {
            // 401 GEORITM — credentials отозваны (сессия кабинета уже удалена
            // источником); остальные ошибки — деградация сервиса, не «пустой отчёт».
            if (error.isUnauthorized) {
                return NextResponse.json(
                    {success: false, error: 'Сессия истекла. Войдите в кабинет заново'},
                    {status: 401},
                );
            }
            if (error.kind === 'timeout') {
                return NextResponse.json(
                    {success: false, error: 'Сервер мониторинга не успел сформировать отчёт. Попробуйте период поменьше'},
                    {status: 504},
                );
            }
            console.error(`API reports: GEORITM ${error.kind}${error.status ? ` HTTP ${error.status}` : ''}`);
            return NextResponse.json(
                {success: false, error: 'Сервер мониторинга не смог сформировать отчёт. Попробуйте позже'},
                {status: 502},
            );
        }

        console.error('API /api/cabinet/objects/[id]/reports ERROR:', error);
        return NextResponse.json({success: false, error: 'Ошибка сервера'}, {status: 500});
    }
};
