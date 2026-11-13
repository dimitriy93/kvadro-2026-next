# Документация для разработчиков — сайт «Квадро-Арсенал»

Внутренняя документация проекта `kvadro-2026-next` (Next.js 16, App Router).
Рассчитана на разработчика, который открыл репозиторий впервые.

## С чего начать

1. [01-project-overview.md](./01-project-overview.md) — что это за проект, из чего состоит, что уже реализовано.
2. [04-local-development.md](./04-local-development.md) — как запустить проект локально.
3. [03-project-structure.md](./03-project-structure.md) — где что лежит.
4. [15-development-workflow.md](./15-development-workflow.md) — рецепты типовых задач («добавить статью», «изменить текст», «добавить страницу»).

## Все документы

| Документ | Содержание |
|---|---|
| [01-project-overview.md](./01-project-overview.md) | Назначение проекта, разделы сайта, публичная часть vs кабинет, реализовано / в разработке |
| [02-tech-stack.md](./02-tech-stack.md) | Технологический стек и назначение каждой технологии |
| [03-project-structure.md](./03-project-structure.md) | Карта директорий: где страница, логика, компоненты, стили, статьи, API |
| [04-local-development.md](./04-local-development.md) | Установка, запуск, сборка, переменные окружения, типовые проблемы запуска |
| [05-application-architecture.md](./05-application-architecture.md) | App Router, layouts, Route Groups, Server/Client Components, API Routes |
| [06-routing-and-pages.md](./06-routing-and-pages.md) | Все URL сайта и кабинета, конфиг маршрутов, редиректы `/account` → `/cabinet` |
| [07-components-and-styling.md](./07-components-and-styling.md) | Компоненты, SCSS-архитектура, темы (светлая/тёмная), адаптив |
| [08-content-and-articles.md](./08-content-and-articles.md) | Блог: формат статьи, метаданные, изображения, **пошаговая инструкция добавления статьи** |
| [09-cabinet-overview.md](./09-cabinet-overview.md) | Личный кабинет: возможности, страницы, демо-данные |
| [10-cabinet-authentication.md](./10-cabinet-authentication.md) | Авторизация кабинета: HMAC-сессия, cookie, защита маршрутов |
| [11-cabinet-data-and-access.md](./11-cabinet-data-and-access.md) | Слой данных кабинета, разграничение доступа, как добавлять разделы и API |
| [12-georitm-integration.md](./12-georitm-integration.md) | Интеграция GEORITM: что готово, что спроектировано, что проверить |
| [13-deployment-and-environment.md](./13-deployment-and-environment.md) | Деплой на Amvera, переменные окружения, отличия production |
| [14-troubleshooting.md](./14-troubleshooting.md) | Таблица типовых проблем и решений (в т.ч. зомби-Service Worker и гидратация) |
| [15-development-workflow.md](./15-development-workflow.md) | Рецепты типовых задач разработчика |

## Быстрый старт

```bash
npm install
npm run dev
# → http://localhost:3000
```

Локальный кабинет: `/cabinet` (демо-учётные записи показываются на странице `/cabinet/login` только в dev-режиме).

Production-сборка:

```bash
npm run build && npm run start
```

## Важные особенности проекта

- **Публичная часть и кабинет — две раздельные подсистемы** с разными оболочками (Header/Footer у кабинета свои).
- **Статьи хранятся не в CMS, а в репозитории** — `content/articles/<slug>/` (`article.md` + `meta.ts` + изображения). Добавление статьи = создание папки, код менять не нужно.
- **Кабинет — прототип на демонстрационных данных** (`lib/account/demo-data.ts`); реальный источник данных GEORITM ещё не подключён (см. [12-georitm-integration.md](./12-georitm-integration.md)).
- **Service Worker проект не использует** — если браузер «зависает» на старых данных localhost, см. [14-troubleshooting.md](./14-troubleshooting.md).
