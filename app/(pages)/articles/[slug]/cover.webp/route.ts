import {NextRequest, NextResponse} from 'next/server';
import {readArticleAsset} from '@/lib/articles/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
    params: Promise<{slug: string}>;
};

/**
 * Отдаёт обложку статьи `content/articles/<slug>/cover.webp`
 * по публичному URL `/articles/<slug>/cover.webp`.
 *
 * Медиа-файлы не дублируются в `public/` — статья остаётся автономной,
 * а изображения обслуживаются этим обработчиком на этапе запроса.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    const {slug} = await context.params;
    const asset = await readArticleAsset(slug, 'cover.webp');

    if (!asset) {
        return new NextResponse('Not Found', {status: 404});
    }

    return new NextResponse(new Uint8Array(asset.data), {
        status: 200,
        headers: {
            'Content-Type': asset.type,
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
}