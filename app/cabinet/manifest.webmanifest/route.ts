import {NextResponse} from 'next/server';

/**
 * Web app manifest личного кабинета (E3.1).
 *
 * Отдаётся route handler'ом, а не конвенцией `app/manifest.ts`: корневая
 * конвенция разместила бы manifest на уровне всего сайта и добавила бы
 * `<link rel="manifest">` на публичные страницы. Route handler по пути
 * `/cabinet/manifest.webmanifest` в сочетании с `metadata.manifest` в
 * layout'ах кабинета ограничивает PWA сегментом `/cabinet/`.
 *
 * Scope и start_url заданы явно (префикс `/cabinet/`) — по спецификации
 * manifest они не выводятся из расположения manifest-файла. Service worker
 * подключается отдельным route handler'ом `/cabinet/sw.js` (см. соседний
 * `app/cabinet/sw.js/route.ts`); поле `serviceworker` в manifest не указывается:
 * регистрация выполняется клиентским компонентом с явным scope.
 *
 * Иконки — `public/cabinet/icons/`: фирменная монограмма «KA» (белая плашка
 * с вырезанным знаком, `app/_assets/images/logo.png`) на фоне тёмной темы
 * кабинета `#0b0b0b` (styles/_theme.scss). Maskable-вариант уменьшен до
 * 280px внутри 512-канваса — знак целиком попадает в безопасную зону
 * (круг радиусом 40% размера иконки) при любой маске лаунчера.
 */

const MANIFEST = {
    name: 'Кабинет Квадро-Арсенал',
    short_name: 'Кабинет Квадро-Арсенал',
    id: '/cabinet/',
    start_url: '/cabinet/',
    scope: '/cabinet/',
    display: 'standalone',
    lang: 'ru',
    // Тёмная тема кабинета — значение по умолчанию (styles/_theme.scss :root);
    // светлая тема остаётся переключаемой внутри приложения.
    background_color: '#0b0b0b',
    theme_color: '#0b0b0b',
    icons: [
        {src: '/cabinet/icons/icon-192.png', sizes: '192x192', type: 'image/png'},
        {src: '/cabinet/icons/icon-512.png', sizes: '512x512', type: 'image/png'},
        {
            src: '/cabinet/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
        },
    ],
} as const;

/**
 * `no-store`: manifest читается браузером при установке и проверках
 * обновления; кэширование на этом пути не нужно и задерживало бы
 * изменения иконок/параметров до истечения кэша.
 */
export const GET = async (): Promise<NextResponse> =>
    NextResponse.json(MANIFEST, {
        headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
