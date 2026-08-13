import {Metadata} from 'next';
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
    return <ArticlesPage />;
}
