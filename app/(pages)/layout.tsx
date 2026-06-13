import {Footer} from "@/widgets/footer";
import {Header} from "@/widgets/header";
import "@/styles/pages.scss";

export default function LandingLayout({ children }) {
    return (
        <>
            <Header />
            { children }
            <Footer />
        </>
    )
}