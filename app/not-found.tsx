import Image from 'next/image';
import Link from 'next/link';
import { routes } from '@/config/routes/main.routes';
import { Metadata } from 'next';
import notFoundImage from '@/app/_assets/images/not_found.webp';
import { CopyrightBar } from '@/components/copyright-bar';
import { Button } from '@/components/button';
import { Header } from '@/widgets/header';
import '@/styles/not-found.scss';

export const metadata: Metadata = {
  title: 'Страница не найдена',
};

export const NotFound = () => (
  <div className="not-found">
    <Header />
    <div className="not-found__content">
      <div className="not-found__visual">
        <Image src={notFoundImage} alt="Чертеж 404" className="not-found__image" priority />
      </div>
      <div className="not-found__info">
        <h1 className="not-found__title">Объект не найден</h1>
        <p className="not-found__desc">
          Похоже, в проектной документации произошла ошибка. Страница, которую вы ищете, отсутствует
          на данном участке.
        </p>
        <Link href={routes.home.href}>
          <Button mode="secondary">На главную</Button>
        </Link>
      </div>
    </div>
    <CopyrightBar />
  </div>
);

export default NotFound;
