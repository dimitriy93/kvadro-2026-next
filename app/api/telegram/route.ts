import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramLead } from '@/lib/telegram';
import { TelegramLead } from '@/types/telegram';

export const runtime = 'nodejs';

interface TelegramLeadRequest {
    name?: string;
    phone?: string;
    direction?: string;
    message?: string;
    pathname?: string;
}

export const POST = async (request: NextRequest): Promise<NextResponse> => {
    try {
        const body = (await request.json()) as TelegramLeadRequest | null;

        const { name, phone, direction, message, pathname } = body ?? {};

        if (!name || !phone || !direction) {
            return NextResponse.json({ success: false }, { status: 400 });
        }

        const lead: TelegramLead = {
            name,
            phone,
            direction,
            message,
            pathname: pathname ?? '',
        };

        await sendTelegramLead(lead);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch {
        return NextResponse.json({ success: false }, { status: 500 });
    }
};
