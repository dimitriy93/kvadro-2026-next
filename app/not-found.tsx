import Image from "next/image";
import Link from "next/link";
import notFoundImage from "@/app/_assets/images/not_found.webp";
import {Metadata} from "next";
import {CopyrightBar} from "@/components/CopyrightBar";
import {Button} from "@/components/Button";
import {Header} from "@/widgets/Header";
import {not_found} from "@/config/content/not_found";
import "@/styles/not_found.scss";

export const metadata: Metadata = {
    title: not_found.page_title
}

export default function NotFound() {
    return (
        <div className="not-found">
            <Header />
            <div className="not-found__content">
                <div className="not-found__visual">
                    <Image
                        src={notFoundImage}
                        alt={not_found.alt_image}
                        className="not-found__image"
                        priority
                    />
                </div>
                <div className="not-found__info">
                    <h1 className="not-found__title">{not_found.title}</h1>
                    <p className="not-found__desc">{not_found.desc}</p>
                    <Link href="/">
                        <Button mode="secondary">{not_found.link}</Button>
                    </Link>
                </div>
            </div>
            <CopyrightBar />
        </div>
    )
}