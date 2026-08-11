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

// Клиентский ключ Cloudflare Turnstile (используется только на клиенте).
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

/**
 * Клиентский компонент Cloudflare Turnstile.
 *
 * Скрипт API (https://challenges.cloudflare.com/turnstile/v0/api.js) загружается
 * глобально в app/layout.tsx. Здесь выполняется только рендер виджета.
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
        console.log('========== TURNSTILE DEBUG ==========');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log(
            'NEXT_PUBLIC_TURNSTILE_SITE_KEY:',
            process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
        );
        console.log(
            'TURNSTILE_SITE_KEY constant:',
            TURNSTILE_SITE_KEY
        );
        console.log('window.turnstile:', window.turnstile);
        console.log('======================================');

        // 1. Проверка клиентского site key
        if (!TURNSTILE_SITE_KEY) {
            console.error(
                'TURNSTILE SITE KEY is empty (NEXT_PUBLIC_TURNSTILE_SITE_KEY).'
            );
            onErrorRef.current?.();
            return;
        }

        // 2. Проверка наличия window.turnstile (скрипт грузится в layout).
        if (!window.turnstile) {
            console.error(
                'TURNSTILE OBJECT is undefined. Скрипт https://challenges.cloudflare.com/turnstile/v0/api.js не загрузился.'
            );
            onErrorRef.current?.();
            return;
        }

        // 3. Проверка наличия контейнера.
        const container = containerRef.current;
        if (!container) {
            console.error('TURNSTILE CONTAINER is undefined.');
            return;
        }

        // 4. Рендер виджета ровно один раз.
        if (widgetIdRef.current !== null) return;

        console.log('TURNSTILE SITE KEY:', TURNSTILE_SITE_KEY);
        console.log('TURNSTILE OBJECT:', window.turnstile);
        console.log('TURNSTILE CONTAINER:', container);

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

        console.log('TURNSTILE WIDGET ID:', widgetIdRef.current);

        return () => {
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
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
