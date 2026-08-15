/**
 * Вспомогательные функции форматирования для системы статей.
 */

/** Маппинг русских названий категорий на slug категорий навигации. */
const CATEGORY_SLUGS: Record<string, string> = {
    'Пожарная безопасность': 'fire-safety',
    'Видеонаблюдение': 'video-surveillance',
    'Охранная сигнализация': 'security-alarm',
    'СКУД': 'access-control',
    'Слаботочные системы': 'low-current',
    'Проектирование': 'design',
};

/**
 * Возвращает slug категории для навигации на странице `/articles`.
 * Если категории нет среди известных, генерирует slug из названия.
 */
export function getCategorySlug(category: string): string {
    if (CATEGORY_SLUGS[category]) {
        return CATEGORY_SLUGS[category];
    }
    return category
        .trim()
        .toLowerCase()
        .replace(/[^a-zа-яё0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Форматирует дату публикации `YYYY-MM-DD` в вид `DD.MM.YYYY`
 * (используется в UI, соответствует существующему стилю `12.08.2026`).
 */
export function formatPublishedAt(publishedAt: string): string {
    if (!publishedAt) {
        return '';
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(publishedAt.trim());
    if (!match) {
        return publishedAt;
    }
    const [, year, month, day] = match;
    return `${day}.${month}.${year}`;
}
