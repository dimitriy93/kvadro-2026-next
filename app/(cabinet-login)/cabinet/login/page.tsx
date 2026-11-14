import {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {cabinet} from '@/config/routes/cabinet.routes';
import {getAccountDataSource, getDemoLoginHints, getSessionUser} from '@/lib/account';
import {cabinetPwaMetadata} from '@/config/pwa';
import {ServiceWorkerRegistrar} from '@/components/service-worker-registrar';
import {AccountLoginPage} from './ui/login.ui';

export const metadata: Metadata = {
    title: 'Вход в личный кабинет',
    robots: {
        index: false,
        follow: false,
    },
    // Страница входа — точка входа анонима и первое место, где браузер
    // предлагает установку PWA: метаданные нужны и здесь, несмотря на
    // отдельную route group (см. config/pwa.ts).
    ...cabinetPwaMetadata,
};

/**
 * Страница входа не требует авторизации и живёт в отдельной route group
 * `app/(cabinet-login)/`, чтобы не наследовать guard защищённой зоны
 * `app/(cabinet)/cabinet/layout.tsx`.
 *
 * Подсказки с тестовыми учётными данными показываются только вне production
 * и только в demo-режиме источника данных: в production-сборке и в режиме
 * georitm страница статична и не содержит демо-паролей.
 *
 * Обратная проверка (E7.3.1): пользователь с действительной сессией не видит
 * форму входа — перенаправляется в кабинет. Проверка использует тот же
 * серверный механизм getSessionUser(): запись берётся из локального
 * хранилища сессий, лишнего обращения к GEORITM при этом нет.
 */
export default async function AccountLoginPageRoute() {
    const user = await getSessionUser();

    if (user) {
        redirect(cabinet.href);
    }

    const demoHints =
        process.env.NODE_ENV === 'production' || getAccountDataSource() !== 'demo'
            ? []
            : getDemoLoginHints();

    return (
        <>
            {/* Регистрация SW доступна и анониму — страница входа тоже часть
                PWA кабинета; на публичных страницах компонент не подключён. */}
            <ServiceWorkerRegistrar/>
            <AccountLoginPage demoHints={demoHints}/>
        </>
    );
}
