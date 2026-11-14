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

    return findObjectForUser(user.id, objectId);
}

export async function generateMetadata({params}: ObjectReportsPageProps): Promise<Metadata> {
    const {id} = await params;
    const object = await loadOwnedObject(id);

    return object ? {title: `${object.name} — отчёты`} : {};
}

export default async function ObjectReportsPage({params}: ObjectReportsPageProps) {
    const {id} = await params;
    const object = await loadOwnedObject(id);

    if (!object) {
        notFound();
    }

    return (
        <ObjectReportsView
            object={object}
            todayMsk={todayMsk()}
            maxPeriodDays={REPORT_MAX_PERIOD_DAYS}
            isDemoData={getAccountDataSource() === 'demo'}
        />
    );
}
