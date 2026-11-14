import {createHash, timingSafeEqual} from 'node:crypto';
import type {
    MonitorObject,
    MonitorObjectEvent,
    ObjectFault,
    ObjectReportFile,
    ObjectReportRequest,
    ObjectZoneSection,
    PublicAccountUser,
} from './contracts';
import {getDemoEventsForObject} from './demo-events';

/**
 * Демонстрационный источник данных личного кабинета.
 *
 * Только для серверного кода: модуль содержит фиктивные пароли тестовых
 * учётных записей и список полномочий пользователя. Не импортировать в
 * клиентские компоненты. Все данные вымышлены и не связаны с GEORITM.
 */

/** Тестовая учётная запись прототипа (серверная сторона, с паролем). */
interface DemoAccountUser {
    id: string;
    login: string;
    /** Фиктивный пароль исключительно для локального прототипа. */
    password: string;
    displayName: string;
    /** Объекты, доступные пользователю. Источник полномочий — только здесь. */
    objectIds: readonly string[];
}

const DEMO_USERS: readonly DemoAccountUser[] = [
    {
        id: 'demo-user-belochka',
        login: 'belochka',
        password: 'demo-belochka',
        displayName: 'Директор магазина «Белочка»',
        objectIds: ['demo-object-magazin-belochka'],
    },
    {
        id: 'demo-user-romashka',
        login: 'romashka',
        password: 'demo-romashka',
        displayName: 'Директор магазина «Ромашка»',
        objectIds: ['demo-object-magazin-romashka'],
    },
];

const DEMO_OBJECTS: readonly MonitorObject[] = [
    {
        id: 'demo-object-magazin-belochka',
        name: 'Магазин «Белочка»',
        address: 'г. Электросталь, ул. Мира, д. 12',
        device: {name: 'Прибор контроля «Демо-12»', shortName: 'Демо-12', firmware: '1.4.2'},
        securityAlarm: 'disarmed',
        fireAlarm: 'normal',
        connection: 'online',
        updatedAt: '2026-10-24T09:40:00+03:00',
    },
    {
        id: 'demo-object-magazin-romashka',
        name: 'Магазин «Ромашка»',
        address: 'г. Электросталь, просп. Ленина, д. 30',
        device: {name: 'Прибор контроля «Демо-12»', shortName: 'Демо-12', firmware: '1.4.2'},
        securityAlarm: 'armed',
        fireAlarm: 'normal',
        connection: 'unstable',
        updatedAt: '2026-10-24T08:15:00+03:00',
    },
    {
        // Существует в демо-данных, но не привязан ни к одному пользователю —
        // сценарий проверки изоляции доступа.
        id: 'demo-object-sklad-zapadnyy',
        name: 'Склад «Западный»',
        address: 'г. Электросталь, Западная промзона, корп. 4',
        device: {name: 'Прибор контроля «Демо-16»', shortName: 'Демо-16', firmware: '2.0.1'},
        securityAlarm: 'alarm',
        fireAlarm: 'fault',
        connection: 'offline',
        updatedAt: '2026-10-23T17:05:00+03:00',
    },
];

/**
 * Демонстрационные активные неисправности оборудования (E4.2). Структура
 * повторяет модель GEORITM obj-faults/ (код + текст + раздел/зона), но все
 * значения вымышлены и не являются кодами реального прибора. У «Ромашки»
 * неисправностей нет — успешный пустой ответ.
 */
const DEMO_DIAGNOSTICS: Readonly<Record<string, readonly ObjectFault[]>> = {
    'demo-object-magazin-belochka': [
        {
            id: 'demo-fault-belochka-301',
            code: 301,
            message: 'Внимание: Неисправность сети 220',
            areaNum: 0,
            zoneNum: 0,
        },
        {
            id: 'demo-fault-belochka-302',
            code: 302,
            message: 'Внимание: Разряд аккумулятора',
            areaNum: 0,
            zoneNum: 0,
        },
    ],
    'demo-object-magazin-romashka': [],
    'demo-object-sklad-zapadnyy': [
        {
            id: 'demo-fault-sklad-301',
            code: 301,
            message: 'Внимание: Неисправность сети 220',
            areaNum: 0,
            zoneNum: 0,
        },
    ],
};

