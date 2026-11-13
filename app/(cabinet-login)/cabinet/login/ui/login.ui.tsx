'use client';
import {FormEvent, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/button';
import {Logo} from '@/components/logo';
import {ThemeToggle} from '@/components/theme-toggle';
import {cabinet} from '@/config/routes/cabinet.routes';
import type {DemoLoginHint} from '@/lib/account';
import './login.styles.scss';

interface IAccountLoginPageProps {
    /** Тестовые учётные записи; в production передаётся пустой массив. */
    demoHints: DemoLoginHint[];
}

export const AccountLoginPage = ({demoHints}: IAccountLoginPageProps) => {
    const router = useRouter();
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (loading) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(cabinet.api.login, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({login: login.trim(), password}),
            });

            let result: {success?: boolean; error?: string} | null = null;
            try {
                result = await response.json();
            } catch {
            }

            if (!response.ok || !result?.success) {
                throw new Error(result?.error ?? 'Не удалось войти');
            }

            // Cookie уже установлена ответом;loading не сбрасываем — уходим на /cabinet.
            router.replace(cabinet.href);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось войти');
            setLoading(false);
        }
    };

    return (
        <div className="login">
            <div className="login__glow" aria-hidden="true"/>

            <div className="login__inner">
                <div className="login__top">
                    <Link href="/" aria-label="Перейти на основной сайт" className="login__logo">
                        <Logo/>
                    </Link>
                    <ThemeToggle/>
                </div>

                <section className="login__card">
                    <h1 className="login__title">Личный кабинет</h1>
                    <p className="login__subtitle">
                        Вход для клиентов «Квадро-Арсенал»
                    </p>

                    <form className="login-form" onSubmit={submit}>
                        <label className="login-form__field" htmlFor="account-login">
                            <span>Логин</span>
                            <input
                                id="account-login"
                                name="login"
                                type="text"
                                autoComplete="username"
                                required
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                                placeholder="Логин учётной записи"
                                disabled={loading}
                            />
                        </label>

                        <label className="login-form__field" htmlFor="account-password">
                            <span>Пароль</span>
                            <input
                                id="account-password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Пароль"
                                disabled={loading}
                            />
                        </label>

                        <Button
                            type="submit"
                            mode="primary"
                            disabled={loading}
                            aria-busy={loading}
                            className="login-form__submit"
                        >
                            {loading ? 'Входим…' : 'Войти'}
                        </Button>

                        {error && (
                            <div className="login-form__error" role="alert">
                                {error}
                            </div>
                        )}

                        <small className="login-form__note">
                            Доступ к кабинету предоставляется специалистами компании
                        </small>
                    </form>
                </section>

                {demoHints.length > 0 && (
                    <section className="login__hints">
                        <span className="login__hints-title">Тестовые учётные записи (только для разработки)</span>
                        <ul className="login__hints-list">
                            {demoHints.map((hint) => (
                                <li key={hint.login} className="login__hint">
                                    <span className="login__hint-text">
                                        <strong>{hint.login}</strong>
                                        {' / '}
                                        {hint.password}
                                    </span>
                                    <button
                                        type="button"
                                        className="login__hint-fill"
                                        onClick={() => {
                                            setLogin(hint.login);
                                            setPassword(hint.password);
                                            setError('');
                                        }}
                                    >
                                        Заполнить
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
};
