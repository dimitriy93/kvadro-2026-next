/**
 * Чтение медиа-ассетов статьи (cover, изображения) из каталога статьи.
 *
 * Статья — полностью автономная сущность в `content/articles/<slug>/`:
 * рядом с `meta.ts` и `article.md` лежат `cover.webp` и `images/*`.
 * Медиа не публикуются через `public/`, а отдаются рантайм-обработчиками
 * (route handlers) по публичным URL вида `/articles/<slug>/...`.
 */

import {readFile} from 'node:fs/promises';
import path from 'node:path';

/** Корневой каталог, в котором хранятся статьи. */
const ARTICLES_ROOT = path.join(process.cwd(), 'content', 'articles');

/** Маппинг расширений на `Content-Type` для медиа-файлов статей. */
const CONTENT_TYPES: Record<string, string> = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
};

/**
 * Абсолютный путь к каталогу статьи. Slug базово обезвреживается,
 * чтобы нельзя было выйти за пределы `content/articles/`.
 */
function articleDir(slug: string): string {
    const safeSlug = path.basename(slug).replace(/[^a-z0-9-_]+/gi, '');
    return path.join(ARTICLES_ROOT, safeSlug);
}

/**
 * Резолвит относительный путь ассета внутри каталога статьи.
 * Возвращает `null`, если путь выходит за пределы каталога статьи
 * (защита от path traversal).
 */
function resolveInside(slug: string, relPath: string): string | null {
    const root = articleDir(slug);
    const target = path.resolve(root, relPath);
    const rootWithSep = path.resolve(root) + path.sep;

    if (target !== path.resolve(root) && !target.startsWith(rootWithSep)) {
        return null;
    }

    return target;
}

/** Возвращает `Content-Type` для файла по его расширению (или `null`). */
function contentTypeOf(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    return CONTENT_TYPES[ext] ?? null;
}

/**
 * Читает бинарный ассет статьи: `readArticleAsset(slug, 'cover.webp')`,
 * `readArticleAsset(slug, 'images/01.webp')`.
 *
 * Возвращает `{data, type}` или `null`, если файл отсутствует / небезопасен.
 */
export async function readArticleAsset(
    slug: string,
    relPath: string,
): Promise<{data: Buffer; type: string} | null> {
    const filePath = resolveInside(slug, relPath);

    if (!filePath) {
        return null;
    }

    const type = contentTypeOf(filePath);
    if (!type) {
        return null;
    }

    try {
        const data = await readFile(filePath);
        return {data, type};
    } catch {
        return null;
    }
}