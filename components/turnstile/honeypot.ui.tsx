import './turnstile.styles.scss';

interface HoneypotProps {
    /** Опциональный колбэк значения скрытого поля (для форм без submit, например Quiz). */
    onChange?: (value: string) => void;
}

/**
 * Скрытое поле-приманка для защиты форм от ботов (honeypot).
 *
 * Поле присутствует в DOM, но полностью скрыто для пользователя с помощью CSS
 * (не атрибутом hidden), поэтому настоящие пользователи его не заполняют.
 * Если значение поля непустое — запрос считается ботом.
 */
export const Honeypot = ({ onChange }: HoneypotProps) => (
    <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
            type="text"
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            onChange={(e) => onChange?.(e.target.value)}
        />
    </div>
);
