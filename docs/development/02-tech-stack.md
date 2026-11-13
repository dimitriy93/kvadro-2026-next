# 02. Технологический стек

Версии указаны по фактическому `package.json` проекта.

## Ядро

### Next.js `16.2.3`

- **Что это:** React-фреймворк с файловой маршрутизацией, серверным рендерингом и API-роутами.
- **Где используется:** весь проект. App Router (каталог `app/`), Route Handlers как backend (`app/api/`), `next/script` для инжекции скриптов (`app/layout.tsx`), `next/image` для изображений.
- **Особенности, которые нужно знать:**
  - сборщик — **Turbopack** (в dev-логах: «Next.js 16.2.3 (Turbopack)»);
  - конвенция **`proxy.ts`** — переименование классического `middleware.ts` в Next 16 (файл `proxy.ts` в корне, используется для редиректов `/account` → `/cabinet`);
  - первая компиляция страницы в dev может занимать десятки секунд (медленная ФС усиливает эффект — предупреждение «Slow filesystem detected»);
  - `next dev` по умолчанию стартует на порту 3000 и **не умеет работать в два процесса** на один каталог: второй запуск падает или занимает другой порт (см. [14-troubleshooting.md](./14-troubleshooting.md)).

### React `19.2.5` + React DOM `19.2.5`

- **Что это:** UI-библиотека. В Next.js 16 используется React 19 с поддержкой Server Components.
- **Где используется:** все компоненты. Server Components — по умолчанию; клиентские помечены `'use client'` (например `components/popup/ui/popup.ui.tsx`, `components/theme-toggle/ui/theme-toggle.ui.tsx`, `app/(cabinet-login)/cabinet/login/ui/login.ui.tsx`).
- **Особенности:**
  - в React-компонентах **нельзя** рендерить сырой `<script>` — только через `next/script` (иначе предупреждение «Encountered a script tag…»); в проекте это уже учтено в `app/layout.tsx`;
  - при гидратации серверный и клиентский HTML должны совпадать; исключение для `<html>` в корневом layout (`suppressHydrationWarning`) — легитимный приём для ранней установки темы.

### TypeScript `6.0.2`

- **Что это:** типизированный надмножество JavaScript.
- **Где используется:** весь код (`*.ts`, `*.tsx`). Конфиг — `tsconfig.json` с алиасом `@/*` → корень проекта.
- **Проверка типов:** `npx tsc --noEmit` (отдельного lint-скрипта в проекте нет).

## Стилизация

### Sass (SCSS) `1.99.0`

- **Где используется:** все стили. Глобальные — `styles/*.scss`, подключены в `app/layout.tsx` через `styles/global.scss`; компонентные — рядом с компонентами (`*.styles.scss`).
- **Конфиг:** `next.config.ts` добавляет `sassOptions.additionalData: '@use "@/styles/_vars" as *;'` — миксины `fluid()`, `font-size()` и т. п. доступны в любом SCSS-файле без явного импорта.
- Подробнее: [07-components-and-styling.md](./07-components-and-styling.md).

## Библиотеки

| Библиотека | Версия | Зачем в проекте |
|---|---|---|
| `framer-motion` | ^12.40.0 | Анимации интерфейса (виджеты лендинга) |
| `motion` | 12.38.0 | Новое имя того же пакета анимаций; в коде виджетов используются импорты из `motion` |
| `marked` | 18.0.9 | Рендер Markdown статей в HTML (`lib/articles/loader.ts`) |
| `usehooks-ts` | 3.1.1 | Готовые React-хуки; используется `useMediaQuery` в `hooks/use-is-mobile/` |
| `sharp` | (транзитивно, через Next) | Используется только скриптом генерации изображений статей `scripts/generate-article-images.mjs` — разрешается через `node_modules/sharp`, в `package.json` напрямую не объявлен |

## Инструменты

| Инструмент | Зачем |
|---|---|
| **Node.js** | Рантайм. Разработано и проверено на Node 24.x (v24.0.0); Amvera конфигурирует Node 20 (`amvera.yml`). API-роуты объявляют `runtime = 'nodejs'` (используют `node:fs`, `node:crypto`) |
| **npm** | Пакетный менеджер (есть `package-lock.json`, npm 11.x) |
| **Prettier** | Форматирование кода (`.prettierrc`), отдельного lint-конфига нет |

## Инфраструктура

### Amvera

- Облачный хостинг Node-приложений; конфигурация — `amvera.yml` (build: `npm run build`, run: `npm run start`, порт 3000, mount `/data`).
- За reverse-proxy Amvera сайт получает заголовок `x-forwarded-proto` — на него ориентируется логика `secure` cookie кабинета (`lib/account/session.ts`, функция `isSecureRequest`).
- Подробнее: [13-deployment-and-environment.md](./13-deployment-and-environment.md).

### Внешние API

- **Telegram Bot API** — серверные POST-запросы из `lib/telegram.ts`.
- **Cloudflare Turnstile** — клиентский виджет (`components/turnstile/`) + серверная проверка токена через `siteverify` (`app/api/telegram/route.ts`).
