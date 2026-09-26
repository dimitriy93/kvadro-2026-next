import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Breadcrumbs } from '@/components/breadcrumbs';
import './header.styles.scss';
import Link from 'next/link';

export const Header = () => (
  <header className="header">
    <div className="header__main">
      <div className="header__container">
        <Link href="/">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>
    </div>

    <div className="header__breadcrumbs">
      <Breadcrumbs />
    </div>
  </header>
);
