import {Metadata} from "next";
import ContactsPage from "@/app/(pages)/contacts/ui/contacts.ui";

export const metadata: Metadata = {
    title: 'Контакты',
};

export default function Page() {
    return <ContactsPage/>;
}