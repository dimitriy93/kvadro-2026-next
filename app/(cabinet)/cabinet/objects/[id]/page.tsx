import {Metadata} from 'next';
import {notFound, redirect} from 'next/navigation';
import {findDemoObjectForUser, getDemoZonesForObject, getSessionUser} from '@/lib/account';
import {cabinet} from '@/config/routes/cabinet.routes';
import {ObjectStateView} from './ui/object-state.ui';

type ObjectPageProps = {
    params: Promise<{id: string}>;
};

async function loadOwnedObject(objectId: string) {
    const user = await getSessionUser();

    if (!user) {
        redirect(cabinet.login.href);
    }

    // Чужой и несуществующий объект одинаково дают null → 404 без раскрытия.
    return findDemoObjectForUser(user.id, objectId);
}

export async function generateMetadata({params}: ObjectPageProps): Promise<Metadata> {
    const {id} = await params;
    const object = await loadOwnedObject(id);

    return object ? {title: `${object.name} — состояние`} : {};
}

export default async function ObjectStatePage({params}: ObjectPageProps) {
    const {id} = await params;
    const object = await loadOwnedObject(id);

    if (!object) {
        notFound();
    }

    const zones = getDemoZonesForObject(object.id);

    return <ObjectStateView object={object} zones={zones}/>;
}
