import {Metadata} from "next";
import {inter} from "@/app/_assets/fonts";
import "@/styles/global.scss";
import "@/styles/landing.scss";

export const metadata: Metadata = {
    title: "Квадро-Арсенал",
    description: "Проектно-монтажная организация в городе Электросталь"
}

export default function LandingLayout({ children }) {
    return (
        <html lang="ru" className={inter.className}>
            <body>
                { children }
            </body>
        </html>
    )
}