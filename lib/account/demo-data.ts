import {createHash, timingSafeEqual} from 'node:crypto';
import type {DemoMonitorObject, DemoObjectZone, PublicAccountUser} from './contracts';

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

const DEMO_OBJECTS: readonly DemoMonitorObject[] = [
    {
        id: 'demo-object-magazin-belochka',
        name: 'Магазин «Белочка»',
        address: 'г. Электросталь, ул. Мира, д. 12',
        securityAlarm: 'disarmed',
        fireAlarm: 'normal',
        connection: 'online',
        updatedAt: '2026-10-24T09:40:00+03:00',
    },
    {
        id: 'demo-object-magazin-romashka',
        name: 'Магазин «Ромашка»',
        address: 'г. Электросталь, просп. Ленина, д. 30',
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
        securityAlarm: 'alarm',
        fireAlarm: 'fault',
        connection: 'offline',
        updatedAt: '2026-10-23T17:05:00+03:00',
    },
];

/**
 * Демонстрационные зоны объектов. Состояния зон вымышлены; у каждой зоны
 * явно указана система (охранная/пожарная) и типизированное состояние.
 */
const DEMO_ZONES: Readonly<Record<string, readonly DemoObjectZone[]>> = {
    'demo-object-magazin-belochka': [
        {id: 'demo-zone-belochka-1', name: 'Торговый зал', system: 'security', state: 'disarmed'},
        {id: 'demo-zone-belochka-2', name: 'Склад', system: 'security', state: 'armed'},
        {id: 'demo-zone-belochka-3', name: 'Подсобное помещение', system: 'security', state: 'fault'},
        {id: 'demo-zone-belochka-4', name: 'Дымовые извещатели — торговый зал', system: 'fire', state: 'normal'},
        {id: 'demo-zone-belochka-5', name: 'Дымовые извещатели — склад', system: 'fire', state: 'maintenance'},
    ],
    'demo-object-magazin-romashka': [
        {id: 'demo-zone-romashka-1', name: 'Торговый зал', system: 'security', state: 'armed'},
        {id: 'demo-zone-romashka-2', name: 'Витрина', system: 'security', state: 'armed'},
        {id: 'demo-zone-romashka-3', name: 'Зона приёмки товара', system: 'security', state: 'fault'},
        {id: 'demo-zone-romashka-4', name: 'Тепловые извещатели — торговый зал', system: 'fire', state: 'normal'},
        {id: 'demo-zone-romashka-5', name: 'Тепловые извещатели — склад', system: 'fire', state: 'maintenance'},
    ],
    'demo-object-sklad-zapadnyy': [
        {id: 'demo-zone-sklad-1', name: 'Периметр', system: 'security', state: 'armed'},
        {id: 'demo-zone-sklad-2', name: 'Пролёт А', system: 'security', state: 'armed'},
        {id: 'demo-zone-sklad-3', name: 'Пролёт Б', system: 'security', state: 'alarm'},
        {id: 'demo-zone-sklad-4', name: 'Извещатели — пролёт А', system: 'fire', state: 'fault'},
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
export const getDemoObjectsForUser = (userId: string): DemoMonitorObject[] => {
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
export const findDemoObjectForUser = (userId: string, objectId: string): DemoMonitorObject | null => {
    const user = findDemoUserById(userId);
    if (!user || !user.objectIds.includes(objectId)) {
        return null;
    }

    return DEMO_OBJECTS.find((object) => object.id === objectId) ?? null;
};

/** Зоны объекта. Вызывается только после проверки принадлежности объекта. */
export const getDemoZonesForObject = (objectId: string): DemoObjectZone[] => {
    return [...(DEMO_ZONES[objectId] ?? [])];
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
