import {Metadata} from "next";
import FireAlarmPage from "./ui/fire-alarm.ui";

export const metadata: Metadata = {
    title: 'Пожарная безопасность',
};

export default function Page() {
    return <FireAlarmPage/>;
}