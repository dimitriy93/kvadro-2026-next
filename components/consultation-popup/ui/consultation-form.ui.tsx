'use client';
import { FormEvent, useState } from 'react';
import { services } from '@/config/routes/services.routes';

interface IConsultationFormProps {
  onSuccess?: () => void;
}

export const ConsultationForm = ({ onSuccess }: IConsultationFormProps) => {
  const [loading, setLoading] = useState(false);
  const [service, setService] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const servicesTitles: string[] = [
    ...Object.values(services).map((service) => service.title),
    'Другое',
  ];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
    }, 800);
  };

  return (
    <form className="consultation-form" onSubmit={submit}>
      <label>
        <span>Имя *</span>
        <input required placeholder="Ваше имя" />
      </label>

      <label>
        <span>Телефон *</span>
        <input required type="tel" placeholder="+7 (___) ___-__-__" />
      </label>

      <label>
        <span>Направление</span>

        <div className="service-select">
          <button
            type="button"
            className="service-select__button"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <span>{service || 'Выберите услугу'}</span>
            <i className={isOpen ? 'active' : ''} />
          </button>

          {isOpen && (
            <ul className="service-select__list">
              {servicesTitles.map((service) => (
                <li
                  key={service}
                  onClick={() => {
                    setService(service);
                  }}
                >
                  {service}
                </li>
              ))}
            </ul>
          )}

          <input type="hidden" name="service" value={service} />
        </div>
      </label>

      <label>
        <span>Сообщение</span>
        <textarea placeholder="Расскажите об объекте" />
      </label>

      <button disabled={loading}>{loading ? 'Отправляем...' : 'Отправить заявку'}</button>

      <small>Нажимая кнопку, вы соглашаетесь с обработкой персональных данных</small>
    </form>
  );
};
