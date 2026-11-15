import {Metadata} from 'next';
import {notFound, redirect} from 'next/navigation';
import {findObjectForUser, getAccountDataSource, getChannelsForObject, getDiagnosticsForObject, getPowerForObject, getZonesForObject, getSessionUser} from '@/lib/account';
import type {ObjectFault, ObjectZoneSection} from '@/lib/account';
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
    // userId — namespace пользовательских настроек разделов (E7.3.5).
    const object = await findObjectForUser(user.id, objectId);

    return object ? {object, userId: user.id} : null;
}

export async function generateMetadata({params}: ObjectPageProps): Promise<Metadata> {
    const {id} = await params;
    const owned = await loadOwnedObject(id);

    return owned ? {title: `${owned.object.name} — состояние`} : {};
}

export default async function ObjectStatePage({params}: ObjectPageProps) {
    const {id} = await params;
    const owned = await loadOwnedObject(id);

    if (!owned) {
        notFound();
    }

    const {object, userId} = owned;

    // Ошибки загрузки зон, диагностики, каналов связи и питания не должны
    // ронять карточку объекта: соответствующие секции покажут сообщение,
    // остальная страница остаётся рабочей. Загрузки независимы — выполняются
    // параллельно (E9: каналы и питание не блокируют основные сведения).
    const [zonesResult, diagnosticsResult, channelsResult, powerResult] = await Promise.allSettled([
        getZonesForObject(object.id),
        getDiagnosticsForObject(object.id),
        getChannelsForObject(object.id),
        getPowerForObject(object.id),
    ]);

    const zones = zonesResult.status === 'fulfilled' ? zonesResult.value : [];
    const diagnostics = diagnosticsResult.status === 'fulfilled' ? diagnosticsResult.value : [];

    return (
        <ObjectStateView
            object={object}
            userId={userId}
            zones={zones}
            zonesLoadFailed={zonesResult.status === 'rejected'}
            faults={diagnostics}
            faultsLoadFailed={diagnosticsResult.status === 'rejected'}
            channels={channelsResult.status === 'fulfilled' ? channelsResult.value : null}
            power={powerResult.status === 'fulfilled' ? powerResult.value : null}
            isDemoData={getAccountDataSource() === 'demo'}
        />
    );
}
