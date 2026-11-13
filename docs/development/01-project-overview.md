# 01. Обзор проекта

## Что это

**«Квадро-Арсенал»** — сайт проектно-монтажной организации (г. Электросталь), занимающейся системами безопасности: охранно-пожарная сигнализация, видеонаблюдение, СКУД, слаботочные системы, домофония.

Репозиторий: `kvadro-2026-next` (Next.js 16, App Router). Сайт состоит из **двух раздельных подсистем**:

| Подсистема | URL | Назначение |
|---|---|---|
| **Публичный сайт** (лендинг + страницы) | `/`, `/about`, `/services/*`, `/articles`, `/documents`, `/contacts` | Привлечение клиентов: презентация услуг, статьи, квиз-заявки |
| **Личный кабинет клиента** | `/cabinet`, `/cabinet/*` | Просмотр клиентом состояния своих объектов мониторинга (прототип на демо-данных) |

## Задачи, которые решает сайт

1. **Маркетинг и лидогенерация** — лендинг с виджетами (Hero, Stats, Clients, Quiz), формы заявки с отправкой в Telegram (`app/api/telegram/route.ts`), попап консультации с защитой Cloudflare Turnstile.
2. **Контент** — блог со статьями из репозитория (`content/articles/`, см. [08-content-and-articles.md](./08-content-and-articles.md)).
3. **Кабинет клиента (в разработке)** — прототип с демо-данными; целевое состояние — интеграция с API системы мониторинга GEORITM (см. [12-georitm-integration.md](./12-georitm-integration.md)).

## Разделы публичного сайта

| URL | Что на странице | Где код |
|---|---|---|
| `/` | Лендинг: Hero, Stats, Clients, Quiz, CTA | `app/page.tsx` → `app/landing-content.tsx` → `widgets/*` |
| `/about` | О компании | `app/(pages)/about/` |
| `/services` | Список услуг | `app/(pages)/services/` |
| `/services/<service>` | 7 страниц услуг (пожарная сигнализация, СКУД и т. д.) | `app/(pages)/services/<service>/` |
| `/articles` | Список статей блога | `app/(pages)/articles/` |
| `/articles/<slug>` | Статья | `app/(pages)/articles/[slug]/` |
| `/documents` | Документы (лицензии и т. п.) | `app/(pages)/documents/` |
| `/contacts` | Контакты | `app/(pages)/contacts/` |
| `/privacy` | Политика конфиденциальности | ссылка из футера (страница в `app/(pages)`) |
| `*` (404) | «Объект не найден» (чертёж) | `app/not-found.tsx` |

## Публичная часть vs кабинет — чем отличаются

- **Оболочка.** Публичные страницы используют общий Header/Footer/хедер-навигацию; у кабинета **своя** оболочка `AccountShell` (`app/(cabinet)/cabinet/ui/account-shell.ui.tsx`), публичный Header/Footer туда намеренно не подключены.
- **Доступ.** Публичные страницы открыты всем; кабинет защищён серверной сессией (см. [10-cabinet-authentication.md](./10-cabinet-authentication.md)).
- **Стили.** Публичная часть — `styles/landing.scss` + `styles/pages.scss`; кабинет — собственные SCSS рядом с компонентами (`app/(cabinet)/cabinet/ui/*.scss`).
- **Индексация.** В кабинете выставлены `robots: {index: false, follow: false}` (`app/(cabinet)/cabinet/layout.tsx`, `app/(cabinet-login)/cabinet/login/page.tsx`).
- **Плавающее меню.** `FloatingMenu` скрывается на всех путях `/cabinet*` (`widgets/floating-menu/ui/floating-menu.ui.tsx`).

## Внешние системы

| Система | Зачем | Где |
|---|---|---|
| **Telegram Bot API** | Приём заявок с форм и квиза | `app/api/telegram/route.ts`, `lib/telegram.ts`, `config/telegram.config.ts` |
| **Cloudflare Turnstile** | Антиспам-защита форм заявки | `components/turnstile/`, проверка в `app/api/telegram/route.ts` |
| **GEORITM REST API** | Будущий источник данных кабинета (не подключён) | план интеграции в `GEO RITM/` |
| **Amvera** | Хостинг и деплой | `amvera.yml` |

## Что уже реализовано / что в разработке

**Реализовано:**
- весь публичный сайт (лендинг, услуги, статьи, документы, контакты, 404);
- блог с автообнаружением статей, временем чтения, навигацией по заголовкам, SEO/OG-метаданными;
- заявки в Telegram с Turnstile-проверкой;
- светлая/тёмная темы (кроме главной страницы — см. [07-components-and-styling.md](./07-components-and-styling.md));
- прототип кабинета: вход (демо), список объектов, карточка объекта с зонами, журнал событий с фильтром, заглушка карты, выход;
- редиректы со старых URL `/account/*` на `/cabinet/*` (`proxy.ts`).

**В разработке / не реализовано:**
- реальная интеграция кабинета с GEORITM (сейчас — демонстрационные данные);
- отображение карты объекта (страница `/cabinet/objects/[id]/map` — декоративная SVG-заглушка, `object-map.ui.tsx`);
- sitemap.xml и robots.txt в проекте **отсутствуют** (подтверждено: файлов `app/sitemap.*`, `app/robots.*`, `public/robots.txt` нет; в dev-логах видно `GET /robots.txt 404`). Если SEO-требования есть — это задача, а не готовая функция.
- новостной раздел `/news` и `/career` — пункты объявлены в `config/routes/main.routes.ts`, но страниц в `app/` нет (из меню не ссылаются, см. `config/navigation/menu.ts`).
