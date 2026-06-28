import Image from 'next/image';
import Link from 'next/link';
import { licenseImg, certificateImg } from '@/app/_assets/images/documents';
import { Heading } from '@/components/heading';
import './documents.styles.scss';

const DocumentsPage = () => (
  <main className="documents">
    <div className="documents__glow documents__glow--left" />
    <div className="documents__glow documents__glow--right" />

    <div className="container">
      <section className="documents__hero">
        <Heading eyebrow={`ООО "КВАДРО-АРСЕНАЛ"`} mode="dark" as="h1">
          Лицензии, гарантии и документы
        </Heading>

        <p className="documents__description">
          Работаем официально, соблюдаем требования безопасности и предоставляем полный комплект
          документов по выполненным работам.
        </p>
      </section>

      <section className="documents__grid">
        <article className="documents-card">
          <div className="documents-card__image">
            <Image src={licenseImg} alt="Лицензия компании" fill />
          </div>
          <div className="documents-card__content">
            <span>Лицензии</span>
            <h2>Разрешение на выполнение работ</h2>
            <p>Монтаж, техническое обслуживание и ремонт систем безопасности объектов.</p>
            <Link href="#">Посмотреть документ →</Link>
          </div>
        </article>

        <article className="documents-card">
          <div className="documents-card__image">
            <Image src={certificateImg} alt="Сертификаты" fill />
          </div>
          <div className="documents-card__content">
            <span>Сертификаты</span>
            <h2>Подтверждение качества</h2>
            <p>Используем оборудование, соответствующее требованиям безопасности.</p>
            <Link href="#">Смотреть сертификаты →</Link>
          </div>
        </article>
      </section>

      <section className="documents__features">
        <article>
          <h3>Гарантия на работы</h3>
          <p>
            Передаём заказчику исполнительную документацию и обеспечиваем гарантийное сопровождение.
          </p>
        </article>

        <article>
          <h3>Техническое обслуживание</h3>
          <p>Проводим регулярные проверки, диагностику и восстановление систем.</p>
        </article>

        <article>
          <h3>Опыт инженеров</h3>
          <p>Специалисты работают с объектами различного назначения.</p>
        </article>
      </section>

      <section className="documents__cta">
        <div>
          <Heading eyebrow="КОНСУЛЬТАЦИЯ" mode="dark" as="h2">
            Нужны документы для объекта?
          </Heading>

          <p>Подготовим необходимый пакет документов и ответим на вопросы.</p>
        </div>
        <a href="tel:+74951234567" className="documents__button">
          Связаться с нами
        </a>
      </section>
    </div>
  </main>
);

export default DocumentsPage;
