import {Metadata} from 'next';
import {notFound, redirect} from 'next/navigation';
import {findObjectForUser, getAccountDataSource, getZonesForObject, getSessionUser} from '@/lib/account';
import type {ObjectZoneSection} from '@/lib/account';
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
    return findObjectForUser(user.id, objectId);
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

    // Ошибка загрузки зон не должна ронять всю карточку объекта: секция
    // покажет сообщение об ошибке, остальная страница остаётся рабочей.
    let zones: ObjectZoneSection[] = [];
    let zonesLoadFailed = false;
    try {
        zones = await getZonesForObject(object.id);
    } catch {
        zonesLoadFailed = true;
    }

    return (
        <ObjectStateView
            object={object}
            zones={zones}
            zonesLoadFailed={zonesLoadFailed}
            isDemoData={getAccountDataSource() === 'demo'}
        />
    );
}
