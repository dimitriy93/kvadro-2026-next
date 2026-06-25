import {ReactNode} from "react";
import {Heading} from "@/components/heading";
import {contacts} from "@/config/brand/contacts";
import "./consultation-block.style.scss";

interface IConsultationBlockProps {
    eyebrow?: string;
    heading: string;
    buttonText: string;
    children?: ReactNode;
}

export const ConsultationBlock = ({ eyebrow, heading, children, buttonText }: IConsultationBlockProps) => (
    <section className="consultation-block">
        <div className="consultation-block__content">
            <Heading eyebrow={eyebrow} mode="dark" as="h2">
                {heading}
            </Heading>
            {children && <p>{children}</p>}
        </div>
        <a href={contacts.phoneLink} className="consultation-block__button">
            {buttonText}
        </a>
    </section>
)