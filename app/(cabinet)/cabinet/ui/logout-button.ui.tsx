'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/button';
import {cabinet} from '@/config/routes/cabinet.routes';

export const LogoutButton = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const logout = async () => {
        if (loading) {
            return;
        }

        setLoading(true);

        try {
            await fetch(cabinet.api.logout, {method: 'POST'});
        } catch {
            // Cookie всё равно попытается очиститься при следующем входе;
            // на страницу входа уходим даже при сетевой ошибке.
        }

        router.replace(cabinet.login.href);
    };

    return (
        <Button mode="secondary" type="button" className="acc-header__logout" onClick={logout} disabled={loading}>
            {loading ? 'Выходим…' : 'Выйти'}
        </Button>
    );
};
