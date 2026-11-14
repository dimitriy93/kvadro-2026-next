import {Metadata} from 'next';
import {notFound, redirect} from 'next/navigation';
import {findObjectForUser, getAccountDataSource, getSessionUser} from '@/lib/account';
import {cabinet} from '@/config/routes/cabinet.routes';
import {ObjectMapView} from '../ui/object-map.ui';

type ObjectMapPageProps = {
    params: Promise<{id: string}>;
};

async function loadOwnedObject(objectId: string) {
    const user = await getSessionUser();

    if (!user) {
        redirect(cabinet.login.href);
    }

    // Чужой и несуществующий объект одинаково дают null → 404 без раскрытия.
    // userId — namespace пользовательских настроек разделов (E7.3.5).
    const object = await findObjectForUser(user.id, objectId);

    return object ? {object, userId: user.id} : null;
}

export async function generateMetadata({params}: ObjectMapPageProps): Promise<Metadata> {
    const {id} = await params;
    const owned = await loadOwnedObject(id);

    return owned ? {title: `${owned.object.name} — карта`} : {};
}

export default async function ObjectMapPage({params}: ObjectMapPageProps) {
    const {id} = await params;
    const owned = await loadOwnedObject(id);

    if (!owned) {
        notFound();
    }

    const {object, userId} = owned;

    return <ObjectMapView object={object} userId={userId} isDemoData={getAccountDataSource() === 'demo'}/>;
}
