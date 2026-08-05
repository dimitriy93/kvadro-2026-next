import {Metadata} from "next";
import SecurityAlarmPage from "@/app/(pages)/services/security-alarm/ui/security-alarm.ui";

export const metadata: Metadata = {
    title: 'Охранная сигнализация',
};

export default function Page() {
    return <SecurityAlarmPage/>;
}