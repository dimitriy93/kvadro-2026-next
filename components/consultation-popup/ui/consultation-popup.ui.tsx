'use client';
import { Popup } from '@/components/popup';
import { ConsultationForm } from '@/components/consultation-popup/ui/consultation-form.ui';
import './consultation-popup.styles.scss';

interface IConsultationPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConsultationPopup = ({ isOpen, onClose }: IConsultationPopupProps) => (
  <Popup isOpen={isOpen} onClose={onClose}>
    <div className="consultation-popup">
      <div className="consultation-popup__glow" />
      <div className="consultation-popup__header">
        <span>ООО «КВАДРО-АРСЕНАЛ»</span>
        <h2>Получить консультацию</h2>
        <p>Подберём решение под ваш объект</p>
      </div>
      <ConsultationForm onSuccess={onClose} />
    </div>
  </Popup>
);
