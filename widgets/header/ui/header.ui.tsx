import { Logo } from '@/components/logo';
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
      </div>
    </div>

    <div className="header__breadcrumbs">
      <Breadcrumbs />
    </div>
  </header>
);