/**
 * Демонстрационные разделы и зоны объектов. Состояния вымышлены; у каждой
 * зоны явно указана система (охранная/пожарная) и типизированное состояние.
 * Структура повторяет модель GEORITM (раздел → зоны) и служит примером
 * иерархии, но не является данными реального оборудования.
 */
const DEMO_ZONES: Readonly<Record<string, readonly ObjectZoneSection[]>> = {
    'demo-object-magazin-belochka': [
        {
            id: 'demo-section-belochka-1',
            num: 1,
            name: 'Торговый зал',
            state: 'disarmed',
            zones: [
                {id: 'demo-zone-belochka-1', num: 1, name: 'Торговый зал', system: 'security', state: 'disarmed'},
                {
                    id: 'demo-zone-belochka-4',
                    num: 4,
                    name: 'Дымовые извещатели — торговый зал',
                    system: 'fire',
                    state: 'normal',
                },
            ],
        },
        {
            id: 'demo-section-belochka-2',
            num: 2,
            name: 'Склад',
            state: 'armed',
            zones: [
                {id: 'demo-zone-belochka-2', num: 2, name: 'Склад', system: 'security', state: 'armed'},
                {
                    id: 'demo-zone-belochka-5',
                    num: 5,
                    name: 'Дымовые извещатели — склад',
                    system: 'fire',
                    state: 'maintenance',
                },
            ],
        },
        {
            id: 'demo-section-belochka-3',
            num: 3,
            name: 'Подсобное помещение',
            comment: 'Требуется проверка шлейфа',
            state: 'fault',
            zones: [
                {id: 'demo-zone-belochka-3', num: 3, name: 'Подсобное помещение', system: 'security', state: 'fault'},
            ],
        },
    ],
    'demo-object-magazin-romashka': [
        {
            id: 'demo-section-romashka-1',
            num: 1,
            name: 'Торговый зал',
            state: 'armed',
            zones: [
                {id: 'demo-zone-romashka-1', num: 1, name: 'Торговый зал', system: 'security', state: 'armed'},
                {id: 'demo-zone-romashka-2', num: 2, name: 'Витрина', system: 'security', state: 'armed'},
                {
                    id: 'demo-zone-romashka-4',
                    num: 4,
                    name: 'Тепловые извещатели — торговый зал',
                    system: 'fire',
                    state: 'normal',
                },
            ],
        },
        {
            id: 'demo-section-romashka-2',
            num: 2,
            name: 'Служебные помещения',
            state: 'armed',
            zones: [
                {id: 'demo-zone-romashka-3', num: 3, name: 'Зона приёмки товара', system: 'security', state: 'fault'},
                {
                    id: 'demo-zone-romashka-5',
                    num: 5,
                    name: 'Тепловые извещатели — склад',
                    system: 'fire',
                    state: 'maintenance',
                },
            ],
        },
    ],
    'demo-object-sklad-zapadnyy': [
        {
            id: 'demo-section-sklad-1',
            num: 1,
            name: 'Периметр',
            state: 'armed',
            zones: [{id: 'demo-zone-sklad-1', num: 1, name: 'Периметр', system: 'security', state: 'armed'}],
        },
        {
            id: 'demo-section-sklad-2',
            num: 2,
            name: 'Пролёт А',
            state: 'armed',
            zones: [
                {id: 'demo-zone-sklad-2', num: 2, name: 'Пролёт А', system: 'security', state: 'armed'},
                {id: 'demo-zone-sklad-4', num: 4, name: 'Извещатели — пролёт А', system: 'fire', state: 'fault'},
            ],
        },
        {
            id: 'demo-section-sklad-3',
            num: 3,
            name: 'Пролёт Б',
            state: 'alarm',
            zones: [{id: 'demo-zone-sklad-3', num: 3, name: 'Пролёт Б', system: 'security', state: 'alarm'}],
        },
    ],
};

const toPublicAccountUser = (user: DemoAccountUser): PublicAccountUser => ({
    id: user.id,
    login: user.login,
    displayName: user.displayName,
});

