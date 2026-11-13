import {Metadata} from 'next';
import {getDemoLoginHints} from '@/lib/account';
import {AccountLoginPage} from './ui/login.ui';

export const metadata: Metadata = {
    title: 'Вход в личный кабинет',
    robots: {
        index: false,
        follow: false,
    },
};

/**
 * Страница входа не требует авторизации и живёт в отдельной route group
 * `app/(cabinet-login)/`, чтобы не наследовать guard защищённой зоны
 * `app/(cabinet)/cabinet/layout.tsx`.
 *
 * Подсказки с тестовыми учётными данными показываются только вне production:
 * в production-сборке страница статична и не содержит демо-паролей.
 */
export default function AccountLoginPageRoute() {
    const demoHints = process.env.NODE_ENV === 'production' ? [] : getDemoLoginHints();

    return <AccountLoginPage demoHints={demoHints}/>;
}
