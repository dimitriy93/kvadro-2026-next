# 11. Личный кабинет: данные и разграничение доступа

## Слой данных

Весь код данных кабинета — в `lib/account/` (серверная сторона):

| Файл | Ответственность |
|---|---|
| `contracts.ts` | Типы: `DemoMonitorObject`, `DemoObjectZone` (дискриминированное объединение security/fire), `DemoObjectEvent`, `PublicAccountUser`, union-типы состояний |
| `demo-data.ts` | Демо-пользователи (с паролями!), объекты, зоны; **все функции полномочий**; проверка пароля |
| `demo-events.ts` | Демо-журнал событий + валидация фильтра (`isDemoEventType`) |
| `session.ts` | Аутентификация (см. [10-cabinet-authentication.md](./10-cabinet-authentication.md)) |
| `index.ts` | Barrel — все потребители импортируют только `@/lib/account` (точка подмены источника при интеграции GEORITM) |

## Аутентификация vs авторизация

- **Аутентификация** («кто ты»): `getSessionUser()` — единая точка, вызывается страницами и API.
- **Авторизация** («что тебе можно»): серверные функции `demo-data.ts`:
  - `getDemoObjectsForUser(userId)` — список только разрешённых объектов (строки 140–147);
  - `findDemoObjectForUser(userId, objectId)` — объект только если он в `user.objectIds` (строки 154–161); чужой и несуществующий **неотличимы** — оба возвращают `null`.

Список полномочий (`objectIds`) хранится **только на сервере** в записи пользователя. Клиентский список полномочий API не принимает (`app/api/cabinet/objects/route.ts` — запрос без тела, пользователь берётся из сессии).

## Как проверяется доступ к объекту (проверено фактически)

1. Страница `objects/[id]` (и events, map) — приватная `loadOwnedObject()`:
   ```ts
   const user = await getSessionUser();          // аноним → redirect на login
   return findDemoObjectForUser(user.id, objectId); // чужой/несуществующий → null
   ```
2. `null` → `notFound()` → кабинетная 404 (`app/(cabinet)/cabinet/not-found.tsx`), **одинаковая** для чужого и несуществующего объекта — наличие чужих данных не раскрывается. Даже `generateMetadata` проходит через `loadOwnedObject`, поэтому название чужого объекта не утекает в `<title>`.
3. API `GET /api/cabinet/objects` фильтрует список через `getDemoObjectsForUser`.

Результаты фактической проверки: свой объект → 200; чужой (`demo-object-sklad-zapadnyy` под учёткой belochka) → 404; несуществующий → 404; API без cookie → 401.

**Важное соглашение:** `getDemoZonesForObject(objectId)` и `getDemoEventsForObject(objectId)` сами **не** проверяют принадлежность — они вызываются только после `findDemoObjectForUser` (задокументировано в докстрингах). При добавлении новых мест использования — сначала проверка владения, потом данные. Не полагайтесь на скрытие элементов UI: любая проверка прав должна быть на сервере.

## Типовые задачи

### Добавить новый раздел кабинета (страницу)

1. Если раздел объектный — создайте `app/(cabinet)/cabinet/objects/[id]/<раздел>/page.tsx` по образцу `map/page.tsx`: `loadOwnedObject` → `notFound()` при null → рендер view-компонента из `ui/`.
2. Добавьте вкладку в `TABS` (`app/(cabinet)/cabinet/objects/[id]/ui/object-page-header.ui.tsx`) и маршрут в `cabinetObjectRoute` (`config/routes/cabinet.routes.ts`).
3. Нес объектный (уровень кабинета) — положите `page.tsx` в `app/(cabinet)/cabinet/<раздел>/`; guard из layout защитит автоматически, но проверку данных уровня объекта всё равно выполняйте серверно.

### Добавить новый API-метод кабинета

1. `app/api/cabinet/<имя>/route.ts`, `export const runtime = 'nodejs'`.
2. Первым делом `getSessionUser()`; аноним → `401` (образец — `objects/route.ts`).
3. Данные — только через функции `lib/account` для этого пользователя; никогда не принимайте список полномочий из запроса.
4. Экспортируйте через barrel `lib/account/index.ts`, URL добавьте в `cabinet.routes.ts` → `cabinet.api`.

### Добавить поле в карточку объекта

1. Расширьте контракт (`lib/account/contracts.ts` — `DemoMonitorObject` или новый тип).
2. Заполните поле в демо-данных (`demo-data.ts`).
3. Если поле — новый статус: добавьте значения в `state-meta.ts` (подписи/тона) и SCSS-тон в `state-tones.scss`.
4. Отобразите в `object-state.ui.tsx` / `objects-overview.ui.tsx`.
5. При будущей интеграции GEORITM не забудьте маппинг в `GeoritmSource` (этап 4–5 плана).

### Как НЕ допустить утечки данных между пользователями

- Любая выдача данных — через `getSessionUser()` + функции `find*/get*ForUser`.
- Никогда не доверяйте клиенту: id объекта — параметр URL, а не «чье-то» поле из тела запроса.
- Демо-модули с паролями (`demo-data.ts`) — только серверный код; не импортировать в `'use client'`.
- Не логируйте содержимое сессионных токенов и пароли.
- Новый API без проверки сессии — не «мелочь», а дыра: правило «каждый route handler начинается с `getSessionUser()`».
