import type {MonitorEventType, MonitorObjectEvent} from './contracts';
import {
    fetchEventJournalPage,
    type EventJournalCursor,
    type EventJournalDirection,
    type EventJournalPage,
    type JournalEntry,
} from './event-journal.ts';

/**
 * Демонстрационный журнал событий объектов. Все записи вымышлены и
 * сгенерированы детерминированно для прототипа; они не являются данными
 * реальной системы мониторинга или GEORITM.
 *
 * Журнал состоит из двух частей: небольшого набора записей, написанных
 * вручную (старые сценарии прототипа), и детерминированной глубокой
 * истории (E10) — более 1000 записей у «Белочки» и «Ромашки», чтобы
 * постраничная загрузка, фильтры и конец истории проверялись без
 * реального GEORITM. Генерация фиксированным зерном: состав и порядок
 * страниц не меняются между запусками и перезагрузками.
 */

const DEMO_EVENTS: readonly MonitorObjectEvent[] = [
    // ——— Магазин «Белочка» ———
    {
        id: 'demo-event-belochka-1',
        objectId: 'demo-object-magazin-belochka',
        occurredAt: '2026-10-24T09:40:00+03:00',
        type: 'system',
        message: 'Выполнена регламентная самопроверка панели',
    },
    {
        id: 'demo-event-belochka-2',
        objectId: 'demo-object-magazin-belochka',
        occurredAt: '2026-10-24T09:12:00+03:00',
        type: 'security_armed',
        message: 'Зона поставлена под охрану',
        zoneName: 'Склад',
    },
    {
        id: 'demo-event-belochka-3',
        objectId: 'demo-object-magazin-belochka',
        occurredAt: '2026-10-24T08:58:00+03:00',
        type: 'security_disarmed',
        message: 'Зона снята с охраны',
        zoneName: 'Торговый зал',
    },
    {
        id: 'demo-event-belochka-4',
        objectId: 'demo-object-magazin-belochka',
        occurredAt: '2026-10-24T08:30:00+03:00',
        type: 'connection_restored',
        message: 'Связь с объектом восстановлена',
    },
    {
        id: 'demo-event-belochka-5',
        objectId: 'demo-object-magazin-belochka',
        occurredAt: '2026-10-24T08:22:00+03:00',
        type: 'connection_lost',
        message: 'Потеря связи с объектом (проверка канала)',
    },
    {
        id: 'demo-event-belochka-6',
        objectId: 'demo-object-magazin-belochka',
        occurredAt: '2026-10-23T21:05:00+03:00',
        type: 'security_armed',
        message: 'Зона поставлена под охрану',
        zoneName: 'Торговый зал',
    },
    {
        id: 'demo-event-belochka-7',
        objectId: 'demo-object-magazin-belochka',
        occurredAt: '2026-10-23T20:47:00+03:00',
        type: 'fire_fault',
        message: 'Неисправность шлейфа пожарной сигнализации',
        zoneName: 'Дымовые извещатели — склад',
    },
    {
        id: 'demo-event-belochka-8',
        objectId: 'demo-object-magazin-belochka',
        occurredAt: '2026-10-23T19:00:00+03:00',
        type: 'security_disarmed',
        message: 'Зона снята с охраны',
        zoneName: 'Склад',
    },

    // ——— Магазин «Ромашка» ———
    {
        id: 'demo-event-romashka-1',
        objectId: 'demo-object-magazin-romashka',
        occurredAt: '2026-10-24T10:15:00+03:00',
        type: 'security_fault',
        message: 'Неисправность охранного шлейфа',
        zoneName: 'Зона приёмки товара',
    },
    {
        id: 'demo-event-romashka-2',
        objectId: 'demo-object-magazin-romashka',
        occurredAt: '2026-10-24T09:50:00+03:00',
        type: 'fire_maintenance',
        message: 'Начаты регламентные работы',
        zoneName: 'Тепловые извещатели — склад',
    },
    {
        id: 'demo-event-romashka-3',
        objectId: 'demo-object-magazin-romashka',
        occurredAt: '2026-10-24T09:02:00+03:00',
        type: 'connection_restored',
        message: 'Связь с объектом восстановлена',
    },
    {
        id: 'demo-event-romashka-4',
        objectId: 'demo-object-magazin-romashka',
        occurredAt: '2026-10-24T08:47:00+03:00',
        type: 'connection_lost',
        message: 'Потеря связи с объектом',
    },
    {
        id: 'demo-event-romashka-5',
        objectId: 'demo-object-magazin-romashka',
        occurredAt: '2026-10-24T08:15:00+03:00',
        type: 'security_armed',
        message: 'Зона поставлена под охрану',
        zoneName: 'Торговый зал',
    },
    {
        id: 'demo-event-romashka-6',
        objectId: 'demo-object-magazin-romashka',
        occurredAt: '2026-10-23T22:00:00+03:00',
        type: 'security_armed',
        message: 'Зона поставлена под охрану',
        zoneName: 'Витрина',
    },
    {
        id: 'demo-event-romashka-7',
        objectId: 'demo-object-magazin-romashka',
        occurredAt: '2026-10-23T16:40:00+03:00',
        type: 'security_alarm',
        message: 'Сработала охранная сигнализация',
        zoneName: 'Торговый зал',
    },
    {
        id: 'demo-event-romashka-8',
        objectId: 'demo-object-magazin-romashka',
        occurredAt: '2026-10-23T12:00:00+03:00',
        type: 'system',
        message: 'Тестирование системы оповещения выполнено',
    },

    // ——— Склад «Западный» (не привязан к демо-пользователям) ———
    {
        id: 'demo-event-sklad-1',
        objectId: 'demo-object-sklad-zapadnyy',
        occurredAt: '2026-10-23T17:05:00+03:00',
        type: 'connection_lost',
        message: 'Потеря связи с объектом',
    },
    {
        id: 'demo-event-sklad-2',
        objectId: 'demo-object-sklad-zapadnyy',
        occurredAt: '2026-10-23T16:58:00+03:00',
        type: 'security_alarm',
        message: 'Сработала охранная сигнализация',
        zoneName: 'Пролёт Б',
    },
    {
        id: 'demo-event-sklad-3',
        objectId: 'demo-object-sklad-zapadnyy',
        occurredAt: '2026-10-23T15:30:00+03:00',
        type: 'fire_fault',
        message: 'Неисправность извещателей',
        zoneName: 'Извещатели — пролёт А',
    },
    {
        id: 'demo-event-sklad-4',
        objectId: 'demo-object-sklad-zapadnyy',
        occurredAt: '2026-10-23T09:00:00+03:00',
        type: 'security_armed',
        message: 'Зона поставлена под охрану',
        zoneName: 'Периметр',
    },
];

