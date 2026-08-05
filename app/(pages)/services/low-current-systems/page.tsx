import {Metadata} from "next";
import LowCurrentSystemsPage from "./ui/low-current-systems.ui";

export const metadata: Metadata = {
    title: 'Слаботочные системы',
};

export default function Page() {
    return <LowCurrentSystemsPage/>;
}