import {ChangeEvent} from 'react';

/**
 * Общий helper маски телефона в формате:
 * +7 (900) 123-45-67
 * Используется в ConsultationForm и quiz__form.
 */

/** Возвращает строку, содержащую только цифры. */
const stripDigits = (value: string): string => value.replace(/\D/g, '');

/**
 * Форматирует произвольный ввод в маску телефона.
 * Пример: "9001234567" -> "+7 (900) 123-45-67"
 */
export const formatPhone = (raw: string): string => {
    let digits = stripDigits(raw);

    if (digits.startsWith('8') || digits.startsWith('7')) {
        digits = digits.slice(1);
    }

    digits = digits.slice(0, 10);

    if (digits.length === 0) return '';

    const parts: string[] = ['+7 (', digits.slice(0, 3)];

    if (digits.length >= 3) {
        parts.push(') ', digits.slice(3, 6));
    }
    if (digits.length >= 6) {
        parts.push('-', digits.slice(6, 8));
    }
    if (digits.length >= 8) {
        parts.push('-', digits.slice(8, 10));
    }

    return parts.join('');
};

/**
 * Возвращает обработчик изменения значения инпута с применением маски.
 * setter получает уже отформатированное значение телефона.
 */
export const createPhoneChangeHandler =
    (setter: (value: string) => void) => (e: ChangeEvent<HTMLInputElement>): void => {
        setter(formatPhone(e.target.value));
    };