/** Пользователь по внутреннему id (или null). */
export const findDemoUserById = (id: string): DemoAccountUser | null =>
    DEMO_USERS.find((user) => user.id === id) ?? null;

/** Пользователь по логину (регистр не важен; или null). */
export const findDemoUserByLogin = (login: string): DemoAccountUser | null =>
    DEMO_USERS.find((user) => user.login === login.toLowerCase()) ?? null;

/** Публичное (без секретов) представление пользователя по id. */
export const findPublicDemoUserById = (id: string): PublicAccountUser | null => {
    const user = findDemoUserById(id);
    return user ? toPublicAccountUser(user) : null;
};

/**
 * Проверка демо-учётных данных. Сравнение через SHA-256 + timingSafeEqual;
 * при неизвестном логине выполняется фиктивное сравнение, чтобы не выдавать
 * существование логина по времени ответа.
 */
export const verifyDemoCredentials = (login: string, password: string): PublicAccountUser | null => {
    const user = findDemoUserByLogin(login);
    const expected = user ? user.password : 'demo-invalid-placeholder';

    const passwordMatches = timingSafeEqual(
        createHash('sha256').update(password, 'utf8').digest(),
        createHash('sha256').update(expected, 'utf8').digest(),
    );

    return user && passwordMatches ? toPublicAccountUser(user) : null;
};

/**
 * Общая серверная функция разграничения доступа: возвращает только объекты,
 * разрешённые пользователю. Единая точка полномочий для API и страниц кабинета.
 */
export const getDemoObjectsForUser = (userId: string): MonitorObject[] => {
    const user = findDemoUserById(userId);
    if (!user) {
        return [];
    }

    return DEMO_OBJECTS.filter((object) => user.objectIds.includes(object.id));
};

/**
 * Объект по id, только если он разрешён пользователю. Чужой и несуществующий
 * объект неотличимы: в обоих случаях возвращается null — страницы кабинета
 * не раскрывают наличие чужих данных.
 */
export const findDemoObjectForUser = (userId: string, objectId: string): MonitorObject | null => {
    const user = findDemoUserById(userId);
    if (!user || !user.objectIds.includes(objectId)) {
        return null;
    }

    return DEMO_OBJECTS.find((object) => object.id === objectId) ?? null;
};

/** Разделы и зоны объекта. Вызывается только после проверки принадлежности объекта. */
export const getDemoZonesForObject = (objectId: string): ObjectZoneSection[] => {
    return [...(DEMO_ZONES[objectId] ?? [])];
};

/**
 * Активные неисправности объекта. Вызывается после проверки принадлежности;
 * чужой и несуществующий объект неотличимы — пустой список.
 */
export const getDemoDiagnosticsForObject = (objectId: string): ObjectFault[] => {
    return [...(DEMO_DIAGNOSTICS[objectId] ?? [])];
};

// —————————————————————————— Демонстрационные отчёты (E4.3) ————————

/**
 * Демонстрационный отчёт: явный маркер «демо» в первой строке и в имени
 * файла, чтобы вымышленную выгрузку нельзя было принять за файл,
 * сформированный GEORITM. Формат — CSV (UTF-8 с BOM, разделитель «;»):
 * без новых зависимостей валидный PDF/XLSX с кириллицей не собрать, а
 * выдавать их фиктивными версиями недопустимо.
 */
const DEMO_REPORT_MARK = 'ДЕМО-ОТЧЁТ (вымышленные данные, не GEORITM)';

const DEMO_REPORT_META: Readonly<Record<ObjectReportRequest['type'], {title: string; fileLabel: string}>> = {
    'alerts-summary': {title: 'Сводный отчёт по событиям и тревогам', fileLabel: 'svodnyy-otchet'},
    'alerts-events': {title: 'Отчёт по событиям и тревогам', fileLabel: 'otchet-sobytiya'},
};

/** Экранирование поля CSV: кавычки внутри удваиваются, поле берётся в кавычки при спецсимволах. */
const csvField = (value: string): string =>
    /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const csvRow = (fields: ReadonlyArray<string | number>): string =>
    fields.map((field) => csvField(String(field))).join(';');

/** Календарная дата события в МСК — период отчёта задан календарными днями МСК. */
const mskDate = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
};

