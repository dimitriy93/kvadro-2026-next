'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useMemo, useState} from 'react';
import {articleCategories, type Article} from '../config/articles.data';
import {articlesBackgroundImg} from '@/app/_assets/images/articles';
import './articles.styles.scss';

const ArticlesPage = ({articles}: {articles: Article[]}) => {
    const [activeCategory, setActiveCategory] = useState<string>('all');

    const filtered = useMemo(() => {
        if (activeCategory === 'all') {
            return articles;
        }
        return articles.filter((article) => article.categorySlug === activeCategory);
    }, [activeCategory]);

    const featured = filtered.find((article) => article.featured) ?? filtered[0];
    const rest = filtered.filter((article) => article !== featured);

    const renderArticleItem = (article: Article, index: number) => (
        <Link
            href={`/articles/${article.slug}`}
            className="articles-item"
            key={article.slug}
        >
            <span className="articles-item__index">
                {String(index + 1).padStart(2, '0')}
            </span>

            <div className="articles-item__media">
                <Image
                    src={article.cover}
                    alt={article.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 240px"
                />
            </div>

            <div className="articles-item__body">
                <span className="articles-cat">{article.category}</span>
                <h3 className="articles-item__title">{article.title}</h3>
                <p className="articles-item__desc">{article.description}</p>

                <div className="articles-meta">
                    <span>{article.date}</span>
                    <span className="articles-meta__dot">·</span>
                    <span>{article.readingTime} мин чтения</span>
                </div>
            </div>

            <span className="articles-item__arrow" aria-hidden>→</span>
        </Link>
    );

    return (
        <main className="articles">
            <div className="container articles__container">
                <section className="articles-hero">
                    <div className="articles-hero__content">
                        <span
                            className="articles-hero__eyebrow">Знания, которые помогают принимать правильные решения</span>
                        <h1 className="articles-hero__title">
                            Статьи
                        </h1>
                        <p className="articles-hero__lead">
                            Разбираем вопросы пожарной безопасности, видеонаблюдения, охранных
                            систем, СКУД и слаботочной инфраструктуры простым инженерным языком.
                        </p>
                    </div>

                    <div className="articles-hero__visual">
                        <Image
                            src={articlesBackgroundImg}
                            alt=""
                            fill
                            priority
                        />
                    </div>
                </section>
                <nav className="articles-cats" aria-label="Категории статей">
                    <span className="articles-cats__label">Выберите категорию</span>

                    <ul className="articles-cats__list">
                        {articleCategories.map((category) => {
                            const isActive = category.slug === activeCategory;
                            return (
                                <li key={category.slug}>
                                    <button
                                        type="button"
                                        className={`articles-cats__item ${
                                            isActive ? 'is-active' : ''
                                        }`}
                                        aria-pressed={isActive}
                                        onClick={() => setActiveCategory(category.slug)}
                                    >
                                        {category.title}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {featured && (
                    <article className="articles-featured">
                        <div className="articles-featured__media">
                            <Image
                                src={featured.cover}
                                alt={featured.title}
                                fill
                                priority
                                sizes="(max-width: 900px) 100vw, 55vw"
                            />
                        </div>

                        <div className="articles-featured__content">
                            <span className="articles-cat">{featured.category}</span>
                            <h2 className="articles-featured__title">{featured.title}</h2>
                            <p className="articles-featured__desc">{featured.description}</p>

                            <div className="articles-meta">
                                <span>{featured.date}</span>
                                <span className="articles-meta__dot">·</span>
                                <span>{featured.readingTime} мин чтения</span>
                            </div>

                            <Link
                                href={`/articles/${featured.slug}`}
                                className="articles-read articles-read--featured"
                            >
                                Читать статью
                                <span className="articles-read__arrow" aria-hidden>→</span>
                            </Link>
                        </div>
                    </article>
                )}

                {rest.length > 0 && (
                    <section
                        className="articles-list articles-list--desktop"
                        aria-label="Список статей"
                    >
                        {rest.map((article, index) => renderArticleItem(article, index))}
                    </section>
                )}

                <section
                    className="articles-list articles-list--mobile"
                    aria-label="Список статей"
                >
                    {[featured, ...rest].map((article, index) => renderArticleItem(article, index))}
                </section>
            </div>
        </main>
    );
};

export default ArticlesPage;

