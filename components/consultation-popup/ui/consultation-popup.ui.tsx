'use client';
import { useEffect, useState } from 'react';
import { Popup } from '@/components/popup';
import { ConsultationForm } from '@/components/consultation-popup/ui/consultation-form.ui';
import './consultation-popup.styles.scss';

interface IConsultationPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConsultationPopup = ({ isOpen, onClose }: IConsultationPopupProps) => {
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSuccess(false);
    }
  }, [isOpen]);

  return (
    <Popup isOpen={isOpen} onClose={onClose}>
      <div className="consultation-popup">
        <div className="consultation-popup__glow" />
        {success ? (
          <div className="consultation-success">
            <div className="consultation-success__icon">✓</div>
            <h3 className="consultation-success__title">Спасибо за заявку!</h3>
            <p className="consultation-success__text">
              Ваша заявка успешно отправлена.<br/>
              Наш специалист свяжется с Вами<br/>
              в ближайшее время.
            </p>
            <button
              type="button"
              className="consultation-success__button"
              onClick={onClose}
            >
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <div className="consultation-popup__header">
              <span>ООО «КВАДРО-АРСЕНАЛ»</span>
              <h2>Получить консультацию</h2>
              <p>Подберём решение под ваш объект</p>
            </div>
            <ConsultationForm onSuccess={() => setSuccess(true)} />
          </>
        )}
      </div>
    </Popup>
  );
};
