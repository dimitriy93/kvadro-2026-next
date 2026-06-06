import "./footer.styles.scss";

export const Footer = () => (
    <footer className="footer">
        <div className="footer__container">

            <div className="footer__col">
                <h3 className="footer__logo">Квадро-Арсенал</h3>
                <p className="footer__desc">
                    Комплексные решения в сфере безопасности.
                </p>
            </div>

            <div className="footer__col">
                <span className="footer__title">Услуги</span>
                <ul>
                    <li>Пожарная безопасность</li>
                    <li>Охранная сигнализация</li>
                    <li>Слаботочные системы</li>
                    <li>Охрана объектов</li>
                </ul>
            </div>

            <div className="footer__col">
                <span className="footer__title">Компания</span>
                <ul>
                    <li>О нас</li>
                    <li>Контакты</li>
                    <li>Цены</li>
                    <li>Статьи</li>
                </ul>
            </div>

            <div className="footer__col">
                <span className="footer__title">Контакты</span>
                <p>г. Электросталь</p>
                <p>ул. Чернышевского, 20</p>
                <p>Телефон</p>
                <p>Email</p>
            </div>

        </div>

        <div className="footer__bottom">
            <span>© 2026 Квадро-Арсенал</span>
            <span>Политика конфиденциальности</span>
        </div>
    </footer>
)