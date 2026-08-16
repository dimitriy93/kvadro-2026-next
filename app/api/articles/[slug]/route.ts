import {NextRequest, NextResponse} from 'next/server';
import {getArticleBySlug} from '@/lib/articles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
    params: Promise<{slug: string}>;
};

/**
 * Лёгкий серверный адаптер для Breadcrumbs.
 *
 * `Breadcrumbs` — Client Component и не может напрямую читать `meta.ts`
 * (Article Loader использует `node:fs` на сервере). Этот route handler служит
 * серверной границей: по slug он возвращает `article.title` из `meta.ts`
 * через существующий Article Loader — без дублирования заголовка и без
 * ручного mapping статей.
 *
 * `GET /api/articles/[slug]` → `{ title: string | null }`
 *
 * Для неопубликованной или несуществующей статьи возвращается `null`,
 * чтобы клиентский `Breadcrumbs` использовал существующий fallback.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    const {slug} = await context.params;
    const article = getArticleBySlug(slug);

    if (!article || article.status !== 'published' || !article.title) {
        return NextResponse.json({title: null});
    }

    return NextResponse.json({title: article.title});
}