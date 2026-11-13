import {NextRequest, NextResponse} from 'next/server';

/**
 * Постоянные редиректы старых маршрутов личного кабинета.
 *
 * Пользовательские страницы кабинета переехали с `/account` на `/cabinet`
 * (см. config/routes/cabinet.routes.ts). Здесь сохраняется обратная
 * совместимость адресов: 308 Permanent Redirect сохраняет HTTP-метод и
 * query-параметры (например фильтр `/account/objects/<id>/events?type=...`
 * доедет до нового адреса без потерь).
 *
 * API `/api/account/*` не редиректится: endpoints переехали на `/api/cabinet/*`
 * вместе со страницами, внешних потребителей у них нет (прототип), а сквозной
 * редирект POST-запросов с телом и Set-Cookie не нужен ни одному клиенту
 * проекта. Это осознанное решение, а не упущение.
 *
 * Конвенция `proxy.ts` — переименование middleware в Next.js 16.
 */
export function proxy(request: NextRequest): NextResponse {
    const {pathname} = request.nextUrl;

    if (pathname === '/account' || pathname.startsWith('/account/')) {
        const url = request.nextUrl.clone();
        // nextUrl.clone() переносит query-параметры; меняется только путь.
        url.pathname = `/cabinet${pathname.slice('/account'.length)}`;
        return NextResponse.redirect(url, 308);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/account', '/account/:path*'],
};
