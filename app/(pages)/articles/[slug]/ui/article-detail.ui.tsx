import type {Article, ArticleHeading} from '@/lib/articles';
import {formatPublishedAt, formatReadingTime} from '@/lib/articles';
import Image from 'next/image';
import Link from 'next/link';
import './article-detail.styles.scss';
import ArticleNavigation from './article-navigation.ui';

type ArticleDetailProps = {
    article: Article;
    contentHtml: string;
    headings: ArticleHeading[];
};

const ArticleDetail = ({article, contentHtml, headings}: ArticleDetailProps) => {
    const dateLabel = formatPublishedAt(article.publishedAt);

    return (
        <main className="article-page">
            <div className="container article-page__container">

                {/* Общие breadcrumbs сайта */}
                {/* Здесь должен использоваться существующий компонент Breadcrumbs */}

                <header className="article-hero">

                    <div className="article-hero__top">
                        <span className="article-hero__index">
                            01
                        </span>

                        {article.category && (
                            <span className="article-hero__category">
                                {article.category}
                            </span>
                        )}
                    </div>

                    <div className="article-hero__line"/>

                    <h1 className="article-hero__title">
                        {article.title}
                    </h1>

                    <div className="article-hero__bottom">

                        <div className="article-hero__meta">
                            {dateLabel && (
                                <span>{dateLabel}</span>
                            )}

                            <span className="article-hero__dot"/>

                            <span>
                                {formatReadingTime(article.readingTime)}
                            </span>
                        </div>

                        {article.description && (
                            <p className="article-hero__lead">
                                {article.description}
                            </p>
                        )}
                    </div>
                </header>

                <div className="article-cover">
                    <div className="article-cover__frame">
                        <Image
                            src={article.cover}
                            alt={article.title}
                            fill
                            priority
                        />
                    </div>

                    <span className="article-cover__corner article-cover__corner--tl"/>
                    <span className="article-cover__corner article-cover__corner--tr"/>
                    <span className="article-cover__corner article-cover__corner--bl"/>
                    <span className="article-cover__corner article-cover__corner--br"/>

                    <div className="article-cover__label">
                        <span>КВАДРО-АРСЕНАЛ</span>
                        <span>ENGINEERING / ARTICLE</span>
                    </div>
                </div>

                <ArticleNavigation headings={headings}/>

                <div className="article-content-layout">

                    <aside className="article-aside">
                        <span className="article-aside__number">
                            01
                        </span>

                        <span className="article-aside__line"/>

                        <span className="article-aside__label">
                            Материал
                        </span>
                    </aside>

                    <div
                        className="article-body"
                        dangerouslySetInnerHTML={{__html: contentHtml}}
                    />

                </div>

                <div className="article-back">
                    <span className="article-back__line"/>

                    <Link
                        className="article-back__link"
                        href="/articles"
                    >
                        <span
                            className="article-back__arrow"
                            aria-hidden
                        >
                            ←
                        </span>

                        Вернуться к статьям
                    </Link>
                </div>

            </div>
        </main>
    );
};

export default ArticleDetail;