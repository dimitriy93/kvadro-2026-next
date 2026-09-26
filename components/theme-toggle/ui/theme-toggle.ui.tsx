'use client';
import {useEffect} from 'react';
import './theme-toggle.styles.scss';

const STORAGE_KEY = 'theme';

type Theme = 'light' | 'dark';

const readStoredTheme = (): Theme => {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
};

const applyTheme = (theme: Theme) => {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
};

// Тема применяется сразу при загрузке модуля: на клиентских переходах это
// происходит до отрисовки новой страницы. При жёсткой загрузке ту же работу
// раньше выполняет инлайн-скрипт в app/layout.tsx. На сервере пропускаем.
if (typeof document !== 'undefined') {
    applyTheme(readStoredTheme());
}

export const ThemeToggle = () => {
    const toggleTheme = () => {
        const next: Theme = readStoredTheme() === 'light' ? 'dark' : 'light';

        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
        }

        applyTheme(next);
    };

    useEffect(() => {
        // При клиентском переходе (например, с главной) тема могла быть снята,
        // восстанавливаем сохранённый выбор.
        applyTheme(readStoredTheme());

        // Внутренние страницы тематизируются, главная — нет. При уходе с
        // внутренних страниц (в том числе на '/') возвращаем тёмную тему.
        return () => applyTheme('dark');
    }, []);

    return (
        <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Переключить тему"
            title="Переключить тему"
        >
            <svg className="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
            <svg className="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 aria-hidden="true">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
        </button>
    );
};
