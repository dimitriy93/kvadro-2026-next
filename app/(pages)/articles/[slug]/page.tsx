import {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {
    getAllArticles,
    getArticleBySlug,
    getArticleDetail,
} from '@/lib/articles';
import ArticleDetail from './ui/article-detail.ui';

type ArticlePageProps = {
    params: Promise<{slug: string}>;
};

/**
 * Статическая генерация страниц всех опубликованных статей.
 */
export function generateStaticParams() {
    return getAllArticles()
        .filter((article) => article.status === 'published')
        .map((article) => ({slug: article.slug}));
}

/**
 * Динамические метаданные формируются из `meta.ts` конкретной статьи.
 * Title / description / Open Graph / og:image — без ручного дублирования.
 */
export async function generateMetadata({params}: ArticlePageProps): Promise<Metadata> {
    const {slug} = await params;
    const article = getArticleBySlug(slug);

    if (!article || article.status !== 'published') {
        return {};
    }

    return {
        title: article.title,
        description: article.description,
        alternates: {
            canonical: `/articles/${article.slug}`,
        },
        openGraph: {
            title: `${article.title} | Квадро-Арсенал`,
            description: article.description,
            type: 'article',
            url: `/articles/${article.slug}`,
            images: [{url: article.cover, alt: article.title}],
        },
    };
}

export default async function ArticlePage({params}: ArticlePageProps) {
    const {slug} = await params;
    const article = getArticleBySlug(slug);

    // Неопубликованная или несуществующая статья → штатная 404.
    if (!article || article.status !== 'published') {
        notFound();
    }

    const {html, headings} = getArticleDetail(article.slug);

    return <ArticleDetail article={article} contentHtml={html} headings={headings}/>;
}
