# 07. Компоненты и стили

## Где создавать компоненты

| Тип компонента | Куда класть | Примеры |
|---|---|---|
| Переиспользуемый UI-элемент (кнопка, бейдж, попап) | `components/<имя>/` | `components/button/`, `components/object-state-badge` не существует — кабинетные примитивы в `app/(cabinet)/cabinet/ui/` |
| Крупный блок лендинга | `widgets/<имя>/` | `widgets/hero/`, `widgets/quiz/`, `widgets/footer/` |
| Локальный компонент одной страницы | `ui/` внутри каталога страницы | `app/(cabinet)/cabinet/objects/[id]/ui/object-state.ui.tsx` |

Структура каталога компонента (типовой шаблон):

```text
components/button/
├── index.ts                    # barrel: export { Button } from './ui/button.ui';
└── ui/
    ├── button.ui.tsx           # сам компонент
    └── button.styles.scss      # стили компонента (импортируются из .ui.tsx)
```

Именование: `PascalCase.ui.tsx`, props-интерфейс `I<ComponentName>Props`, классы по БЭМ (`btn btn-primary`, `acc-header__nav-link`).

## Server vs Client

- По умолчанию компонент серверный. `'use client'` добавлять только когда нужны: состояние (`useState`), события (`onClick`), браузерные API (`localStorage`, `navigator`), хуки эффектов.
- Клиентские компоненты проекта: `login.ui.tsx`, `logout-button.ui.tsx`, `theme-toggle`, `popup`, `turnstile`, `quiz`, `floating-menu`, `breadcrumbs`, `article-navigation` и др.
- Серверные страницы передают данные вниз через **props**: например `app/(cabinet)/cabinet/page.tsx` читает объекты на сервере и рендерит `<ObjectsOverview userName objects/>`.

## SCSS-архитектура

### Глобальные стили (`styles/`)

| Файл | Содержание |
|---|---|
| `global.scss` | Точка входа: `@use reset/vars/theme`; утилиты `.container`, `.link`, `.promo-eyebrow` |
| `_reset.scss` | CSS-reset |
| `_vars.scss` | Дизайн-токены и миксины: `fluid()`, `font-size()`, `width()`, `height()` — «резиновая» типографика 375→1440 px через `clamp()` |
| `_theme.scss` | Семантические токены темы (см. ниже) |
| `landing.scss` | Стили лендинга `/` |
| `pages.scss`, `not-found.scss` | Стили внутренних страниц и 404 |

Через `next.config.ts` (`sassOptions.additionalData`) `_vars.scss` автоматически доступен в **любом** SCSS-файле — миксины можно использовать без импорта.

### Компонентные стили

SCSS-файл лежит рядом с компонентом и импортируется прямо из `.ui.tsx`:

```tsx
// app/(cabinet)/cabinet/ui/objects-overview.ui.tsx
import './objects-overview.styles.scss';
```

## Темы: светлая и тёмная

- Токены — в `styles/_theme.scss`: значения по умолчанию в `:root` — тёмная тема; `[data-theme='light']` переопределяет токены (фон, «чернила» `--ink-rgb`, поверхности).
- Атрибут `data-theme` выставляется на `<html>`:
  - **до гидратации** — инлайн-скриптом `theme-init` (`app/layout.tsx`, `strategy="beforeInteractive"`), читает `localStorage.theme`; из-за этого `<html>` имеет `suppressHydrationWarning` — это легитимное исключение, не маскировка ошибок в содержимом;
  - **переключение** — компонентом `components/theme-toggle/` (клиентский, пишет `localStorage` + атрибут).
- **Главная страница `/` не тематизируется**: скрипт не выставляет атрибут при `location.pathname === '/'`, и виджеты лендинга используют собственные литералы (комментарий в `_theme.scss`).
- Акцентные цвета (`#ff5a00`, золото) в обеих темах одинаковые.

## Адаптивность

- «Резиновые» размеры — через миксины `_vars.scss` (`@include font-size(12, 16)` и т. п.) — линейная интерполяция 375–1440 px.
- Мобильные ветки — `useIsMobile(breakpoint)` (`hooks/use-is-mobile/`, обёртка над `usehooks-ts` с SSR-безопасным `mounted`-флагом) и медиазапросы в SCSS.
- Scroll-эффекты — `hooks/use-scroll-motion/`, `hooks/use-scroll-progress/` (см. корневой `README.md` до реорганизации документации — подробности в коде хуков).

## Рекомендации: куда класть новую логику

- **Данные/запросы** — `lib/` (серверный слой), а не внутри компонентов.
- **URL-константы** — `config/routes/`, не хардкодить строки в разметке.
- **Общая UI-логика без JSX** — чистые TS-модули (пример: `app/(cabinet)/cabinet/ui/state-meta.ts` — словари подписей состояний, `lib/phone-mask.ts`).
- **Состояние попапа консультации** — провайдер `providers/consultation-provider.tsx` (React Context), а не глобальные переменные.
- Не импортировать серверные модули (`lib/account/demo-data.ts`, `lib/articles/loader.ts`) в клиентские компоненты.
