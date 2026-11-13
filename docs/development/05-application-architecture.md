# 05. Архитектура приложения

## App Router — как формируются страницы

Next.js App Router строит маршруты из **физической структуры каталога `app/`**:

- `page.tsx` — страница маршрута;
- `layout.tsx` — обёртка для всех вложенных маршрутов (вложенность layouts наследуется);
- `route.ts` — API Route Handler (нет UI);
- `not-found.tsx` — страница 404 для своей зоны;
- `[param]` — динамический сегмент (`[slug]`, `[id]`);
- `(группа)` — **Route Group**: скобки не входят в URL, группа только организует общие layouts.

Пример из проекта: URL `/cabinet/objects/[id]/events` рендерится файлом
`app/(cabinet)/cabinet/objects/[id]/events/page.tsx` — скобки `(cabinet)` в URL не участвуют, `cabinet/objects/...` — участвуют. **Не путать URL с именами папок.**

## Layouts в проекте

| Layout | Файл | Что делает |
|---|---|---|
| Корневой | `app/layout.tsx` | `<html>`, шрифт Inter, ранний инлайн-скрипт темы, Turnstile API, FloatingMenu, dev-очистка мёртвых SW. Общий для всего сайта |
| Публичные страницы | `app/(pages)/layout.tsx` | Оболочка публичного сайта (Header/Footer-зависимая навигация страниц) |
| Кабинет | `app/(cabinet)/cabinet/layout.tsx` | **Guard**: `getSessionUser()` → редирект анонима на `/cabinet/login`; оборачивает детей в `AccountShell`; `robots: noindex` |
| Вход | `app/(cabinet-login)/cabinet/login/page.tsx` | Без guard-а — отдельная Route Group ровно затем, чтобы не наследовать проверку сессии |
| Кабинетная 404 | `app/(cabinet)/cabinet/not-found.tsx` | «Объект не найден» внутри оболочки кабинета (не раскрывает существование чужих объектов) |

## Route Groups — почему их две для кабинета

`(cabinet)` и `(cabinet-login)` дают один URL-префикс `/cabinet`, но разные layouts: защищённая зона и страница входа. Страница входа не может лежать внутри `(cabinet)`, иначе её перехватил бы guard и получился бы вечный редирект (аноним → login → guard → redirect login …).

## Server Components и Client Components

По умолчанию **все компоненты — серверные** (рендерятся только на сервере, могут читать ФС/БД, не могут иметь state/handlers). Клиентские помечаются директивой `'use client'` первой строкой файла.

В проекте:

- **Серверные:** все `page.tsx`, `lib/articles/*` (читает файловую систему), `app/(cabinet)/cabinet/ui/objects-overview.ui.tsx`, `object-state.ui.tsx`, `object-events.ui.tsx` и др. — получают данные на сервере и отдают готовую разметку.
- **Клиентские (`'use client'`):** `app/(cabinet-login)/cabinet/login/ui/login.ui.tsx` (форма входа), `app/(cabinet)/cabinet/ui/logout-button.ui.tsx` (кнопка выхода), `components/popup/`, `components/theme-toggle/`, `components/turnstile/`, `widgets/quiz/`, `widgets/floating-menu/`, `components/breadcrumbs/`.

Правило передачи данных: серверная страница получает данные → передаёт их в props клиентского/дочернего компонента. Клиентский компонент не читает ФС и демо-данные — в кабинете это требование безопасности (модуль `lib/account/demo-data.ts` содержит пароли и запрещён к импорту в клиентский код).

## API Routes (Route Handlers)

- Файлы `app/api/<путь>/route.ts` экспортируют `GET`/`POST`/... функции.
- В проекте все объявляют `export const runtime = 'nodejs'` (нужны `node:fs`, `node:crypto`).
- `export const dynamic = 'force-dynamic'` стоит у read-API (`session`, `objects`, `articles/[slug]`), чтобы исключить кэширование.

| Endpoint | Метод | Назначение |
|---|---|---|
| `/api/cabinet/login` | POST | Проверка учётных данных, выпуск cookie-сессии |
| `/api/cabinet/logout` | POST | Удаление cookie |
| `/api/cabinet/session` | GET | Текущий пользователь (401 для анонима) |
| `/api/cabinet/objects` | GET | Объекты текущего пользователя |
| `/api/articles/[slug]` | GET | Заголовок статьи для клиентских Breadcrumbs |
| `/api/telegram` | POST | Заявка с сайта → Telegram (с Turnstile-проверкой) |

## Динамические параметры

В App Router `params` и `searchParams` — **Promise**, их нужно `await`:

```tsx
// app/(cabinet)/cabinet/objects/[id]/events/page.tsx
type ObjectEventsPageProps = {
    params: Promise<{id: string}>;
    searchParams: Promise<{type?: string}>;
};
const [{id}, query] = await Promise.all([params, searchParams]);
```

`generateStaticParams()` задаёт список статических путей — так работают статьи: `app/(pages)/articles/[slug]/page.tsx` возвращает slugs всех опубликованных статей, и они пререндерятся при `npm run build`.

## Конфигурация маршрутов (URL-константы)

URL в разметке не хардкодятся — берутся из `config/routes/`:

- `main.routes.ts` — публичные разделы (`routes.about`, `routes.articles`, ...);
- `services.routes.ts` — страницы услуг;
- `cabinet.routes.ts` — кабинет: объект `cabinet` (страницы + API) и фабрика `cabinetObjectRoute(objectId)` для URL конкретного объекта.

`config/navigation/menu.ts` собирает меню из этих констант (плавающее меню, футер, список услуг).

## Ранние скрипты и темы (корневой layout)

`app/layout.tsx` подключает через `next/script`:

1. `theme-init` (`strategy="beforeInteractive"`) — до гидратации выставляет `data-theme="light"` на `<html>`, если в `localStorage` сохранена светлая тема; устраняет мигание. Важно: скрипт рендерится именно через `next/script`, потому что сырой `<script>` внутри React-дерева не выполняется и вызывает предупреждение «Encountered a script tag…».
2. Turnstile API (`afterInteractive`) — для попапа консультации.
3. `dev-sw-zombie-cleanup` (только `NODE_ENV !== 'production'`) — см. [14-troubleshooting.md](./14-troubleshooting.md).
