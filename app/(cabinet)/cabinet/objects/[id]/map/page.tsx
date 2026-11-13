import {Metadata} from 'next';
import {notFound, redirect} from 'next/navigation';
import {findDemoObjectForUser, getSessionUser} from '@/lib/account';
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

    return findDemoObjectForUser(user.id, objectId);
}

export async function generateMetadata({params}: ObjectMapPageProps): Promise<Metadata> {
    const {id} = await params;
    const object = await loadOwnedObject(id);

    return object ? {title: `${object.name} — карта`} : {};
}

export default async function ObjectMapPage({params}: ObjectMapPageProps) {
    const {id} = await params;
    const object = await loadOwnedObject(id);

    if (!object) {
        notFound();
    }

    return <ObjectMapView object={object}/>;
}