const eventTypeLabel = (event: MonitorObjectEvent): string => {
    if (event.isUserAction) {
        return 'Действие оператора';
    }
    switch (event.type) {
        case 'security_alarm':
        case 'fire_alarm':
            return 'Тревога';
        case 'security_fault':
        case 'fire_fault':
        case 'fire_maintenance':
            return 'Неисправность';
        case 'security_armed':
            return 'Постановка на охрану';
        case 'security_disarmed':
            return 'Снятие с охраны';
        case 'connection_lost':
            return 'Потеря связи';
        case 'connection_restored':
        case 'restored':
            return 'Восстановление';
        default:
            return 'Система';
    }
};

/**
 * Демонстрационный отчёт объекта по журналу демо-событий за период.
 * Вызывается только после проверки принадлежности объекта; неизвестный
 * объект — исключение (маршрут уже отфильтровал чужие id, попадание сюда
 * означает нарушение инварианта).
 */
export const getDemoReportForObject = (
    objectId: string,
    request: ObjectReportRequest,
): ObjectReportFile => {
    const object = DEMO_OBJECTS.find((candidate) => candidate.id === objectId);
    if (!object) {
        throw new Error(`Демо-отчёт: объект ${objectId} не найден в демо-данных`);
    }

    const meta = DEMO_REPORT_META[request.type];
    const events = getDemoEventsForObject(objectId)
        .filter((event) => {
            const day = mskDate(event.occurredAt);
            return day >= request.from && day <= request.to;
        });

    const lines: string[] = [csvRow([DEMO_REPORT_MARK])];
    lines.push(csvRow(['Отчёт', meta.title]));
    lines.push(csvRow(['Объект', object.name]));
    lines.push(csvRow(['Период', `${request.from} — ${request.to}`]));

    if (request.type === 'alerts-summary') {
        // Сводка за период: количество событий и тревог по календарным дням МСК.
        const byDay = new Map<string, {alerts: number; alarms: number}>();
        for (const event of events) {
            const day = mskDate(event.occurredAt);
            if (day.length === 0) {
                continue;
            }
            const entry = byDay.get(day) ?? {alerts: 0, alarms: 0};
            entry.alerts += 1;
            if (event.isAlarm === true) {
                entry.alarms += 1;
            }
            byDay.set(day, entry);
        }
        lines.push('');
        lines.push(csvRow(['Дата', 'События', 'Тревоги']));
        let totalAlerts = 0;
        let totalAlarms = 0;
        for (const day of [...byDay.keys()].sort()) {
            const entry = byDay.get(day)!;
            totalAlerts += entry.alerts;
            totalAlarms += entry.alarms;
            lines.push(csvRow([day, entry.alerts, entry.alarms]));
        }
        lines.push(csvRow(['Итого', totalAlerts, totalAlarms]));
    } else {
        // Детальный журнал за период (от новых к старым — как источник отдаёт).
        lines.push('');
        lines.push(csvRow(['Дата и время (МСК)', 'Тип', 'Код', 'Сообщение']));
        for (const event of events) {
            lines.push(csvRow([
                mskDate(event.occurredAt),
                eventTypeLabel(event),
                event.code ?? '',
                event.message,
            ]));
        }
    }

    if (events.length === 0) {
        lines.push('');
        lines.push(csvRow(['За выбранный период записей нет']));
    }

    // BOM — чтобы Excel открыл файл как UTF-8.
    const content = new TextEncoder().encode(`\uFEFF${lines.join('\r\n')}\r\n`);

    return {
        filename: `${meta.fileLabel}_${object.name}_${request.from}_${request.to}_demo.csv`,
        contentType: 'text/csv; charset=utf-8',
        content,
    };
};

export interface DemoLoginHint {
    login: string;
    password: string;
    displayName: string;
}

/**
 * Подсказки тестовых учётных записей для формы входа. Используются только
 * вне production (решение принимает серверная страница входа).
 */
export const getDemoLoginHints = (): DemoLoginHint[] =>
    DEMO_USERS.map((user) => ({
        login: user.login,
        password: user.password,
        displayName: user.displayName,
    }));
