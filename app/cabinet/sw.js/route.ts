import {NextResponse} from 'next/server';

/**
 * Service Worker личного кабинета (E3.2).
 *
 * Раздаётся route handler'ом по пути `/cabinet/sw.js`. По спецификации Service
 * Worker максимальный scope скрипта равен каталогу его расположения —
 * `/cabinet/`; заголовок `Service-Worker-Allowed` намеренно НЕ выставляется,
 * чтобы расширение scope на весь сайт было технически невозможно. Публичный
 * сайт, `/api/**` и интеграция GEORITM остаются вне досягаемости SW.
 *
 * Стратегия кэширования — строгий allowlist (см. SW_SOURCE ниже):
 * кэшируются только same-origin GET-ответы из `/_next/static/`, которые
 * сервер пометил `Cache-Control: immutable` (Next.js отдаёт так только
 * production-чанки с content-hash в имени). HTML-навигации, RSC-ответы
 * (`?_rsc=`, заголовок `RSC`), `/_next/data/`, `/api/**`, manifest, сам
 * SW-скрипт и любые ответы GEORITM перехвату не подлежат: для них fetch
 * handler просто не вызывает `respondWith`, и запрос уходит в сеть.
 *
 * Обновление (требование безопасности E3.2): ни `skipWaiting()`, ни
 * `clients.claim()` не используются. Новая версия SW активируется только
 * после закрытия всех вкладок со старой версией; управление существующими
 * клиентами не перехватывается принудительно. Старые кэши НЕ удаляются:
 * после деплоя открытая вкладка может продолжать запрашивать чанки прошлых
 * версий Next.js, и агрессивная очистка сломала бы такую вкладку. Имя кэша
 * версионировано — ручной bump (vN) понадобится лишь при смене формата кэша.
 *
 * Offline fallback (E3.3): только для навигационных GET-запросов в пределах
 * scope `/cabinet/`. При сетевой ошибке отдаётся минимальная автономная
 * HTML-страница, сгенерированная на лету в SW (никогда не берётся из кэша и
 * не содержит персональных данных). Успешный сетевой ответ проходит без
 * изменений; API, RSC и запросы вне `/cabinet/` offline-страницей не
 * подменяются — кабинет остаётся сетевым приложением.
 *
 * Отдаётся с `Cache-Control: no-store`: браузер проверяет обновление
 * SW-скрипта по сети при каждом визите, кэширование здесь только замедлило
 * бы распространение новой версии.
 */

/**
 * Автономная offline-страница (E3.3). Генерируется SW на лету при сетевой
 * ошибке навигации в `/cabinet/`. Содержит только статический текст и
 * действия пользователя — никаких персональных данных, сведений об объектах,
 * событиях или пользователях. Тёмная тема — фирменный фон кабинета
 * `#0b0b0b` (styles/_theme.scss). `noindex` — страница служебная.
 */
