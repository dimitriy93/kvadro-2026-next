'use client';
import Link from 'next/link';
import Image from 'next/image';
import { mapImg } from '@/app/_assets/images/common';
import { contacts } from '@/config/brand/contacts';
import { routes } from '@/config/routes/main.routes';
import { Button } from '@/components/button';
import './cta.styles.scss';

export const CTA = ({ onOpenQuiz }) => (
  <section className="cta">
    <Link
      href={contacts.mapLink}
      target="_blank"
      rel="noopener noreferrer"
      className="cta__map"
      aria-label="Открыть адрес компании на Яндекс Картах"
    >
      <Image
        src={mapImg}
        alt="Расположение офиса Квадро-Арсенал"
        fill
        priority
        className="cta__map-image"
      />
      <div className="cta__map-overlay">
        <div className="cta__map-card">
          <span className="cta__map-icon">📍</span>
          <div className="cta__map-info">
            <span className="cta__map-label">Мы на Яндекс Картах</span>
            <span className="cta__map-text">Построить маршрут</span>
          </div>
          <span className="cta__map-arrow">→</span>
        </div>
      </div>
    </Link>

    <div className="cta__panel">
      <div className="container">
        <div className="cta__content">
          <span className="cta__eyebrow">Контакты</span>
          <h2 className="cta__title">Нужна система безопасности для объекта?</h2>
          <p className="cta__text">
            Подберем решение под задачи предприятия, офиса или частного объекта. Работаем по
            Электростали и Московской области.
          </p>

          <div className="cta__actions">
            <Button mode="primary" onClick={onOpenQuiz}>
              Получить расчет
            </Button>

            <Link href={routes.contacts.href}>
              <Button mode="secondary">Контакты</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  </section>
);
