# 03. Структура проекта

## Карта директорий

```text
kvadro-2026-next/
├── app/                        # App Router: страницы, layouts, API Routes
│   ├── (pages)/                # Route Group публичных страниц (общий layout)
│   │   ├── about/  articles/  contacts/  documents/  services/
│   ├── (cabinet)/              # Route Group защищённого кабинета (guard в layout)
│   │   └── cabinet/            # URL-префикс /cabinet
│   ├── (cabinet-login)/        # Route Group страницы входа (БЕЗ guard-а)
│   │   └── cabinet/login/
│   ├── api/                    # API Routes (backend)
│   │   ├── articles/[slug]/    # GET title статьи для хлебных крошек
│   │   ├── cabinet/            # login / logout / session / objects
│   │   └── telegram/           # приём заявок → Telegram
│   ├── _assets/                # шрифты и изображения публичной части
│   ├── layout.tsx              # корневой layout (шрифты, темы, Turnstile, FloatingMenu)
│   ├── page.tsx                # лендинг /
│   ├── landing-content.tsx     # клиентская композиция виджетов лендинга
│   └── not-found.tsx           # публичная 404
├── components/                 # переиспользуемые UI-компоненты
│   ├── button/ breadcrumbs/ logo/ popup/ theme-toggle/ turnstile/ ...
├── widgets/                    # крупные блоки лендинга
│   ├── hero/ stats/ clients/ quiz/ cta/ footer/ floating-menu/ services/
├── lib/                        # серверная/общая логика (без UI)
│   ├── account/                # кабинет: контракты, демо-данные, сессии
│   ├── articles/               # Article Loader (fs + marked)
│   ├── telegram.ts             # отправка заявок в Telegram
│   └── phone-mask.ts
├── config/                     # конфигурация без логики
│   ├── routes/                 # main.routes.ts, services.routes.ts, cabinet.routes.ts
│   ├── navigation/menu.ts      # меню (плавающее, футер, услуги)
│   ├── brand/contacts.ts       # контакты компании
│   └── telegram.config.ts      # шаблоны сообщений
├── content/
│   └── articles/<slug>/        # статьи: article.md + meta.ts + cover.webp + images/
├── docs/development/           # эта документация
├── hooks/                      # use-is-mobile, use-scroll-motion, use-scroll-progress
├── providers/                  # consultation-provider (попап консультации)
├── public/                     # статика: images/
├── scripts/                    # generate-article-images.mjs (заглушки изображений)
├── styles/                     # глобальные стили и дизайн-токены
├── types/                      # общие TS-типы (telegram.ts)
├── GEO RITM/                   # документация и планы интеграции GEORITM
├── proxy.ts                    # редиректы /account/* → /cabinet/* (Next 16 middleware)
├── amvera.yml                  # конфиг деплоя
└── next.config.ts              # sass-конфиг
```

## Ответы на вопросы «где что искать»

| Вопрос | Ответ |
|---|---|
| Где находится страница? | `app/(pages)/<раздел>/page.tsx` (публичная) или `app/(cabinet)/cabinet/...` (кабинет). Внутри `page.tsx` — только данные и метаданные; разметка в `ui/*.ui.tsx` рядом |
| Где логика страницы? | Серверная — в `page.tsx` и `lib/`; клиентская — в `'use client'`-компонентах `ui/` |
| Где компоненты? | Переиспользуемые — `components/`; блоки лендинга — `widgets/`; локальные для страницы — `ui/` внутри каталога страницы |
| Где стили? | Глобальные — `styles/`; компонентные — `*.styles.scss` рядом с компонентом; страница-специфичные — `ui/*.styles.scss` |
| Где статьи? | `content/articles/<slug>/` — `article.md` (текст), `meta.ts` (метаданные), `cover.webp`, `images/` |
| Где изображения? | Публичные — `public/images/`; изображения статей — внутри каталога статьи; графика лендинга — `app/_assets/images/` |
| Где API-обработчики? | `app/api/<имя>/route.ts` |
| Где настраиваются маршруты? | URL-константы — `config/routes/`; физическая маршрутизация — структура каталогов `app/`; редиректы старых URL — `proxy.ts` |
| Где реализована авторизация кабинета? | `lib/account/session.ts` (токен/cookie), `app/api/cabinet/login|logout|session/` (API), guard — `app/(cabinet)/cabinet/layout.tsx` |
| Где данные кабинета? | Демо: `lib/account/demo-data.ts`, `lib/account/demo-events.ts`; типы — `lib/account/contracts.ts` |

## Соглашения именования

- Компоненты: `PascalCase.ui.tsx` рядом со стилем `*.styles.scss` (например `components/button/ui/button.ui.tsx` + `button.styles.scss`).
- Props-интерфейсы: `I<Component>Props`.
- Barrel-экспорты: `index.ts` в корне модуля (`lib/account/index.ts`, `hooks/use-is-mobile/index.ts`).
- Комментарии и докстринги — на русском; объясняют «почему», а не «что».

## Ключевые связи между модулями

- `config/routes/*` — единственный источник URL-констант; компоненты не хардкодят пути.
- `lib/account/index.ts` — barrel: страницы и API кабинета импортируют только из `@/lib/account`, что позволяет подменить источник данных без правки UI (важно для GEORITM).
- `lib/articles/` — единственный слой доступа к статьям; страницы блога не читают `content/` напрямую.
- `app/layout.tsx` — корень для обеих подсистем: шрифты, темы, Turnstile, FloatingMenu, dev-скрипт очистки мёртвых Service Worker.
