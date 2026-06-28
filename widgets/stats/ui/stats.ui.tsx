'use client';
import { stats } from './stats.data';
import './stats.styles.scss';

export const Stats = () => (
  <section className="stats">
    <div className="stats__container">
      {stats.map((item) => (
        <article key={item.label} className="stats__card">
          <div className="stats__value">{item.value}</div>
          <div className="stats__label">{item.label}</div>
          <p className="stats__text">{item.text}</p>
        </article>
      ))}
    </div>
  </section>
);