/** Все допустимые значения типа события (для валидации фильтра). */
export const DEMO_EVENT_TYPES: readonly MonitorEventType[] = [
    'security_armed',
    'security_disarmed',
    'security_alarm',
    'security_fault',
    'fire_alarm',
    'fire_fault',
    'fire_maintenance',
    'connection_lost',
    'connection_restored',
    'restored',
    'system',
];

export const isMonitorEventType = (value: string): value is MonitorEventType =>
    (DEMO_EVENT_TYPES as readonly string[]).includes(value);

// ———————————————— Детерминированная глубокая история (E10) ————————

/**
 * Параметры генерации по объекту: количество записей и момент, раньше
 * которого строится история (все handcrafted-записи объекта остаются
 * новее сгенерированных). У «Гвоздики» история не генерируется — пустой
 * журнал остаётся отдельным демонстрационным сценарием.
 */
const GENERATED_HISTORY: Readonly<Record<string, {count: number; startIso: string; zones: readonly string[]}>> = {
    'demo-object-magazin-belochka': {
        count: 1450,
        startIso: '2026-10-23T18:00:00+03:00',
        zones: ['Торговый зал', 'Склад', 'Подсобное помещение'],
    },
    'demo-object-magazin-romashka': {
        count: 1150,
        startIso: '2026-10-23T11:00:00+03:00',
        zones: ['Торговый зал', 'Витрина', 'Зона приёмки товара'],
    },
    'demo-object-sklad-zapadnyy': {
        count: 320,
        startIso: '2026-10-23T08:00:00+03:00',
        zones: ['Периметр', 'Пролёт А', 'Пролёт Б'],
    },
};

