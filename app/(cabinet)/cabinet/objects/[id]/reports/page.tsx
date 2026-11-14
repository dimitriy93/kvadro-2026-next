import {Metadata} from 'next';
import {notFound, redirect} from 'next/navigation';
import {findObjectForUser, getAccountDataSource, getSessionUser, REPORT_MAX_PERIOD_DAYS} from '@/lib/account';
import {cabinet} from '@/config/routes/cabinet.routes';
import {ObjectReportsView} from './ui/object-reports.ui';
import './ui/object-reports.styles.scss';

type ObjectReportsPageProps = {
    params: Promise<{id: string}>;
};

/** Сегодняшняя календарная дата в МСК — максимум периода в форме. */
const todayMsk = (): string =>
    new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'})
        .format(new Date());

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

export async function generateMetadata({params}: ObjectReportsPageProps): Promise<Metadata> {
    const {id} = await params;
    const owned = await loadOwnedObject(id);

    return owned ? {title: `${owned.object.name} — отчёты`} : {};
}

export default async function ObjectReportsPage({params}: ObjectReportsPageProps) {
    const {id} = await params;
    const owned = await loadOwnedObject(id);

    if (!owned) {
        notFound();
    }

    const {object, userId} = owned;

    return (
        <ObjectReportsView
            object={object}
            userId={userId}
            todayMsk={todayMsk()}
            maxPeriodDays={REPORT_MAX_PERIOD_DAYS}
            isDemoData={getAccountDataSource() === 'demo'}
        />
    );
}
