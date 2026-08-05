import {Metadata} from "next";
import AboutPage from "./ui/about.ui";

export const metadata: Metadata = {
    title: 'О компании',
};

export default function Page() {
    return <AboutPage/>;
}