/** Детерминированный PRNG (mulberry32): одинаковые страницы между запусками. */
const mulberry32 = (seed: number): (() => number) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** Стабильное зерно из id объекта (без зависимости от окружения). */
const seedFromId = (objectId: string): number => {
    let hash = 2166136261;
    for (let index = 0; index < objectId.length; index++) {
        hash ^= objectId.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

/** Тип события и его вес в генерации (вымышленное распределение). */
const GENERATED_TYPE_WEIGHTS: readonly (readonly [MonitorEventType, number])[] = [
    ['system', 20],
    ['security_armed', 12],
    ['security_disarmed', 12],
    ['restored', 12],
    ['security_fault', 12],
    ['connection_lost', 8],
    ['connection_restored', 8],
    ['security_alarm', 6],
    ['fire_fault', 5],
    ['fire_maintenance', 3],
    ['fire_alarm', 2],
];

/** Код события, показываемый в журнале (вымышленный, по смыслу типа). */
const GENERATED_TYPE_CODE: Readonly<Record<MonitorEventType, string>> = {
    security_armed: '402.3',
    security_disarmed: '402.1',
    security_alarm: '139.1',
    security_fault: '301.1',
    fire_alarm: '1101.1',
    fire_fault: '1109.1',
    fire_maintenance: '1113.1',
    connection_lost: '761.1',
    connection_restored: '761.3',
    restored: '403.1',
    system: '602.1',
};

const GENERATED_TYPE_MESSAGES: Readonly<Record<MonitorEventType, readonly string[]>> = {
    security_armed: ['Раздел поставлен на охрану', 'Зона поставлена под охрану'],
    security_disarmed: ['Раздел снят с охраны', 'Зона снята с охраны'],
    security_alarm: ['Сработала охранная сигнализация', 'Тревога: вскрытие корпуса прибора'],
    security_fault: ['Неисправность охранного шлейфа', 'Внимание: неисправность сети 220'],
    fire_alarm: ['Сработала пожарная сигнализация'],
    fire_fault: ['Неисправность шлейфа пожарной сигнализации'],
    fire_maintenance: ['Начаты регламентные работы'],
    connection_lost: ['Потеря связи с объектом'],
    connection_restored: ['Связь с объектом восстановлена'],
    restored: ['Восстановление: состояние нормализовалось'],
    system: ['Выполнена регламентная самопроверка панели', 'Выход из режима программирования'],
};

const OPERATOR_NAME = 'Дежурный оператор';
const OPERATOR_COMMENTS: readonly string[] = [
    'Тревога сброшена после проверки с объектом',
    'Комментарий: связь проверена, объект на связи',
];

/**
 * Сборка сгенерированной истории объекта. Каждая 25-я пара записей
 * намеренно получает одинаковую метку времени — групповые события
 * (потеря/восстановление связи одной секунды) реально встречаются в
 * журналах GEORITM, и на них проверяется skip-механика границ страниц.
 */
const generateDemoHistory = (objectId: string, count: number, startIso: string, zones: readonly string[]): MonitorObjectEvent[] => {
    const random = mulberry32(seedFromId(objectId));
    const events: MonitorObjectEvent[] = [];
    let occurredMs = Date.parse(startIso);
    let previousType: MonitorEventType | null = null;

    for (let index = 0; index < count; index++) {
        let type: MonitorEventType;
        if (previousType === 'connection_lost' && random() < 0.8) {
            type = 'connection_restored';
        } else {
            const roll = random() * GENERATED_TYPE_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
            let accumulator = 0;
            type = 'system';
            for (const [candidate, weight] of GENERATED_TYPE_WEIGHTS) {
                accumulator += weight;
                if (roll < accumulator) {
                    type = candidate;
                    break;
                }
            }
        }

        const messages = GENERATED_TYPE_MESSAGES[type];
        const isUserAction = random() < 0.025;
        const zoneName = type === 'security_alarm' || type === 'security_armed' || type === 'security_disarmed' || type === 'security_fault'
            ? zones[Math.floor(random() * zones.length)]
            : undefined;
        const sameTimestamp = index > 0 && index % 25 === 0 && events[index - 1] !== undefined;

        const occurredAt = new Date(sameTimestamp ? (events[index - 1] as MonitorObjectEvent).occurredAt : occurredMs).toISOString();
        const receivedAt = new Date(Date.parse(occurredAt) + 1000 + Math.floor(random() * 4000)).toISOString();

        events.push({
            id: `demo-event-${objectId}-gen-${index}`,
            objectId,
            occurredAt,
            type: isUserAction ? 'system' : type,
            message: isUserAction
                ? OPERATOR_COMMENTS[Math.floor(random() * OPERATOR_COMMENTS.length)]
                : messages[Math.floor(random() * messages.length)],
            zoneName,
            receivedAt,
            code: isUserAction ? undefined : GENERATED_TYPE_CODE[type],
            isAlarm: type === 'security_alarm' || type === 'fire_alarm' ? true : undefined,
            isUserAction: isUserAction || undefined,
            userName: isUserAction ? OPERATOR_NAME : undefined,
        });

        previousType = type;
        // Пауза до следующей записи: от 2 минут до суток, гуще к вечеру не моделируем.
        occurredMs -= Math.floor(2 * 60_000 + random() * random() * 24 * 60 * 60_000);
    }

    return events;
};

/** Полный журнал демо-объекта (handcrafted + сгенерированный), от новых к старым. */
const fullDemoEvents = (objectId: string): MonitorObjectEvent[] => {
    const generated = GENERATED_HISTORY[objectId];
    const all = generated
        ? [...DEMO_EVENTS, ...generateDemoHistory(objectId, generated.count, generated.startIso, generated.zones)]
        : DEMO_EVENTS;
    return all
        .filter((event) => event.objectId === objectId)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
};

/** Запись для движка постраничной загрузки: демо ключируется временем события. */
const toJournalEntry = (event: MonitorObjectEvent): JournalEntry => ({
    event,
    receivedAtMs: Date.parse(event.occurredAt),
});

/**
 * События объекта, от новых к старым. Вызывается только после проверки
 * принадлежности объекта пользователю. Необязательный фильтр — по типу.
 * Используется отчётами (полный журнал за период) и как «голова»/окно
 * постраничного движка.
 */
export const getDemoEventsForObject = (
    objectId: string,
    eventType?: MonitorEventType,
): MonitorObjectEvent[] => {
    return fullDemoEvents(objectId)
        .filter((event) => !eventType || event.type === eventType);
};

/**
 * Постраничная порция демо-журнала (E10) через общий движок
 * event-journal: у демо-источника те же сквозные окна и якоря, что и у
 * GEORITM-источника, поэтому поведение страниц (в том числе края и
 * дубликаты меток) совпадает в обоих режимах.
 */
export const getDemoEventJournalPage = async (
    objectId: string,
    pageSize: number,
    eventType: MonitorEventType | undefined,
    cursor: EventJournalCursor | null,
    direction: EventJournalDirection,
): Promise<EventJournalPage> =>
    fetchEventJournalPage({
        pageSize,
        eventType,
        cursor,
        direction,
        windowFetch: async (fromMs, toMs) =>
            fullDemoEvents(objectId)
                .filter((event) => {
                    const ms = Date.parse(event.occurredAt);
                    return ms >= fromMs && ms <= toMs;
                })
                .map(toJournalEntry),
        headFetch: async () => ({
            entries: fullDemoEvents(objectId).map(toJournalEntry),
            capped: false,
        }),
    });

/** Типы, встречающиеся в полном журнале объекта (для чипов фильтра). */
export const getDemoEventTypesForObject = (objectId: string): MonitorEventType[] => {
    const present = new Set(fullDemoEvents(objectId).map((event) => event.type));
    return DEMO_EVENT_TYPES.filter((type) => present.has(type));
};

/** Общее количество записей журнала после фильтра (демо-источник знает точно). */
export const countDemoEventsForObject = (objectId: string, eventType?: MonitorEventType): number =>
    getDemoEventsForObject(objectId, eventType).length;

/** Результат постраничной загрузки демо-журнала (форма совпадает с GEORITM-источником). */
export interface DemoEventsPage {
    page: EventJournalPage;
    availableTypes: MonitorEventType[];
    /** У демо-источника точное количество известно всегда. */
    totalEvents: number | null;
}

/**
 * Постраничная порция демо-журнала со справочными данными UI: демо знает
 * полный журнал, поэтому totalEvents точен и availableTypes полны.
 */
export const getDemoEventsPageForObject = async (
    objectId: string,
    pageSize: number,
    eventType: MonitorEventType | undefined,
    cursor: EventJournalCursor | null,
    direction: EventJournalDirection,
): Promise<DemoEventsPage> => {
    const page = await getDemoEventJournalPage(objectId, pageSize, eventType, cursor, direction);
    return {
        page,
        availableTypes: getDemoEventTypesForObject(objectId),
        totalEvents: countDemoEventsForObject(objectId, eventType),
    };
};
