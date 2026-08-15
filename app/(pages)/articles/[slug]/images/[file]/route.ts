import path from 'node:path';
import {NextRequest, NextResponse} from 'next/server';
import {readArticleAsset} from '@/lib/articles/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
    params: Promise<{slug: string; file: string}>;
};

/**
 * Отдаёт внутренние изображения статьи `content/articles/<slug>/images/*`
 * по публичному URL `/articles/<slug>/images/<file>`.
 *
 * На этот URL ссылаются изображения внутри Markdown (например
 * `![Описание](./images/01.webp)`), преобразованные в
 * `/articles/<slug>/images/01.webp`.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    const {slug, file} = await context.params;

    // basename исключает попытки выхода за пределы каталога `images/`.
    const asset = await readArticleAsset(slug, path.posix.join('images', path.basename(file)));

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