const OFFLINE_PAGE_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Нет соединения — Кабинет Квадро-Арсенал</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0b;color:#f5f5f5;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px;text-align:center}
.offline{max-width:440px}
.offline__eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
.offline__title{font-size:26px;margin:12px 0}
.offline__text{line-height:1.5;opacity:.8;margin-bottom:24px}
.offline__retry{display:inline-block;padding:10px 24px;border:0;border-radius:8px;background:#f5f5f5;color:#0b0b0b;font-size:15px;font-weight:600;cursor:pointer}
.offline__retry:hover{opacity:.9}
.offline__home{display:inline-block;margin-top:16px;color:#f5f5f5;opacity:.7;text-decoration:underline}
.offline__home:hover{opacity:1}
</style>
</head>
<body>
<main class="offline">
<p class="offline__eyebrow">Кабинет Квадро-Арсенал</p>
<h1 class="offline__title">Нет соединения</h1>
<p class="offline__text">Личный кабинет работает только при наличии сети. Проверьте подключение к интернету и повторите загрузку.</p>
<button type="button" class="offline__retry" onclick="location.reload()">Повторить загрузку</button>
<br>
<a class="offline__home" href="/">Перейти на главную страницу сайта</a>
</main>
</body>
</html>`;

const SERVICE_WORKER_BODY = [
    "const CACHE_NAME = 'ka-cabinet-static-v1';",
    "const STATIC_PREFIX = '/_next/static/';",
    '',
    '// Установка без прекэша: список ресурсов не фиксируем заранее —',
    '// кэш наполняется строго валидированными ответами по мере загрузки.',
    "self.addEventListener('install', () => {});",
    '',
    '// Активация без очисток: старые версии кэша остаются для открытых',
    '// вкладок со старыми чанками (см. комментарий в шапке route handler).',
    "self.addEventListener('activate', () => {});",
    '',
    '/**',
    ' * Разрешено ли кэшировать этот сетевой ответ. Проверки выполняются',
    ' * в порядке «дёшево — дорого»; любая неудача означает «не кэшировать».',
    ' */',
    'const isCacheableResponse = (response) => {',
    '    if (response.status !== 200) {',
    '        return false;',
    '    }',
    '    // Только «прозрачные» same-origin ответы; CORS/opaque — мимо.',
    "    if (response.type !== 'basic') {",
    '        return false;',
    '    }',
    '    // Страховка от персональных ответов. Set-Cookie — forbidden',
    '    // response-header, браузер его и так не отдаёт, но проверка',
    '    // документирует намерение и сработает, если это изменится.',
    "    if (response.headers.has('Set-Cookie')) {",
    '        return false;',
    '    }',
    '    const cacheControl = response.headers.get(\'Cache-Control\') || \'\';',
    '    // Кэшируем исключительно неизменяемые ресурсы: без immutable — мимо.',
    "    if (cacheControl.indexOf('immutable') === -1) {",
    '        return false;',
    '    }',
    "    if (cacheControl.indexOf('no-store') !== -1 || cacheControl.indexOf('no-cache') !== -1) {",
    '        return false;',
    '    }',
    '    return true;',
    '};',
    '',
    '/**',
    ' * Cache-first с сетевым fallback для immutable-статики. Ошибка сети',
    ' * при пустом кэше пробрасывается как есть (для статики offline-страница',
    ' * не подставляется — без чанков она всё равно не соберётся).',
    ' */',
    'const cacheFirst = async (request) => {',
    '    const cache = await self.caches.open(CACHE_NAME);',
    '    const cached = await cache.match(request);',
    '    if (cached) {',
    '        return cached;',
    '    }',
    '',
    '    const response = await fetch(request);',
    '    if (isCacheableResponse(response)) {',
    '        cache.put(request, response.clone()).catch(() => {});',
    '    }',
    '    return response;',
    '};',
    '',
    '// Offline-страница E3.3 (см. шапку route handler): значение инъектируется',
    "// на сервере; плейсхолдер заменяется JSON-литералом строки.",
    "const OFFLINE_HTML = '__OFFLINE_HTML_JSON__';",
    '',
    '/**',
    ' * Навигация в `/cabinet/`: успешный сетевой ответ проходит без изменений,',
    ' * при сетевой ошибке — автономная страница без персональных данных.',
    ' * Ответ никогда не берётся из кэша и не кэшируется (no-store).',
    ' */',
    'const navigationWithOfflineFallback = async (request) => {',
    '    try {',
    '        return await fetch(request);',
    '    } catch (error) {',
    '        return new Response(OFFLINE_HTML, {',
    '            status: 200,',
    "            headers: {",
    "                'Content-Type': 'text/html; charset=utf-8',",
    "                'Cache-Control': 'no-store'",
    '            }',
    '        });',
    '    }',
    '};',
    '',
    "self.addEventListener('fetch', (event) => {",
    '    const request = event.request;',
    '',
    '    // Не-GET (POST/PUT/PATCH/DELETE) — всегда сеть.',
    "    if (request.method !== 'GET') {",
    '        return;',
    '    }',
    '',
    '    const url = new URL(request.url);',
    '',
    '    // Навигационные GET: перехватываем только в пределах scope кабинета.',
    '    // Публичный сайт (/, /services, …) SW не обрабатывает вовсе; API, RSC',
    '    // и прочие запросы offline-страницей не подменяются.',
    "    if (request.mode === 'navigate') {",
    "        if (url.origin === self.location.origin && url.pathname.startsWith('/cabinet/')) {",
    '            event.respondWith(navigationWithOfflineFallback(request));',
    '        }',
    '        return;',
    '    }',
    '',
    '    if (url.origin !== self.location.origin) {',
    '        return;',
    '    }',
    '',
    '    // Allowlist путей: только production-статика Next.js. Всё прочее —',
    '    // HTML, /_next/data/, /api/**, manifest, sw.js, GEORITM — отсекается',
    '    // уже этим условием и уходит в сеть без respondWith.',
    '    if (!url.pathname.startsWith(STATIC_PREFIX)) {',
    '        return;',
    '    }',
    '',
    '    // RSC-запросы (?_rsc=) и dev-чанки (?v=timestamp) идут с query:',
    '    // такое кэшировать нельзя ни при каком пути. Заодно это исключает',
    '    // кэширование development-ресурсов (/_next/static/development/…).',
    '    if (url.search.length > 0) {',
    '        return;',
    '    }',
    "    if (url.pathname.indexOf('/development/') !== -1 || url.pathname.indexOf('.hot-update.') !== -1) {",
    '        return;',
    '    }',
    '',
    '    event.respondWith(cacheFirst(request));',
    '});',
].join('\n');

/**
 * Инъекция offline-страницы в исходник SW: плейсхолдер заменяется
 * JSON-литералом строки (JSON.stringify даёт корректный строковый литерал
 * JavaScript). Вычисляется лениво при первом GET — обе константы к этому
 * моменту инициализированы.
 */
const SERVICE_WORKER_SOURCE = SERVICE_WORKER_BODY.replace(
    "'__OFFLINE_HTML_JSON__'",
    JSON.stringify(OFFLINE_PAGE_HTML),
);

/**
 * GET `/cabinet/sw.js` — исходник Service Worker'а.
 *
 * Заголовки: `application/javascript; charset=utf-8` и `no-store`.
 * `Service-Worker-Allowed` не отдаётся намеренно — scope обязан остаться
 * в пределах `/cabinet/` (см. комментарий в шапке файла).
 */
export const GET = async (): Promise<NextResponse> =>
    new NextResponse(SERVICE_WORKER_SOURCE, {
        headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
