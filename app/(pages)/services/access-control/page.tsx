import {Metadata} from "next";
import AccessControlPage from "./ui/access-control.ui";

export const metadata: Metadata = {
    title: 'СКУД',
};

export default function Page() {
    return <AccessControlPage/>;
}