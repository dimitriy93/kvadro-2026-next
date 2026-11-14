# Сайт «Квадро-Арсенал» (kvadro-2026-next)

Корпоративный сайт проектно-монтажной организации «Квадро-Арсенал» (г. Электросталь) и личный кабинет клиента мониторинговых услуг.

- **Публичная часть**: лендинг, страницы услуг, блог со статьями из репозитория, документы, контакты, заявки в Telegram с защитой Cloudflare Turnstile.
- **Личный кабинет** (`/cabinet`): просмотр клиентом состояния своих объектов мониторинга. Источники данных: `demo` (демонстрационные данные, по умолчанию) и `georitm` — реальный вход через REST API GEORITM (см. `docs/development/12-georitm-integration.md`).

## Технологии

| Слой | Технология |
|---|---|
| Фреймворк | Next.js 16.2.3 (App Router, Turbopack), React 19 |
| Язык | TypeScript 6 |
| Стили | SCSS (Sass 1.99), семантические токены тем, fluid-типографика |
| Контент | Markdown-статьи из `content/articles/` (marked), медиа через route handlers |
| Анимации | framer-motion / motion |
| Инфраструктура | Amvera (Node 20, `amvera.yml`) |

## Требования к окружению

- Node.js 20+ (разработка ведётся на v24), npm 10+
- Переменные окружения в `.env.local` (см. [docs/development/04-local-development.md](./docs/development/04-local-development.md)):
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `ACCOUNT_SESSION_SECRET` (production-кабинет), `ACCOUNT_DATA_SOURCE` (`demo`|`georitm`), `GEORITM_BASE_URL` (режим georitm); полный список — [.env.example](./.env.example).

## Быстрый запуск

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production-сборка
npm run start      # запуск production-сборки
npx tsc --noEmit   # проверка типов
```

Кабинет: `http://localhost:3000/cabinet` — в dev-режиме на странице входа видны тестовые учётные записи; в production демо-вход отключён.

## Карта возможностей

| Раздел | URL | Код |
|---|---|---|
| Лендинг | `/` | `app/page.tsx`, `app/landing-content.tsx`, `widgets/` |
| Услуги (7 страниц) | `/services/...` | `app/(pages)/services/` |
| Статьи | `/articles`, `/articles/<slug>` | `app/(pages)/articles/`, `content/articles/`, `lib/articles/` |
| Документы / Контакты | `/documents`, `/contacts` | `app/(pages)/...` |
| Заявки (Telegram + Turnstile) | — | `app/api/telegram/`, `lib/telegram.ts` |
| Кабинет: вход, объекты, события, карта | `/cabinet/...` | `app/(cabinet)/`, `app/(cabinet-login)/`, `lib/account/` |
| API кабинета | `/api/cabinet/...` | `app/api/cabinet/` |
| Редиректы старых URL `/account` → `/cabinet` | — | `proxy.ts` |

## Документация

Полная документация для разработчиков — в [docs/development/README.md](./docs/development/README.md):

- обзор проекта и структура репозитория;
- локальная разработка и деплой на Amvera;
- инструкция добавления статей;
- руководство по личному кабинету (авторизация, доступ, демо-данные);
- интеграция GEORITM (что готово / что в плане);
- диагностика типовых проблем.

Документация по scroll-хукам — [docs/development/hooks-scroll.md](./docs/development/hooks-scroll.md).
