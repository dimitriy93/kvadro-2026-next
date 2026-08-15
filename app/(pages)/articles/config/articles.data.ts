export interface Article {
    slug: string;
    title: string;
    description: string;
    category: string;
    categorySlug: string;
    date: string;
    readingTime: number;
    cover: string;
    featured?: boolean;
}

export interface ArticleCategory {
    slug: string;
    title: string;
}

export const articleCategories: ArticleCategory[] = [
    {slug: 'all', title: 'Все'},
    {slug: 'fire-safety', title: 'Пожарная безопасность'},
    {slug: 'video-surveillance', title: 'Видеонаблюдение'},
    {slug: 'security-alarm', title: 'Охранная сигнализация'},
    {slug: 'access-control', title: 'СКУД'},
    {slug: 'low-current', title: 'Слаботочные системы'},
    {slug: 'design', title: 'Проектирование'},
] as const;

/* Список статей формируется автоматически из каталога `content/articles/`
   Article Loader'ом (см. `lib/articles`) — ручного массива больше нет. */

