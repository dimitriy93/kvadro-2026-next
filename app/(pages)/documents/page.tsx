import {Metadata} from "next";
import DocumentsPage from "@/app/(pages)/documents/ui/documents.ui";

export const metadata: Metadata = {
    title: 'Документы',
};

export default function Page() {
    return <DocumentsPage/>;
}