import {NextRequest, NextResponse} from 'next/server';
import {sendTelegramLead} from '@/lib/telegram';
import {QuizLeadAnswers, TelegramLead} from '@/types/telegram';

export const runtime = 'nodejs';

interface TelegramLeadRequest {
    name?: string;
    phone?: string;
    direction?: string;
    message?: string;
    pathname?: string;
    type?: string;
    quizAnswers?: QuizLeadAnswers;
    turnstileToken?: string;
    website?: string;
}

interface TurnstileVerifyResponse {
    success?: boolean;
    hostname?: string;
    action?: string;
    'challenge_ts'?: string;
    'error-codes'?: string[];
}

/**
 * Проверяет токен Cloudflare Turnstile через официальный endpoint siteverify.
 * Использует обычный fetch, без сторонних библиотек.
 */
const verifyTurnstile = async (token: string): Promise<boolean> => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
        console.error('Turnstile secret key is missing. TURNSTILE_SECRET_KEY env var is not set.');
        return false;
    }

    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);

    let data: TurnstileVerifyResponse;
    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: form.toString(),
        });

        if (!response.ok) {
            console.error(`Turnstile siteverify returned non-OK status: ${response.status} ${response.statusText}`);
            return false;
        }

        data = (await response.json()) as TurnstileVerifyResponse;
    } catch (error) {
        console.error('Turnstile fetch failed:', error);
        return false;
    }

    if (data.success !== true) {
        console.error('Turnstile verification failed. error-codes:', data['error-codes']);
        return false;
    }

    return true;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
    try {
        const body = (await request.json()) as TelegramLeadRequest | null;
        const {name, phone, direction, message, pathname, type, quizAnswers, turnstileToken, website} =
        body ?? {};

        // 1. Проверка Honeypot — если скрытое поле заполнено, считаем запрос ботом
        // и молча возвращаем успех, чтобы бот не понял, что заблокирован.
        if (website && website.trim().length > 0) {
            return NextResponse.json({success: true}, {status: 200});
        }

        // 2. Проверка Turnstile
        if (!turnstileToken) {
            console.error('Request rejected: turnstileToken is missing.');
            return NextResponse.json({success: false}, {status: 403});
        }
        const turnstileValid = await verifyTurnstile(turnstileToken);
        if (!turnstileValid) {
            console.error('Request rejected: Turnstile verification failed.');
            return NextResponse.json({success: false}, {status: 403});
        }

        // 3. Валидация обязательных полей
        if (!name || !phone || !direction) {
            return NextResponse.json({success: false}, {status: 400});
        }

        // 4. Отправка в Telegram
        const lead: TelegramLead = {
            name,
            phone,
            direction,
            message,
            pathname: pathname ?? '',
            quizAnswers,
        };

        await sendTelegramLead(lead, type === 'quiz' ? 'quiz' : 'consultation');

        return NextResponse.json({success: true}, {status: 200});
    } catch (error) {
        console.error('API /api/telegram ERROR:', error);

        return NextResponse.json(
            {success: false},
            {status: 500}
        );
    }
};
