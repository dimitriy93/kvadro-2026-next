import {Metadata} from "next";
import FireAlarmDesignPage from "./ui/fire-alarm-design.ui";

export const metadata: Metadata = {
    title: 'Проектирование ПС и СОУЭ',
};

export default function Page() {
    return <FireAlarmDesignPage/>;
}