import {Metadata} from 'next';
import {inter} from '@/app/_assets/fonts';
import {FloatingMenu} from '@/widgets/floating-menu';
import {ConsultationProvider} from '@/providers/consultation-provider';
import '@/styles/global.scss';

export const metadata: Metadata = {
    title: {
        template: '%s | Квадро-Арсенал',
        default: 'Квадро-Арсенал',
    },
    description: 'Проектно-монтажная организация в городе Электросталь',
};

export default function LandingLayout({children}) {
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

    return (
        <html lang="ru" className={inter.className} suppressHydrationWarning>
        <body>
        {/* Ранняя инициализация темы до первой отрисовки: снимает мигание
            «тёмная → светлая» при перезагрузке. Главная страница '/'
            не тематизируется, поэтому для неё атрибут не выставляется. */}
        <script
            dangerouslySetInnerHTML={{
                __html: "(function(){try{if(localStorage.getItem('theme')==='light'&&location.pathname!=='/'){document.documentElement.setAttribute('data-theme','light')}}catch(e){}})()",
            }}
        />
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer/>
        <ConsultationProvider turnstileSiteKey={turnstileSiteKey}>
            {children}
            <FloatingMenu/>
        </ConsultationProvider>
        </body>
        </html>
    );
}
