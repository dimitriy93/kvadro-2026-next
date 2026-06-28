'use client';
import { createContext, ReactNode, useContext, useState } from 'react';
import { ConsultationPopup } from '@/components/consultation-popup';

interface ConsultationContext {
  openConsultation: () => void;
  closeConsultation: () => void;
}

const ConsultationContext = createContext<ConsultationContext | null>(null);

export const ConsultationProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openConsultation = () => {
    setIsOpen(true);
  };

  const closeConsultation = () => {
    setIsOpen(false);
  };

  return (
    <ConsultationContext.Provider value={{ openConsultation, closeConsultation }}>
      {children}

      <ConsultationPopup isOpen={isOpen} onClose={closeConsultation} />
    </ConsultationContext.Provider>
  );
};

export const useConsultation = () => {
  const context = useContext(ConsultationContext);

  if (!context) {
    throw new Error('useConsultation must be used inside ConsultationProvider');
  }

  return context;
};
