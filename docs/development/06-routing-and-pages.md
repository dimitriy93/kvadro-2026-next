# 06. Маршруты и страницы

## Полный список URL (фактический)

### Публичная часть

| URL | Тип | Файл |
|---|---|---|
| `/` | Лендинг | `app/page.tsx` |
| `/about` | О компании | `app/(pages)/about/page.tsx` |
| `/services` | Список услуг | `app/(pages)/services/page.tsx` |
| `/services/access-control` | СКУД | `app/(pages)/services/access-control/page.tsx` |
| `/services/fire-alarm` | Пожарная сигнализация | `app/(pages)/services/fire-alarm/page.tsx` |
| `/services/fire-alarm-design` | Проектирование пожарной сигнализации | `app/(pages)/services/fire-alarm-design/page.tsx` |
| `/services/intercom-maintenance` | Обслуживание домофонов | `app/(pages)/services/intercom-maintenance/page.tsx` |
| `/services/low-current-systems` | Слаботочные системы | `app/(pages)/services/low-current-systems/page.tsx` |
| `/services/security-alarm` | Охранная сигнализация | `app/(pages)/services/security-alarm/page.tsx` |
| `/services/video-surveillance` | Видеонаблюдение | `app/(pages)/services/video-surveillance/page.tsx` |
| `/articles` | Список статей | `app/(pages)/articles/page.tsx` |
| `/articles/<slug>` | Статья (SSG из `content/articles/`) | `app/(pages)/articles/[slug]/page.tsx` |
| `/articles/<slug>/cover.webp` | Обложка статьи (route handler) | `app/(pages)/articles/[slug]/cover.webp/route.ts` |
| `/articles/<slug>/images/<file>` | Изображения статьи (route handler) | `app/(pages)/articles/[slug]/images/[file]/route.ts` |
| `/documents` | Документы | `app/(pages)/documents/page.tsx` |
| `/contacts` | Контакты | `app/(pages)/contacts/page.tsx` |
| 404 (любой неизвестный путь) | «Объект не найден» | `app/not-found.tsx` |

### Личный кабинет

| URL | Тип | Файл | Доступ |
|---|---|---|---|
| `/cabinet` | Список объектов пользователя | `app/(cabinet)/cabinet/page.tsx` | сессия |
| `/cabinet/login` | Форма входа | `app/(cabinet-login)/cabinet/login/page.tsx` | публичная |
| `/cabinet/objects/[id]` | Карточка объекта: состояние + зоны | `app/(cabinet)/cabinet/objects/[id]/page.tsx` | сессия + владение объектом |
| `/cabinet/objects/[id]/events` | Журнал событий, фильтр `?type=` | `app/(cabinet)/cabinet/objects/[id]/events/page.tsx` | сессия + владение |
| `/cabinet/objects/[id]/map` | Карта (SVG-заглушка) | `app/(cabinet)/cabinet/objects/[id]/map/page.tsx` | сессия + владение |
| Кабинетная 404 | «Объект не найден» | `app/(cabinet)/cabinet/not-found.tsx` | внутри оболочки |

### API

| Endpoint | Метод | Файл |
|---|---|---|
| `/api/cabinet/login` | POST | `app/api/cabinet/login/route.ts` |
| `/api/cabinet/logout` | POST | `app/api/cabinet/logout/route.ts` |
| `/api/cabinet/session` | GET | `app/api/cabinet/session/route.ts` |
| `/api/cabinet/objects` | GET | `app/api/cabinet/objects/route.ts` |
| `/api/articles/[slug]` | GET | `app/api/articles/[slug]/route.ts` |
| `/api/telegram` | POST | `app/api/telegram/route.ts` |

## Редиректы `/account/*` → `/cabinet/*`

Кабинет ранее жил на `/account`; после миграции сохранена обратная совместимость — **постоянные 308-редиректы** в `proxy.ts` (корень проекта, конвенция Next 16 для middleware):

```text
/account                     → /cabinet
/account/login               → /cabinet/login
/account/objects/[id]        → /cabinet/objects/[id]
/account/objects/[id]/events → /cabinet/objects/[id]/events  (query ?type= сохраняется)
/account/objects/[id]/map    → /cabinet/objects/[id]/map
```

Особенности реализации (`proxy.ts`):

- 308 Permanent Redirect сохраняет метод и query-параметры;
- query переносится через `request.nextUrl.clone()` (у `new URL()` query не наследуется);
- matcher: `['/account', '/account/:path*']`;
- **API `/api/account/*` не редиректится** — endpoints переехали на `/api/cabinet/*`, внешних потребителей нет (осознанное решение, задокументировано в комментарии `proxy.ts`); старый API отвечает 404.

Циклов редиректов нет: `/account*` → `/cabinet*`, и ни один `/cabinet*` путь не мапится обратно на `/account`.

## Конфигурация маршрутов

`config/routes/cabinet.routes.ts`:

```ts
export const cabinet = {
  title: 'Личный кабинет',
  href: '/cabinet',
  login: { title: 'Вход в личный кабинет', href: '/cabinet/login' },
  api: {
    login: '/api/cabinet/login',
    logout: '/api/cabinet/logout',
    session: '/api/cabinet/session',
    objects: '/api/cabinet/objects',
  },
} as const;

export const cabinetObjectRoute = (objectId: string) => ({
  state: `/cabinet/objects/${objectId}`,
  events: `/cabinet/objects/${objectId}/events`,
  map: `/cabinet/objects/${objectId}/map`,
});
```

Все ссылки на кабинет (footer, логин-форма, кнопка выхода, вкладки объекта) импортируют эти константы — переименование URL достаточно выполнить в одном файле.

## Metadata и robots

- Кабинет: `robots: {index: false, follow: false}` в `app/(cabinet)/cabinet/layout.tsx` и на странице входа.
- Заголовки: шаблон `%s | Квадро-Арсенал` из корневого layout; страницы объектов подставляют название через `generateMetadata`.
- Статьи: `generateMetadata` из `meta.ts` — title/description/OG/og:image (см. [08-content-and-articles.md](./08-content-and-articles.md)).
- **sitemap.xml / robots.txt в проекте отсутствуют** (файлов нет) — при необходимости добавить `app/sitemap.ts` / `app/robots.ts`.
