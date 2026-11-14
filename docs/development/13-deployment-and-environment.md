# 13. Деплой и окружение

## Хостинг: Amvera

Проект деплоится на [Amvera](https://amvera.ru) — облако для Node-приложений. Конфигурация в репозитории — `amvera.yml`:

```yaml
meta:
  environment: nodejs
  toolchain:
    name: npm
    version: "20"
build:
  skip: false
  additionalCommands: npm run build
  artifacts:
    "*": /
run:
  command: npm run start
  persistenceMount: /data
  containerPort: 3000
```

Что это значит фактически:

1. **Сборка на стороне Amvera**: `npm install` (неявно) → `npm run build`. Если сборка падает (ошибки TS/типов маршрутов) — деплой не проходит.
2. **Запуск**: `npm run start` (production-сервер Next.js на порту 3000).
3. **Постоянный том**: `/data` — для файлов, которые должны переживать пересоздание контейнера. Используется серверным хранилищем сессий кабинета: `/data/account-sessions/sessions.json` (каталог и файл создаются с правами 0700/0600). Хранилище рассчитано на один экземпляр приложения.
4. **Reverse-proxy Amvera** терминирует HTTPS и передаёт `x-forwarded-proto` — на этот заголовок опирается `isSecureRequest()` в `lib/account/session.ts` для выставления `secure` у cookie.

## Переменные окружения (production)

Задаются в интерфейсе Amvera (Настройки проекта → Переменные окружения), **не в репозитории**. Необходимые:

| Переменная | Назначение | Обязательность |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | токен бота для заявок | нужна для форм/квиза |
| `TELEGRAM_CHAT_ID` | чат приёма заявок | нужна для форм/квиза |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | виджет Turnstile | нужна для форм/квиза |
| `TURNSTILE_SECRET_KEY` | серверная проверка Turnstile | нужна для форм/квиза |
| `ACCOUNT_SESSION_SECRET` | HMAC-секрет сессий кабинета | **обязательна для кабинета**: без неё токены не выпускаются и не проверяются (fail-closed) |
| `ACCOUNT_DATA_SOURCE` | переключатель demo/georitm | в production **обязательна** `georitm` |
| `GEORITM_BASE_URL` | адрес REST API GEORITM (с протоколом) | **обязательна при `ACCOUNT_DATA_SOURCE=georitm`**: без неё вход в кабинет отвечает ошибкой соединения |
| `ACCOUNT_SESSION_STORE_DIR` | переопределение каталога хранилища сессий | необязательна; по умолчанию `/data/account-sessions` в production |

Генерация секрета сессии, например:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Локальная среда vs production — сводка различий

| Аспект | Локально (`npm run dev`) | Amvera (production) |
|---|---|---|
| Секрет сессии | dev-fallback константа | только `ACCOUNT_SESSION_SECRET` из окружения |
| Демо-вход в кабинет | включён (`/cabinet/login` показывает тестовые учётные записи) | **отключён серверно** (`POST /api/cabinet/login` → 503); подсказки паролей в HTML не попадают |
| Скрипт очистки мёртвых SW | выполняется на localhost | исключён из сборки |
| Файлы `.env.local`, `dev.out`, `dev.err` | есть локально | отсутствуют (`.env.local` в `.gitignore`) |
| Поведение маршрутов | Turbopack dev, HMR | пререндеренные (`SSG`) и динамические маршруты из сборки |

## Процесс публикации

1. Локально: `npx tsc --noEmit` (нет ошибок типов) → `npm run build` (успешная сборка; список маршрутов в выводе —sanity check).
2. Коммит и пуш в подключённый к Amvera репозиторий (git push → Amvera пересобирает проект по `amvera.yml`).
3. Проверка после деплоя:
   - публичные страницы: `/`, `/services`, `/articles`, любая статья;
   - кабинет: `/cabinet` → редирект на `/cabinet/login`; демо-вход должен ответить 503 (признак, что production-отключение работает);
   - заявка с формы приходит в Telegram;
   - cookie кабинета имеет `Secure` (HTTPS).

## Логи и диагностика

- Логи приложения — в интерфейсе Amvera (журнал приложения). Приложение пишет `console.error` при сбоях API (например `API /api/cabinet/login ERROR:`).
- Типовые проблемы деплоя:
  - **сборка падает на типах маршрутов** — устаревший кэш; локально выполнить чистую сборку `rm -rf .next && npm run build` перед пушем;
  - **кабинет «не входит» в production** — не задана `ACCOUNT_SESSION_SECRET` (в логах: «Секрет сессии недоступен» / API отдаёт 503 или все сессии невалидны);
  - **заявки не доходят** — неверные/отсутствующие Telegram-переменные или ошибка Turnstile (`verifyTurnstile` пишет в консоль причину).

## Резервные правила

- Секреты не хранить в коде и не коммитить (`.env.local` в `.gitignore`).
- Не хранить Basic-учётные данные GEORITM в cookie — только серверное хранилище (см. [12-georitm-integration.md](./12-georitm-integration.md)).
