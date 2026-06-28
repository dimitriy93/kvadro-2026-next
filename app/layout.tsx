import { Metadata } from 'next';
import { inter } from '@/app/_assets/fonts';
import { FloatingMenu } from '@/widgets/floating-menu';
import { ConsultationProvider } from '@/providers/consultation-provider';
import '@/styles/global.scss';

export const metadata: Metadata = {
  title: {
    template: '%s | Квадро-Арсенал',
    default: 'Квадро-Арсенал',
  },
  description: 'Проектно-монтажная организация в городе Электросталь',
};

export default function LandingLayout({ children }) {
  return (
    <html lang="ru" className={inter.className}>
      <body>
        <ConsultationProvider>
          {children}
          <FloatingMenu />
        </ConsultationProvider>
      </body>
    </html>
  );
}
