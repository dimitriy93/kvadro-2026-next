import {Metadata} from "next";
import {ConsultationProvider} from '@/providers/consultation-provider';
import {Footer} from '@/widgets/footer';
import {Header} from '@/widgets/header';
import '@/styles/pages.scss';

export const metadata: Metadata = {
    metadataBase: new URL('https://квадро-арсенал.рф'),
    title: {
        default: 'Квадро-Арсенал',
        template: '%s | Квадро-Арсенал',
    },
    description: 'Проектирование, монтаж и обслуживание инженерных систем безопасности.',
};

export default function LandingLayout({children}) {
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

    return (
        <ConsultationProvider turnstileSiteKey={turnstileSiteKey}>
            <Header/>
            {children}
            <Footer/>
        </ConsultationProvider>
    );
}
