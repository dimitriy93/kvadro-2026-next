import {ReactNode} from 'react';
import Link from 'next/link';
import {Logo} from '@/components/logo';
import {ThemeToggle} from '@/components/theme-toggle';
import {cabinet} from '@/config/routes/cabinet.routes';
import {LogoutButton} from './logout-button.ui';
import './account-shell.styles.scss';

interface IAccountShellProps {
    userName: string;
    children: ReactNode;
}

/**
 * Собственная навигационная оболочка кабинета: шапка с логотипом, ссылкой на
 * раздел объектов, именем пользователя и выходом. Публичные Header/Footer
 * намеренно не используются.
 */
export const AccountShell = ({userName, children}: IAccountShellProps) => (
    <div className="acc">
        <div className="acc__glow" aria-hidden="true"/>

        <header className="acc-header">
            <div className="acc-header__inner container">
                <div className="acc-header__left">
                    <Link href="/" aria-label="Перейти на основной сайт" className="acc-header__logo">
                        <Logo/>
                    </Link>

                    <nav className="acc-header__nav" aria-label="Разделы личного кабинета">
                        <Link href={cabinet.href} className="acc-header__nav-link">
                            Объекты
                        </Link>
                    </nav>
                </div>

                <div className="acc-header__right">
                    <ThemeToggle/>
                    <span className="acc-header__user" title={userName}>{userName}</span>
                    <LogoutButton/>
                </div>
            </div>
        </header>

        <main className="acc-main container">
            {children}
        </main>

        <footer className="acc-footer">
            <div className="container acc-footer__inner">
                <span>ООО «Квадро-Арсенал» · Личный кабинет клиента</span>
            </div>
        </footer>
    </div>
);
