import Link from 'next/link';
import {cabinet} from '@/config/routes/cabinet.routes';

/**
 * Внутренняя 404-страница защищённой зоны: рендерится внутри оболочки
 * кабинета при notFound() на страницах объектов. Одинакова для чужого
 * и несуществующего объекта — не раскрывает наличие чужих данных.
 */
export default function AccountNotFound() {
    return (
        <div className="acc-notfound">
            <h1 className="acc-notfound__title">Объект не найден</h1>
            <p className="acc-notfound__text">
                Объект недоступен или не связан с вашей учётной записью.
                Вернитесь к списку доступных объектов.
            </p>
            <Link href={cabinet.href} className="acc-notfound__link">
                К списку объектов
            </Link>
        </div>
    );
}
