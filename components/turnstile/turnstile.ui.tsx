'use client';
import {useEffect, useRef} from 'react';
import './turnstile.styles.scss';

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement,
                options: {
                    sitekey: string;
                    theme?: string;
                    size?: string;
                    callback: (token: string) => void;
                    'error-callback'?: () => void;
                    'expired-callback'?: () => void;
                }
            ) => string;
            reset: (widgetId: string) => void;
            remove: (widgetId: string) => void;
        };
    }
}

interface TurnstileProps {
    /** Вызывается после успешной проверки виджета с полученным токеном. */
    onVerify: (token: string | null) => void;
    /** Вызывается при ошибке загрузки/проверки виджета. */
    onError?: () => void;
    /** Вызывается при истечении срока токена. */
    onExpire?: () => void;
}

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

// Временный безопасный лог: наличие ключа без вывода самого значения.
console.log('Turnstile site key exists:', Boolean(TURNSTILE_SITE_KEY));

// Кэшируем Promise загрузки скрипта, чтобы не грузить его повторно при
// открытии/закрытии попапов и переиспользовании в нескольких формах.
let scriptPromise: Promise<boolean> | null = null;

const loadTurnstileScript = (): Promise<boolean> => {
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise((resolve) => {
        const existing = document.querySelector<HTMLScriptElement>(
            `script[src^="${TURNSTILE_SCRIPT_URL}"]`
        );
        if (existing) {
            resolve(true);
            return;
        }

        const script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });

    return scriptPromise;
};

/** Дожидается появления window.turnstile с ограниченным числом попыток. */
const waitForTurnstile = (windowRef: Window, attempts = 200): Promise<boolean> => {
    return new Promise((resolve) => {
        const check = (left: number) => {
            if ((windowRef as Window & { turnstile?: unknown }).turnstile) {
                resolve(true);
                return;
            }
            if (left <= 0) {
                resolve(false);
                return;
            }
            setTimeout(() => check(left - 1), 50);
        };
        check(attempts);
    });
};

/**
 * Клиентский компонент Cloudflare Turnstile.
 *
 * Загружает официальный скрипт Turnstile, рендерит виджет ровно один раз и
 * передаёт полученный токен через колбэк onVerify. Используется повторно
 * в ConsultationForm и Quiz.
 */
export const Turnstile = ({onVerify, onError, onExpire}: TurnstileProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    // Актуальные колбэки, чтобы не зависеть от замыканий при рендере.
    const onVerifyRef = useRef(onVerify);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);

    useEffect(() => {
        onVerifyRef.current = onVerify;
        onErrorRef.current = onError;
        onExpireRef.current = onExpire;
    }, [onVerify, onError, onExpire]);

    // Рендер виджета — побочный эффект, выполняется только внутри useEffect.
    useEffect(() => {
        let cancelled = false;

        const renderWidget = () => {
            const container = containerRef.current;
            if (!cancelled && container && !widgetIdRef.current) {
                if (!window.turnstile) return;

                // Страховка от повторного рендера в контейнере.
                container.replaceChildren();

                widgetIdRef.current = window.turnstile.render(container, {
                    sitekey: TURNSTILE_SITE_KEY,
                    callback: (token: string) => {
                        console.log('TURNSTILE TOKEN:', token);
                        onVerifyRef.current(token);
                    },
                    'error-callback': () => onErrorRef.current?.(),
                    'expired-callback': () => {
                        onVerifyRef.current(null);
                        onExpireRef.current?.();
                    },
                });
            }
        };

        if (!TURNSTILE_SITE_KEY) {
            console.error('Turnstile site key is empty in production build.');
            onErrorRef.current?.();
            return;
        }

        loadTurnstileScript()
            .then((loaded) => {
                if (cancelled || !loaded) return;
                return waitForTurnstile(window);
            })
            .then((ready) => {
                if (cancelled || !ready) return;
                renderWidget();
            })
            .catch(() => onErrorRef.current?.());

        return () => {
            cancelled = true;
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // виджет уже удалён
                }
                widgetIdRef.current = null;
            }
        };
    }, []);

    return (
        <div
            className="turnstile"
            ref={containerRef}
            aria-label="Проверка защиты от ботов"
        />
    );
};
