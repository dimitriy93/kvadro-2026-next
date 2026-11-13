import {ReactNode} from 'react';
import {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {getSessionUser} from '@/lib/account';
import {cabinet} from '@/config/routes/cabinet.routes';
import {AccountShell} from './ui/account-shell.ui';

export const metadata: Metadata = {
    title: cabinet.title,
    robots: {
        index: false,
        follow: false,
    },
};

/**
 * Защищённая зона личного кабинета. Серверная проверка сессии выполняется
 * здесь для всех дочерних страниц; аноним перенаправляется на вход.
 */
export default async function AccountLayout({children}: { children: ReactNode }) {
    const user = await getSessionUser();

    if (!user) {
        redirect(cabinet.login.href);
    }

    return <AccountShell userName={user.displayName}>{children}</AccountShell>;
}
