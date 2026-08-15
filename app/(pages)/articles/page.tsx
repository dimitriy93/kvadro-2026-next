import {Metadata} from 'next';
import {getArticles, getCategorySlug, formatPublishedAt} from '@/lib/articles';
import ArticlesPage from './ui/articles.ui';

export const metadata: Metadata = {
    title: 'Статьи',
    description:
        'Экспертные материалы компании «Квадро-Арсенал»: пожарная безопасность, видеонаблюдение, охранные системы, СКУД и слаботочная инфраструктура — простым инженерным языком.',
    alternates: {
        canonical: '/articles',
    },
    openGraph: {
        title: 'Статьи | Квадро-Арсенал',
        description:
            'Экспертные технические материалы инженерной компании «Квадро-Арсенал». Пожарная безопасность, видеонаблюдение, СКУД и слаботочные системы.',
        type: 'website',
        url: '/articles',
    },
};

export default function Page() {
    // Список статей формируется автоматически из `content/articles/`
    // (Article Loader), без ручного поддержания массива.
    const articles = getArticles().map((article) => ({
        slug: article.slug,
        title: article.title,
        description: article.description,
        category: article.category,
        categorySlug: getCategorySlug(article.category),
        date: formatPublishedAt(article.publishedAt),
        readingTime: article.readingTime,
        cover: article.cover,
    }));

    return <ArticlesPage articles={articles}/>;
}
