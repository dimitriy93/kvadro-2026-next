'use client';
import {useEffect} from 'react';
import {Button} from '@/components/button';

/**
 * Граница ошибок защищённой зоны кабинета. Сетевые проблемы источника данных
 * (например, недоступность GEORITM) не должны показывать стандартную
 * системную ошибку Next.js — пользователь видит понятное сообщение
 * и может повторить попытку без потери сессии.
 */
export default function CabinetError({error, reset}: {error: Error & {digest?: string}; reset: () => void}) {
    useEffect(() => {
        // Подробности — только в серверную/консольную диагностику; в UI
        // сообщение обобщённое, чтобы не раскрывать внутреннее устройство.
        console.error('Cabinet error boundary:', error.message);
    }, [error]);

    return (
        <section className="acc-overview" aria-label="Ошибка загрузки">
            <div className="acc-overview__head">
                <div className="acc-overview__heading">
                    <span className="promo-eyebrow">Личный кабинет</span>
                    <h1 className="acc-overview__title">Не удалось загрузить данные</h1>
                    <p className="acc-overview__subtitle">
                        Сервер мониторинга может быть временно недоступен.
                        Ваша сессия сохранена — попробуйте повторить запрос.
                    </p>
                </div>
            </div>

            <Button mode="primary" type="button" onClick={reset}>
                Повторить попытку
            </Button>
        </section>
    );
}
