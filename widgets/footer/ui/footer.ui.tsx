import { Logo } from '@/components/logo';
import Link from 'next/link';
import { footerMenu, servicesMenu } from '@/config/navigation/menu';
import { contacts } from '@/config/brand/contacts';
import { routes } from '@/config/routes/main.routes';
import { account } from '@/config/routes/account.routes';
import './footer.styles.scss';

export const Footer = () => (
  <footer className="footer">
    <div className="container">
      <div className="footer__grid">
        <div className="footer__brand">
          <Link href={routes.home.href}>
            <Logo />
          </Link>
          <p className="footer__description">
            Проектирование, монтаж и обслуживание систем безопасности для бизнеса, предприятий и
            частных объектов.
          </p>
        </div>

        <nav className="footer__column">
          <span className="footer__title">Услуги</span>
          <ul className="footer__list">
            {servicesMenu.map((item) => (
              <li key={item.title}>
                <Link href={item.href} className="link">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="footer__column">
          <div className="footer__row">
            <span className="footer__title">Меню</span>
            <ul className="footer__list">
              {footerMenu.map((item) => (
                <li key={item.title}>
                  <Link href={item.href} className="link">
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer__row">
            <span className="footer__title">Для клиентов</span>
            <Link href={account.href} className="link">
              {account.title}
            </Link>
          </div>
        </nav>

        <div className="footer__column">
          <span className="footer__title">Контакты</span>

          <address className="footer__contacts">
            <Link href={contacts.phoneLink} className="footer__phone">
              {contacts.phone}
            </Link>
            <Link href={contacts.emailLink} className="footer__phone">
              {contacts.email}
            </Link>
            <span className="footer__address">{contacts.address}</span>
          </address>
        </div>
      </div>

      <div className="footer__bottom">
        <span>© 2026 Квадро-Арсенал</span>
        <Link href={routes.privacy.href}>{routes.privacy.title}</Link>
      </div>
    </div>
  </footer>
);
