import type {Metadata} from 'next';

/**
 * PWA-метаданные личного кабинета (E3.1).
 *
 * Единый источник для защищённого layout'а (`app/(cabinet)/cabinet/layout.tsx`)
 * и страницы входа (`app/(cabinet-login)/cabinet/login/page.tsx`): вход живёт
 * в отдельной route group без guard'а кабинета, а именно туда попадает
 * анонимный пользователь — установка PWA предлагается на странице входа,
 * поэтому `<link rel="manifest">` и Apple-метаданные нужны и там.
 *
 * Изоляция публичного сайта: метаданные подключаются только в сегментах
 * `/cabinet/*`; metadata App Router наследуется сверху вниз и не поднимается
 * в соседние route groups, поэтому на публичных страницах (`/`, `/services`,
 * …) ссылок на manifest и Apple-тегов нет. Корневой `app/manifest.ts` не
 * создаётся намеренно — он разметил бы PWA на весь сайт.
 *
 * iOS: `appleWebApp` даёт Safari параметры standalone-режима при
 * «Добавить на экран „Домой"»; `apple-touch-icon` — иконка на домашнем
 * экране (Safari не читает `icons` из manifest). Кнопку установки не
 * имитируем — на iOS установка выполняется пользователем через меню «Поделиться».
 */
export const cabinetPwaMetadata: Pick<Metadata, 'manifest' | 'appleWebApp' | 'icons'> = {
    manifest: '/cabinet/manifest.webmanifest',
    appleWebApp: {
        capable: true,
        // Статусная строка прозрачна поверх контента — соответствует тёмной
        // теме кабинета (значение по умолчанию).
        statusBarStyle: 'black-translucent',
        title: 'Кабинет Квадро-Арсенал',
    },
    icons: {
        // Явно повторяем корневой фавикон (файловая конвенция app/icon.png):
        // собственное поле icons в metadata сегмента кабинета подавляет
        // унаследованные ссылки, без него вкладка браузера теряет favicon.
        icon: {url: '/icon.png', sizes: '150x150', type: 'image/png'},
        apple: '/cabinet/icons/apple-touch-icon.png',
    },
};
