import type {DemoEventType, DemoObjectEvent} from './contracts';

/**
 * Демонстрационный журнал событий объектов. Все записи вымышлены и
 * сгенерированы вручную для прототипа; они не являются данными реальной
 * системы мониторинга или GEORITM.
 */

const DEMO_EVENTS: readonly DemoObjectEvent[] = [
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
export const DEMO_EVENT_TYPES: readonly DemoEventType[] = [
    'security_armed',
    'security_disarmed',
    'security_alarm',
    'security_fault',
    'fire_alarm',
    'fire_fault',
    'fire_maintenance',
    'connection_lost',
    'connection_restored',
    'system',
];

export const isDemoEventType = (value: string): value is DemoEventType =>
    (DEMO_EVENT_TYPES as readonly string[]).includes(value);

/**
 * События объекта, от новых к старым. Вызывается только после проверки
 * принадлежности объекта пользователю. Необязательный фильтр — по типу.
 */
export const getDemoEventsForObject = (
    objectId: string,
    eventType?: DemoEventType,
): DemoObjectEvent[] => {
    return DEMO_EVENTS
        .filter((event) => event.objectId === objectId)
        .filter((event) => !eventType || event.type === eventType)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
};
