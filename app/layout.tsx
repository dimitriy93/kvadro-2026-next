import {Metadata} from 'next';
import Script from 'next/script';
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
            не тематизируется, поэтому для неё атрибут не выставляется.

            beforeInteractive: Next.js инжектирует скрипт в исходный HTML до
            гидратации, вне реактовского дерева — рендер <script> обычным
            JSX-элементом внутри React-компонента некорректен: при любом
            клиентском перерендере ветки React пересоздаёт такой элемент и
            предупреждает «Encountered a script tag…», а сам скрипт не
            выполняется. */}
        <Script
            id="theme-init"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
                __html: "(function(){try{if(localStorage.getItem('theme')==='light'&&location.pathname!=='/'){document.documentElement.setAttribute('data-theme','light')}}catch(e){}})()",
            }}
        />
        {/* API Cloudflare Turnstile: грузится после гидратации и дедуплицируется
            next/script; виджет рендерится компонентом Turnstile при открытии
            попапа консультации. */}
        <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
        />
        {/* Защита локальной разработки от «зомби»-service worker. Проект SW не
            использует, но браузер хранит регистрации по origin: SW от другого
            проекта, ранее запускавшегося на localhost:3000, продолжает
            перехватывать запросы (вплоть до срыва гидратации React), даже когда
            его скрипт уже не существует. Скрипт: (1) выполняется только в dev —
            ветка целиком исключается из production-сборки на этапе компиляции;
            (2) дополнительно проверяет hostname localhost/127.0.0.1; (3) сам по
            себе видит только регистрации СВОЕГО origin — чужие домены
            недостижимы по построению браузера; (4) удаляет регистрацию лишь
            тогда, когда её скрипт реально не загружается (404/ошибка сети), т.е.
            SW заведомо «мертв»; (5) не трогает CacheStorage и живые SW.

            afterInteractive: выполняется после гидратации и не создаёт
            расхождений сервер/клиент — условие рендера зависит только от
            NODE_ENV, который Next.js фиксирует на этапе сборки. */}
        {process.env.NODE_ENV !== 'production' && (
            <Script
                id="dev-sw-zombie-cleanup"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html:
                        "(function(){try{" +
                        "var host=location.hostname;" +
                        "if(host!=='localhost'&&host!=='127.0.0.1')return;" +
                        "if(!navigator.serviceWorker)return;" +
                        "navigator.serviceWorker.getRegistrations().then(function(regs){" +
                        "regs.forEach(function(reg){" +
                        "var sw=reg.active||reg.waiting||reg.installing;" +
                        "if(!sw||!sw.scriptURL)return;" +
                        "fetch(sw.scriptURL+(sw.scriptURL.indexOf('?')<0?'?__sw-health-check=1':'&__sw-health-check=1'),{cache:'no-store'})" +
                        ".then(function(resp){if(!resp.ok){reg.unregister();console.info('[dev] Удалена мёртвая регистрация Service Worker:',sw.scriptURL)}})" +
                        ".catch(function(){reg.unregister();console.info('[dev] Удалена мёртвая регистрация Service Worker (скрипт недоступен):',sw.scriptURL)});" +
                        "});" +
                        "}).catch(function(){});" +
                        "}catch(e){}})()",
                }}
            />
        )}
        <ConsultationProvider turnstileSiteKey={turnstileSiteKey}>
            {children}
            <FloatingMenu/>
        </ConsultationProvider>
        </body>
        </html>
    );
}
