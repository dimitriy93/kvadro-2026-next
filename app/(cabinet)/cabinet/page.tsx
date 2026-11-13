import {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {getDemoObjectsForUser, getSessionUser} from '@/lib/account';
import {cabinet} from '@/config/routes/cabinet.routes';
import {ObjectsOverview} from './ui/objects-overview.ui';

export const metadata: Metadata = {
    title: 'Объекты мониторинга',
};

/**
 * Главная страница кабинета. Список объектов получен той же серверной
 * функцией разграничения доступа, что и в GET /api/cabinet/objects.
 */
export default async function AccountObjectsPage() {
    const user = await getSessionUser();

    if (!user) {
        redirect(cabinet.login.href);
    }

    const objects = getDemoObjectsForUser(user.id);

    return <ObjectsOverview userName={user.displayName} objects={objects}/>;
}
