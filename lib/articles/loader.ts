import {readdirSync, readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {marked} from 'marked';
import {getReadingTime, stripMarkdown} from './reading-time';
import type {Article, ArticleMeta, ArticleStatus} from './types';

/**
 * Article Loader — слой работы со статьями.
 *
 * Автоматически обнаруживает все каталоги внутри `content/articles/`,
 * считывает из каждого `meta.ts` (метаданные) и `article.md` (контент).
 * Новая папка `content/articles/<new-slug>/` подхватывается автоматически
 * без каких-либо правок кода страниц.
 */

/** Корневой каталог, в котором хранятся статьи. */
const ARTICLES_ROOT = path.join(process.cwd(), 'content', 'articles');

/** Базовый публичный URL медиа-файлов статьи (`/articles/<slug>/`). */
function assetBase(slug: string): string {
    return `/articles/${slug}`;
}

/** Допустимые значения статуса публикации. */
const VALID_STATUSES: ReadonlyArray<ArticleStatus> = ['draft', 'published', 'archived'];

/**
 * Читает `meta.ts` каталога статьи и возвращает объект метаданных.
 *
 * Парсинг выполняется как обычное выражение на этапе сборки (доверенный
 * контент из репозитория), что позволяет обойти ограничения webpack/turbopack
 * на динамические `import()` с вычисляемым путём.
 */
function readMeta(directory: string): ArticleMeta | null {
    const metaPath = path.join(directory, 'meta.ts');

    if (!existsSync(metaPath)) {
        return null;
    }

    const source = readFileSync(metaPath, 'utf8');

    // Убираем операторы `import ... from '...'` и `import type ...`.
    let body = source
        .replace(/^\s*import\s+type\s+[^;]+;?\s*$/gm, '')
        .replace(/^\s*import\s+[^;]+from\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/^\s*import\s+[^;]+;?\s*$/gm, '');

    // Убираем объявления `export interface` / `export type` / `export const` в конце файла.
    body = body.replace(/\bexport\s+(interface|type|const)\b[\s\S]*$/g, '');

    // Превращаем `export default { ... };` в `return { ... };`.
    body = body.replace(/\bexport\s+default\b/, 'return').trim();

    if (!body) {
        return null;
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval -- build-time trusted content
        const parsed = new Function(`${body}`)() as Partial<ArticleMeta>;

        if (!parsed || typeof parsed !== 'object' || typeof parsed.slug !== 'string') {
            return null;
        }

        const slug = parsed.slug
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-_]+/g, '-')
            .replace(/^-+|-+$/g, '');

        if (!slug) {
            return null;
        }

        return {
            slug,
            title: typeof parsed.title === 'string' ? parsed.title : '',
            description: typeof parsed.description === 'string' ? parsed.description : '',
            category: typeof parsed.category === 'string' ? parsed.category : '',
            publishedAt: typeof parsed.publishedAt === 'string' ? parsed.publishedAt : '',
            status: VALID_STATUSES.includes(parsed.status as ArticleStatus)
                ? (parsed.status as ArticleStatus)
                : 'draft',
            cover: typeof parsed.cover === 'string' ? parsed.cover : `${assetBase(slug)}/cover.webp`,
        };
    } catch {
        return null;
    }
}

/** Читает контент статьи (`article.md`) как сырую строку Markdown. */
function readMarkdown(directory: string): string {
    const mdPath = path.join(directory, 'article.md');
    return existsSync(mdPath) ? readFileSync(mdPath, 'utf8') : '';
}

/**
 * Преобразует относительный путь изображения внутри статьи в абсолютный
 * публичный URL (медиа-файлы хранятся в `content/articles/<slug>/`
 * и отдаются route handler'ами по `/articles/<slug>/...`).
 */
function resolveImageSrc(slug: string, rawSrc: string): string {
    const src = rawSrc.trim();

    // Оставляем как есть абсолютные пути, ссылки и data-URI.
    if (/^(https?:)?\/\//.test(src) || src.startsWith('/') || src.startsWith('#') || src.startsWith('data:')) {
        return src;
    }

    return path.posix.join(assetBase(slug), src);
}

/** Возвращает массив директорий, в которых есть валидная статья. */
function discoverArticleDirectories(): string[] {
    if (!existsSync(ARTICLES_ROOT)) {
        return [];
    }

    const entries = readdirSync(ARTICLES_ROOT, {withFileTypes: true});

    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(ARTICLES_ROOT, entry.name))
        .filter((dir) => existsSync(path.join(dir, 'meta.ts')));
}

/** Разворачивает статью из каталога в типизированную сущность. */
function resolveArticle(directory: string): Article | null {
    const meta = readMeta(directory);

    if (!meta) {
        return null;
    }

    const markdown = readMarkdown(directory);

    return {
        ...meta,
        // Автоматический расчёт времени чтения из фактического контента.
        readingTime: getReadingTime(markdown),
    };
}


/**
 * Получить все статьи (всех статусов) без фильтрации.
 * Используется на этапе сборки, например в `generateStaticParams`.
 */
export function getAllArticles(): Article[] {
    const articles: Article[] = [];

    for (const directory of discoverArticleDirectories()) {
        // Одна «сломанная» статья не должна ронять весь список.
        try {
            const article = resolveArticle(directory);
            if (article) {
                articles.push(article);
            }
        } catch {
            // пропускаем некорректную статью
        }
    }

    // Стабильный порядок: сначала свежие.
    return articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * Получить только опубликованные статьи (для публичного `/articles`).
 * Draft и archived исключаются.
 */
export function getArticles(): Article[] {
    return getAllArticles().filter((article) => article.status === 'published');
}

/**
 * Получить одну статью по slug (любого статуса).
 * Возвращает `null`, если статья не найдена.
 */
export function getArticleBySlug(slug: string): Article | null {
    return getAllArticles().find((article) => article.slug === slug) ?? null;
}

/**
 * Получить метаданные одной статьи по slug.
 */
export function getArticleMeta(slug: string): ArticleMeta | null {
    const article = getArticleBySlug(slug);
    if (!article) {
        return null;
    }
    const {slug: s, title, description, category, publishedAt, status, cover} = article;
    return {slug: s, title, description, category, publishedAt, status, cover};
}

/**
 * Получить отрендеренный HTML-контент статьи по slug.
 * Относительные пути изображений внутри Markdown преобразуются в
 * абсолютные публичные URL.
 */
export function getArticleContent(slug: string): string {
    const directory = path.join(ARTICLES_ROOT, slug);

    if (!existsSync(path.join(directory, 'article.md'))) {
        return '';
    }

    let markdown = readMarkdown(directory);

    // Подставляем абсолютные URL для относительных изображений в Markdown.
    markdown = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, rawSrc) => {
        const resolved = resolveImageSrc(slug, rawSrc);
        return `![${alt ?? ''}](${resolved})`;
    });

    return marked.parse(markdown, {async: false, gfm: true, breaks: false}) as string;
}

/**
 * Получить «чистый» текст статьи (без Markdown-разметки) по slug.
 * Используется для метаданных / SEO.
 */
export function getArticlePlainText(slug: string): string {
    const directory = path.join(ARTICLES_ROOT, slug);
    return existsSync(path.join(directory, 'article.md'))
        ? stripMarkdown(readMarkdown(directory))
        : '';
}

export {formatReadingTime} from './reading-time';

export type {Article, ArticleMeta};
