'use client';
import {FormEvent, useState} from 'react';
import {usePathname} from 'next/navigation';
import {services} from '@/config/routes/services.routes';
import {createPhoneChangeHandler} from '@/lib/phone-mask';

interface IConsultationFormProps {
    onSuccess?: () => void;
}

export const ConsultationForm = ({onSuccess}: IConsultationFormProps) => {
    const pathname = usePathname();
    const [loading, setLoading] = useState(false);
    const [service, setService] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState('');
    const [phone, setPhone] = useState('');

    const phoneChangeHandler = createPhoneChangeHandler(setPhone);

    const servicesTitles: string[] = [
        ...Object.values(services).map((service) => service.title),
        'Другое',
    ];

    const submit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setLoading(true);
        setError('');

        const form = e.currentTarget;
        const formData = new FormData(form);

        const name = String(formData.get('name') ?? '').trim();
        const phone = String(formData.get('phone') ?? '').trim();
        const direction = String(formData.get('service') ?? '').trim();
        const message = String(formData.get('message') ?? '').trim();

        try {
            const response = await fetch('/api/telegram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    phone,
                    direction,
                    message,
                    pathname,
                }),
            });

            let result: { success?: boolean; error?: string } | null = null;

            try {
                result = await response.json();
            } catch {
            }

            if (!response.ok || !result?.success) {
                throw new Error(result?.error ?? 'Ошибка отправки заявки');
            }

            form.reset();
            setPhone('');
            setService('');
            setIsOpen(false);
            setError('');

            try {
                onSuccess?.();
            } catch (onSuccessErr) {
                console.error('Ошибка onSuccess:', onSuccessErr);
            }
        } catch (err) {
            console.error('Ошибка отправки заявки:', err);

            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Не удалось отправить заявку.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="consultation-form" onSubmit={submit}>
            <label>
                <span>Имя *</span>
                <input required name="name" placeholder="Ваше имя"/>
            </label>

            <label>
                <span>Телефон *</span>
                <input
                    required
                    type="tel"
                    name="phone"
                    placeholder="+7 (___) ___-__-__"
                    value={phone}
                    onChange={phoneChangeHandler}
                />
            </label>

            <label>
                <span>Направление</span>

                <div className="service-select">
                    <button
                        type="button"
                        className="service-select__button"
                        onClick={() => setIsOpen((prev) => !prev)}
                    >
                        <span>{service || 'Выберите услугу'}</span>
                        <i className={isOpen ? 'active' : ''}/>
                    </button>

                    {isOpen && (
                        <ul className="service-select__list">
                            {servicesTitles.map((service) => (
                                <li
                                    key={service}
                                    onClick={() => {
                                        setService(service);
                                    }}
                                >
                                    {service}
                                </li>
                            ))}
                        </ul>
                    )}

                    <input type="hidden" name="service" value={service}/>
                </div>
            </label>

            <label>
                <span>Сообщение</span>
                <textarea name="message" placeholder="Расскажите об объекте"/>
            </label>

            <button disabled={loading}>{loading ? 'Отправляем...' : 'Отправить заявку'}</button>

            <small>Нажимая кнопку, вы соглашаетесь с обработкой персональных данных</small>

            {error && <div className="consultation-form__error">{error}</div>}
        </form>
    );
};
