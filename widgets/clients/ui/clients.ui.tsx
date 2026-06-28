import { SectionHeader } from '@/components/section-header';
import { clients } from './clients.data';
import './clients.styles.scss';

export const Clients = () => (
  <section className="clients">
    <div className="clients__container">
      <SectionHeader
        title="Нам доверяют"
        eyebrow="Репутация и опыт"
        text="За годы работы реализованы проекты для государственных,
                промышленных и коммерческих организаций Московской области."
      />

      <div className="clients__grid">
        {clients.map((client) => (
          <article key={client.name} className="client-card">
            <div className="client-card__media">
              <img src={client.image} alt={client.name} className="client-card__image" />
            </div>
            <span className="client-card__label">{client.category}</span>
            <h3 className="client-card__name">{client.name}</h3>
          </article>
        ))}
      </div>

      <div className="clients__bottom">
        <p>И другие предприятия и организации региона.</p>
      </div>
    </div>
  </section>
);
