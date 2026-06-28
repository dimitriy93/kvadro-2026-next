import { Logo } from '@/components/logo';
import './header.styles.scss';
import Link from 'next/link';

export const Header = () => (
  <div className="header">
    <div className="header__container">
      <Link href="/">
        <Logo />
      </Link>
    </div>
  </div>
);
