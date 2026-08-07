'use client';
import { useEffect, useRef } from 'react';
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

let scriptPromise: Promise<boolean> | null = null;

const loadTurnstileScript = (): Promise<boolean> => {
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise((resolve) => {
        const existing = document.querySelector<HTMLScriptElement>(
            `script[src^="${TURNSTILE_SCRIPT_URL}"]`
        );
        if (existing) {
            // Скрипт уже присутствует в DOM — wait до готовности window.turnstile
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

/**
 * Гарантирует, что window.turnstile доступен до вызова render,
 * с ограниченным числом попыток (скрипт уже мог быть загружен ранее).
 */
const waitForTurnstile = (windowRef: Window, attempts = 20): Promise<boolean> => {
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
 * передаёт полученный токен через колбэк onVerify. Повторно используется
 * в ConsultationForm и Quiz.
 */
export const Turnstile = ({ onVerify, onError, onExpire }: TurnstileProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    const onVerifyRef = useRef(onVerify);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

    useEffect(() => {
        onVerifyRef.current = onVerify;
        onErrorRef.current = onError;
        onExpireRef.current = onExpire;
    }, [onVerify, onError, onExpire]);

    useEffect(() => {
        let cancelled = false;

        const renderWidget = () => {
            const container = containerRef.current;
            if (!cancelled && container && !widgetIdRef.current) {
                if (!window.turnstile) return;

                // Сбрасываем любые предыдущие виджеты в контейнере во избежание двойного рендера
                container.replaceChildren();

                widgetIdRef.current = window.turnstile.render(container, {
                    sitekey: siteKey,
                    callback: (token: string) => onVerifyRef.current(token),
                    'error-callback': () => onErrorRef.current?.(),
                    'expired-callback': () => onExpireRef.current?.(),
                });
            }
        };

        if (!siteKey) {
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
    }, [siteKey]);

    return (
        <div
            className="turnstile"
            ref={containerRef}
            aria-label="Проверка защиты от ботов"
        />
    );
};