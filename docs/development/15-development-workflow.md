# 15. Рецепты типовых задач разработчика

Все пути — фактические, по текущей структуре репозитория.

## Изменить текст на главной странице

- Лендинг — клиентская композиция виджетов: `app/landing-content.tsx` подключает `widgets/hero`, `widgets/stats`, `widgets/clients`, `widgets/quiz`, `widgets/cta`, `widgets/footer`.
- Тексты конкретных виджетов — внутри их `ui/*.ui.tsx` (например `widgets/hero/ui/hero.ui.tsx`).
- SEO-заголовок вкладки — `app/layout.tsx` (`metadata.title.template`) и `app/page.tsx`.
- После правки: `npm run dev` → проверить `/`.

## Изменить пункт меню (навигацию)

1. URL-константы — `config/routes/main.routes.ts` (публичные) или `services.routes.ts` (услуги).
2. Состав меню — `config/navigation/menu.ts` (`floatingMenu`, `footerMenu`, `servicesMenu`).
3. Контакты в меню/футере — `config/brand/contacts.ts`.
4. Кабинетное меню — внутри `app/(cabinet)/cabinet/ui/account-shell.ui.tsx`, ссылка «Личный кабинет» в футере сайта — `widgets/footer/ui/footer.ui.tsx` (использует `cabinet` из `config/routes/cabinet.routes.ts`).

## Добавить новую страницу

1. Публичную — `app/(pages)/<имя>/page.tsx` (+ `ui/`, при необходимости свой `layout.tsx`). Она автоматически получает общий layout публичной части.
2. Объявить URL-константу в `config/routes/main.routes.ts` и ссылку в `config/navigation/menu.ts`, если пункт нужен в меню.
3. Метаданные — `export const metadata` в `page.tsx` (title попадает в шаблон `%s | Квадро-Арсенал`).
4. Проверить сборку: `npm run build` — маршрут появится в списке.

## Добавить новый компонент

1. Переиспользуемый — `components/<имя>/index.ts` + `ui/<имя>.ui.tsx` + `ui/<имя>.styles.scss` (шаблон — `components/button/`).
2. Блок лендинга — `widgets/<имя>/`, подключить в `app/landing-content.tsx`.
3. `'use client'` — только при необходимости (state/handlers/браузерные API).
4. Именование: `PascalCase.ui.tsx`, props `I<Name>Props`, БЭМ-классы.

## Изменить стили

- Глобальные токены/миксины — `styles/_vars.scss`, `_theme.scss` (темы), `global.scss` (утилиты).
- Компонентные — SCSS рядом с компонентом; `_vars` доступны везде автоматически (`next.config.ts`).
- Тема: убедиться, что используется семантический токен (`--ink-rgb`, `--bg-panel`...), а не литерал, иначе сломается светлая тема. Главная страница `/` тем не тематизируется (осознанное ограничение — см. `_theme.scss`).

## Изменить SEO-метаданные

- Общие: `app/layout.tsx` (`metadata`).
- Страница: `export const metadata` или `generateMetadata` в её `page.tsx` (примеры — `app/(pages)/articles/page.tsx`, страницы кабинета).
- Статьи: метаданные генерируются из `content/articles/<slug>/meta.ts` — править там.

## Добавить статью

Полная инструкция — [08-content-and-articles.md](./08-content-and-articles.md). Кратко: создать `content/articles/<slug>/` с `meta.ts`, `article.md`, `cover.webp`; проверка на `/articles` и `/articles/<slug>`; `status: 'published'`.

## Изменить страницу кабинета

- UI — `app/(cabinet)/cabinet/...` + компоненты в `ui/` рядом.
- Данные — `lib/account/` (см. [11-cabinet-data-and-access.md](./11-cabinet-data-and-access.md)).
- URL — `config/routes/cabinet.routes.ts`.

## Добавить поле в карточку объекта кабинета

1. Тип — `lib/account/contracts.ts`.
2. Демо-значение — `lib/account/demo-data.ts`.
3. Статусные словари — `app/(cabinet)/cabinet/ui/state-meta.ts` (+ тон в `state-tones.scss`).
4. Разметка — `object-state.ui.tsx` / `objects-overview.ui.tsx`.
5. При интеграции GEORITM — не забыть маппинг в источнике (см. [12-georitm-integration.md](./12-georitm-integration.md)).

## Добавить новый API endpoint

- Публичный/сервисный: `app/api/<имя>/route.ts`; при работе с ФС/крипто — `export const runtime = 'nodejs'`.
- API кабинета: `app/api/cabinet/<имя>/route.ts`, первым действием `getSessionUser()` → 401; URL в `cabinet.routes.ts` (подробности и правила безопасности — [11-cabinet-data-and-access.md](./11-cabinet-data-and-access.md)).

## Изменить логику авторизации

- Токен/cookie/секрет — `lib/account/session.ts` (формат `v1.<payload>.<hmac>`, TTL 8 ч, параметры cookie).
- Проверка пароля — `lib/account/demo-data.ts` (`verifyDemoCredentials`).
- Отключение демо-входа в prod — `isDemoLoginEnabled()`.
- Ограничения текущей модели и целевая схема (серверное хранилище сессий) — [10-cabinet-authentication.md](./10-cabinet-authentication.md) и [12-georitm-integration.md](./12-georitm-integration.md). Не менять модель без обоснования: см. ограничения в корневой инструкции задачи.

## Проверить сборку перед публикацией

```bash
npx tsc --noEmit      # типы
npm run build         # сборка; в конце — список маршрутов
npm run start         # локальный прогон production-сборки (порт 3000)
```

Проверить в production-сборке: публичные страницы; `/cabinet` → редирект на login; `POST /api/cabinet/login` → 503 (демо-вход отключён); заявка в Telegram.

## Изменить старые URL / добавить редирект

- Все старые маршруты кабинета — `proxy.ts` (matcher `/account`, `/account/:path*`). При добавлении новых переименований — расширить функцию `proxy()` там же; query переносится через `request.nextUrl.clone()`.
