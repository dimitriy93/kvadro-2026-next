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
    /** Публичный Cloudflare Turnstile Site Key (получается на сервере и передаётся через prop). */
    siteKey: string;
    /** Вызывается после успешной проверки виджета с полученным токеном. */
    onVerify: (token: string | null) => void;
    /** Вызывается при ошибке загрузки/проверки виджета. */
    onError?: () => void;
    /** Вызывается при истечении срока токена. */
    onExpire?: () => void;
}

/**
 * Клиентский компонент Cloudflare Turnstile.
 *
 * Сайт-ключ (siteKey) передаётся через prop из серверного компонента, чтобы его
 * значение бралось из runtime-окружения, а не инлайнилось в клиентский бандл на
 * этапе сборки (как это происходит с process.env.NEXT_PUBLIC_* в клиентском коде).
 *
 * Скрипт API (https://challenges.cloudflare.com/turnstile/v0/api.js) загружается
 * глобально в app/layout.tsx. Здесь выполняется только рендер виджета.
 */
export const Turnstile = ({siteKey, onVerify, onError, onExpire}: TurnstileProps) => {
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
    // Зависимость [siteKey] гарантирует, что если ключ пришёл позже (например,
    // после гидрации серверного компонента), виджет будет отрисован повторно, а
    // не останется с пустым siteKey.
    useEffect(() => {
        console.log(
            'TURNSTILE PROP SITE KEY:',
            siteKey ? 'present' : 'missing'
        );

        // 1. Проверка клиентского site key.
        if (!siteKey) {
            console.error('TURNSTILE SITE KEY is empty.');
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

        // 4. Рендер виджета ровно один раз на актуальный siteKey.
        if (widgetIdRef.current !== null) return;

        widgetIdRef.current = window.turnstile.render(container, {
            sitekey: siteKey,
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

        return () => {
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                }
                widgetIdRef.current = null;
            }
        };
    }, [siteKey]);

    return (
        <div
            className="turnstile"
            ref={containerRef}
            aria-label="Проверка защиты от ботов"
        />
    );
};
