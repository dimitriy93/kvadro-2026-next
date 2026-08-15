/**
 * Типизация модульной системы статей.
 *
 * Каждая статья — автономная сущность в `content/articles/<slug>/`:
 * `meta.ts` (метаданные), `article.md` (контент в Markdown),
 * `cover.webp` (обложка) и `images/*` (внутренние изображения).
 * Медиа-файлы хранятся только здесь и отдаются по URL
 * (`/articles/<slug>/cover.webp`, `/articles/<slug>/images/...`)
 * рантайм-обработчиками (route handlers) прямо из каталога статьи.
 */

export type ArticleStatus = 'draft' | 'published' | 'archived';

/**
 * Метаданные статьи, объявленные в файле `meta.ts` внутри каталога статьи.
 */
export interface ArticleMeta {
    /** Уникальный идентификатор статьи (используется в URL `/articles/<slug>`). */
    slug: string;
    /** Заголовок статьи. */
    title: string;
    /** Краткое описание для карточки и поисковых систем. */
    description: string;
    /** Категория (отображается на карточке и странице статьи). */
    category: string;
    /** Дата публикации в формате `YYYY-MM-DD`. */
    publishedAt: string;
    /** Статус публикации. На публичном сайте отображаются только `published`. */
    status: ArticleStatus;
    /** URL обложки статьи (отдаётся route handler'ом из `content/articles/<slug>/cover.webp`). */
    cover: string;
}

/**
 * Полное представление статьи: метаданные + производные поля.
 */
export interface Article extends ArticleMeta {
    /** Примерное время чтения в минутах (вычисляется автоматически из контента). */
    readonly readingTime: number;
}

/**
 * Облегчённое представление статьи для списка / карточек.
 */
export type ArticleSummary = Article;
