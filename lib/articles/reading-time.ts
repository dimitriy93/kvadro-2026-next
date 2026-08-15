/**
 * Автоматический расчёт времени чтения статьи.
 *
 * Логика:
 *  1. из Markdown-разметки удаляется разметка и технические элементы
 *     (код-блоки, inline-код, изображения, ссылки, HTML-теги);
 *  2. оставшийся текст разбивается на слова;
 *  3. количество слов делится на среднюю скорость чтения
 *     русскоязычного профессионального текста (200 слов/мин);
 *  4. результат округляется до целого количества минут.
 */

/** Средняя скорость чтения: слов в минуту (русскоязычный профессиональный текст). */
export const WORDS_PER_MINUTE = 200;

/**
 * Удаляет Markdown-разметку и технические элементы из текста,
 * оставляя только «читаемые» слова.
 */
export function stripMarkdown(markdown: string): string {
    if (!markdown) {
        return '';
    }

    return markdown
        // fenced code blocks (включая ```...``` и ~~~~...~~~~)
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/~~~[\s\S]*?~~~/g, ' ')
        // inline code
        .replace(/`[^`]*`/g, ' ')
        // images
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        // links -> keep the link text
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        // setext heading underline (=== / ---)
        .replace(/^\s*(=+|-+)\s*$/gm, ' ')
        // ATX headings
        .replace(/^\s*#{1,6}\s+/gm, ' ')
        // blockquotes
        .replace(/^\s*>\s?/gm, ' ')
        // list markers, task checkboxes
        .replace(/^\s*([-*+]|\d+[.)])\s+/gm, ' ')
        .replace(/\[[ xX]\]\s*/g, ' ')
        // horizontal rules
        .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, ' ')
        // HTML tags
        .replace(/<[^>]+>/g, ' ')
        // emphasis / strong / strikethrough markers
        .replace(/[*_~]+/g, ' ')
        // leftover markdown link brackets
        .replace(/[\[\]()]/g, ' ')
        // collapse whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Считает количество слов в тексте (после удаления разметки).
 */
export function countWords(text: string): number {
    const cleaned = stripMarkdown(text);
    if (!cleaned) {
        return 0;
    }
    return cleaned.split(/\s+/).filter(Boolean).length;
}

/**
 * Рассчитывает примерное время чтения в минутах.
 * Гарантированно возвращает целое число не меньше 1.
 */
export function getReadingTime(markdown: string): number {
    const words = countWords(markdown);
    const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
    return minutes;
}

/**
 * Корректные русские формы для существительного «минута».
 *  1 мин чтения, 2 мин чтения, 5 мин чтения, 21 мин чтения.
 */
export function formatReadingTime(minutes: number): string {
    const abs = Math.abs(minutes) % 100;
    const last = abs % 10;

    if (abs > 10 && abs < 20) {
        return `${minutes} минут чтения`;
    }
    if (last === 1) {
        return `${minutes} минута чтения`;
    }
    if (last >= 2 && last <= 4) {
        return `${minutes} минуты чтения`;
    }
    return `${minutes} минут чтения`;
}
