import {Metadata} from "next";
import IntercomMaintenancePage from "./ui/intercom-maintenance.ui";

export const metadata: Metadata = {
    title: 'Обслуживание домофонов',
};

export default function Page() {
    return <IntercomMaintenancePage/>;
}