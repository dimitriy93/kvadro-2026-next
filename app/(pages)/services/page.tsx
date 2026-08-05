import {Metadata} from "next";
import ServicesPage from "./ui/services.ui";

export const metadata: Metadata = {
    title: 'Услуги',
};

export default function Page() {
    return <ServicesPage/>;
}