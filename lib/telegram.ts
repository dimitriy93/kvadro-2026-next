import {TelegramLead} from '@/types/telegram';
import {
    formatTelegramField,
    telegramMessageTemplate,
    telegramQuizMessageTemplate,
} from '@/config/telegram.config';

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

const formatPhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');

    let normalized = digits;
    if (digits.length === 11 && digits.startsWith('8')) {
        normalized = `7${digits.slice(1)}`;
    } else if (digits.length === 10 && digits.startsWith('9')) {
        normalized = `7${digits}`;
    }

    if (normalized.length === 11 && normalized.startsWith('7')) {
        const area = normalized.slice(1, 4);
        const part1 = normalized.slice(4, 7);
        const part2 = normalized.slice(7, 9);
        const part3 = normalized.slice(9, 11);
        return `+7 ${area} ${part1}-${part2}-${part3}`;
    }

    return raw;
};

const formatDatetime = (date: Date): string => {
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} • ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const buildConsultationMessage = (data: TelegramLead): string => {
    const message = data.message?.trim() ? data.message.trim() : telegramMessageTemplate.fallbacks.message;
    const direction = data.direction?.trim() ? data.direction.trim() : telegramMessageTemplate.fallbacks.direction;
    const phone = formatPhone(data.phone);
    const datetime = formatDatetime(new Date());
    const pathname = data.pathname?.trim() ? data.pathname.trim() : telegramMessageTemplate.fallbacks.pathname;

    const {labels} = telegramMessageTemplate;

    const quote = (text: string) => `<blockquote>${escapeHtml(text)}</blockquote>`;
    const bold = (text: string) => `<b>${escapeHtml(text)}</b>`;

    return [
        telegramMessageTemplate.title,
        '',
        formatTelegramField(labels.name, bold(data.name)),
        formatTelegramField(labels.phone, escapeHtml(phone)),
        formatTelegramField(labels.direction, escapeHtml(direction)),
        '',
        `<b>${labels.comment}</b>`,
        quote(message),
        '',
        telegramMessageTemplate.separator,
        formatTelegramField(labels.source, telegramMessageTemplate.source),
        formatTelegramField(labels.page, escapeHtml(pathname)),
        formatTelegramField(labels.date, escapeHtml(datetime)),
    ].join('\n');
};

const buildQuizMessage = (data: TelegramLead): string => {
    const phone = formatPhone(data.phone);
    const datetime = formatDatetime(new Date());

    const {labels, questions} = telegramQuizMessageTemplate;
    const answers = data.quizAnswers;

    const lines: string[] = [
        telegramQuizMessageTemplate.title,
        '',
        formatTelegramField(labels.name, escapeHtml(data.name)),
        formatTelegramField(labels.phone, escapeHtml(phone)),
    ];

    const appendSection = (question: string, answer: string): void => {
        lines.push(
            '',
            `${labels.questionPrefix} <b>${escapeHtml(question)}</b>`,
            '',
            `${labels.answerPrefix} ${answer}`,
        );
    };

    if (answers?.objectType) {
        appendSection(questions.object, escapeHtml(answers.objectType));
    }

    if (answers?.area) {
        appendSection(questions.area, escapeHtml(answers.area));
    }

    if (answers?.systems?.length) {
        const systemsText = answers.systems.map(escapeHtml).join(', ');
        appendSection(questions.systems, systemsText);
    }

    lines.push(
        '',
        telegramQuizMessageTemplate.separator,
        formatTelegramField(labels.source, telegramQuizMessageTemplate.source),
        labels.page,
        formatTelegramField(labels.date, escapeHtml(datetime)),
    );

    return lines.join('\n');
};

export type TelegramMessageType = 'consultation' | 'quiz';

const sendTelegramText = async (text: string): Promise<void> => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        throw new Error('Не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    }

    const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
    }
};

export const sendTelegramLead = async (
    data: TelegramLead,
    type: TelegramMessageType = 'consultation'
): Promise<void> => {
    const text = type === 'quiz' ? buildQuizMessage(data) : buildConsultationMessage(data);

    await sendTelegramText(text);
};
