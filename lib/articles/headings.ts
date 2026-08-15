/**
 * Автоматическое построение боковой навигации по заголовкам статьи.
 *
 * Заголовки h2/h3 из Markdown получают стабильные HTML `id` и попадают
 * в навигацию «Содержание». Никакие заголовки вручную не хранятся —
 * источник только `article.md`.
 */
import type {ArticleHeading} from './types';

export type {ArticleHeading};

/** Транслитерация кириллицы в латиницу (нижний регистр). */
const CYRILLIC_MAP: Readonly<Record<string, string>> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
};

/**
 * Преобразует текст заголовка в «slug».
 *
 * `"Основные требования к системе"` → `"osnovnye-trebovaniya-k-sisteme"`.
 * Кириллица транслитерируется, лишняя пунктуация удаляется, пустой
 * результат заменяется на безопасный `"zagolovok"`.
 */
export function slugifyHeading(text: string): string {
    const normalized = text
        .toLowerCase()
        .split('')
        .map((char) => CYRILLIC_MAP[char] ?? char)
        .join('')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || 'zagolovok';
}

/**
 * Фабрика генераторов уникальных `id` для заголовков одной статьи.
 *
 * Повторяющиеся заголовки получают суффикс `-2`, `-3`, ... :
 * `"Требования"` → `"trebovaniya"`, `"Требования"` → `"trebovaniya-2"`.
 */
export function createHeadingIdFactory(): (text: string) => string {
    const used = new Map<string, number>();

    return (text: string) => {
        const base = slugifyHeading(text);
        const count = used.get(base) ?? 0;
        used.set(base, count + 1);
        return count === 0 ? base : `${base}-${count + 1}`;
    };
}