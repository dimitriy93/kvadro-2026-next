'use client';
import {useEffect} from 'react';

/**
 * Регистрация Service Worker'а кабинета (E3.2).
 *
 * Компонент ничего не рендерит и монтируется только в сегментах `/cabinet/*`
 * (защищённый layout и страница входа) — на публичных страницах регистрации
 * не происходит, там компонент не подключён.
 *
 * Ограничения:
 * - только production: в development SW не регистрируется вовсе (условие
 *   исключается на этапе компиляции), dev-«зомби»-очистка в app/layout.tsx
 *   при этом не встречает живых регистраций кабинета;
 * - одна регистрация на origin: перед register() проверяется существующая
 *   регистрация по scope `/cabinet/`; `register()` для той же пары
 *   scriptURL+scope и так идемпотентен, проверка страхует от повторов;
 * - scope `/cabinet/` задан явно и совпадает с расположением скрипта;
 * - ошибка регистрации глушится без логирования: она не должна блокировать
 *   отображение кабинета и не должна попадать в консоль (чувствительных
 *   данных в сообщениях ошибок быть не должно по определению).
 */

const SW_URL = '/cabinet/sw.js';
const SW_SCOPE = '/cabinet/';

export const ServiceWorkerRegistrar = () => {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') {
            return;
        }

        if (!('serviceWorker' in navigator)) {
            return;
        }

        let cancelled = false;

        void navigator.serviceWorker
            .getRegistration(SW_SCOPE)
            .then((existing) => {
                if (cancelled || existing) {
                    return;
                }

                return navigator.serviceWorker.register(SW_URL, {scope: SW_SCOPE});
            })
            .catch(() => {
                // Тихо игнорируем: кабинет обязан работать и без SW.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return null;
};
