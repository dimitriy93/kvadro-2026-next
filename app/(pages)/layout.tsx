import {Footer} from "@/widgets/footer";
import {Header} from "@/widgets/header";
import "@/styles/pages.scss";
import {ConsultationProvider} from "@/providers/consultation-provider";

export default function LandingLayout({ children }) {
    return (
        <ConsultationProvider>
            <Header />
            { children }
            <Footer />
        </ConsultationProvider>
    )
}