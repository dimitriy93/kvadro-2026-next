import {landing} from "@/config/content/landing";
import {SectionHeader} from "@/components/SectionHeader";
import "./styles.scss";

const {clients, title} = landing;

export const Clients = () => (
    <section className="clients">
        <div className="clients__container">
            <SectionHeader
                title={title.client.title}
                eyebrow={title.client.eyebrow}
                text={title.client.text}
            />

            <div className="clients__grid">
                {clients.map((client) => (
                    <article key={client.name} className="client-card">
                        <div className="client-card__media">
                            <img
                                src={client.image}
                                alt={client.name}
                                className="client-card__image"
                            />
                        </div>

                        <span className="client-card__label">{client.category}</span>

                        <h3 className="client-card__name">{client.name}</h3>
                    </article>
                ))}
            </div>

            <div className="clients__bottom">
                <p>{landing.clients_bottom}</p>
            </div>
        </div>
    </section>
)