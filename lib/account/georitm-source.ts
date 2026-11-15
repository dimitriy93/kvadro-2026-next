import {cookies} from 'next/headers';
import {cache} from 'react';
import type {
    CommunicationChannel,
    CommunicationDiagnostics,
    MonitorEventType,
    MonitorObject,
    MonitorObjectEvent,
    ObjectDeviceInfo,
    ObjectFault,
    ObjectReportFile,
    ObjectReportRequest,
    ObjectZone,
    ObjectZoneSection,
    PowerDiagnostics,
    PublicAccountUser,
    SecurityAlarmState,
} from './contracts';
import {ACCOUNT_SESSION_COOKIE_NAME} from './session';
import {
    createGeoritmSession,
    deleteSession,
    getSessionRecord,
    type SessionControlPermissions,
} from './session-store';
import {
    fetchEventJournalPage,
    type EventJournalCursor,
    type EventJournalDirection,
    type EventJournalPage,
    type JournalEntry,
} from './event-journal';
import {getAlertTemplatesByCode} from '@/lib/georitm/alert-template-cache';
import type {GeoritmControlContext} from './georitm-control';
import {
    GeoritmApiError,
    callGeoritmReport,
    flattenGeoritmTree,
    georitmChannels,
    georitmHistoryByObject,
    georitmHistoryOnObject,
    georitmLogin,
    georitmLogout,
    georitmObjectCard,
    georitmObjectDetails,
    georitmObjectFaults,
    georitmObjectStatus,
    georitmObjects,
    georitmPartitionsState,
    georitmTreeSet,
    type GeoritmAlertTemplate,
    type GeoritmArea,
    type GeoritmAreaZone,
    type GeoritmChannelSignal,
    type GeoritmChannelsResponse,
    type GeoritmDevice,
    type GeoritmHistoryRecord,
    type GeoritmObjectAlert,
    type GeoritmObjectAlertLog,
    type GeoritmObjectCard,
    type GeoritmObjectDetails,
    type GeoritmObjectFault,
    type GeoritmObjectSummary,
} from '@/lib/georitm/api-client';

/**
 * Источник данных кабинета на GEORITM REST API. Только серверный код:
 * импортирует lib/georitm/api-client и обращается к хранилищу сессий.
 *
 * Изоляция доступа: список объектов пользователя — это ровно то, что
 * вернул GEORITM авторизованному пользователю (objects/objects-tree-set/).
 * Любая выдача данных — после проверки, что объект присутствует в этом
 * списке; чужой и несуществующий объект неотличимы (null).
 *
 * ВАЖНО: изоляция данных между обычными клиентами требует отдельного
 * тестирования с двумя GEORITM-пользователями с разными наборами объектов.
 * Текущий тестовый пользователь — администратор (isAdmin=1), на нём
 * изоляция не подтверждена.
 */

// ————————————————————————— Сессия и авторизация ————————

/**
 * Ошибка авторизации по ответу GEORITM: документированные 400/401 либо
 * фактический 500 с сообщением о неверном пользователе/пароле (наблюдение
 * на сервере 2.27.0).
 */
const isAuthFailure = (error: GeoritmApiError): boolean => {
    if (error.status === 400 || error.status === 401) {
        return true;
    }
    const message = error.serverMessage?.toLowerCase() ?? '';
    return error.status === 500
        && (message.includes('wrong password') || message.includes('not found'));
};

/** Контекст авторизованного GEORITM-пользователя (credentials только здесь). */
interface GeoritmAuth {
    basic: string;
    user: PublicAccountUser;
    sessionId: string;
    /** Проекция прав управления охраной; undefined — сессия до E12. */
    controlPermissions: SessionControlPermissions | undefined;
}

/**
 * Текущий GEORITM-контекст по cookie-сессии. Basic не возвращается наружу
 * за пределы серверных функций этого модуля и api-client.
 */
const resolveGeoritmAuth = async (): Promise<GeoritmAuth | null> => {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(ACCOUNT_SESSION_COOKIE_NAME)?.value;
    if (!sessionId) {
        return null;
    }

    const record = await getSessionRecord(sessionId);
    if (!record) {
        return null;
    }

    return {basic: record.georitmBasic, user: record.user, sessionId, controlPermissions: record.controlPermissions};
};

/** Результат проверки учётных данных: пользователь + значение cookie-сессии. */
export interface VerifiedCredentials {
    user: PublicAccountUser;
    /** Значение для HttpOnly-cookie (у georitm — непрозрачный ID серверной сессии). */
    sessionValue: string;
}

/**
 * Вход через GEORITM: проверка учётных данных на стороне GEORITM и создание
 * серверной сессии. Пароль и Basic не возвращаются и не логируются.
 */
export const verifyGeoritmCredentials = async (
    login: string,
    password: string,
): Promise<VerifiedCredentials | null> => {
    let response;
    try {
        response = await georitmLogin(login, password);
    } catch (error) {
        // Документация обещает 401 на неверные учётные данные, но фактический
        // сервер 2.27.0 возвращает HTTP 500 с сообщением об ошибке входа
        // (расхождение зафиксировано в docs/development/12). Такие ответы
        // считаются «неверным логином или паролем»; прочие ошибки
        // (недоступность, тайм-аут, прочие 500) пробрасываются вызывающей
        // стороне — недоступность API не маскируется под «неверный пароль».
        if (error instanceof GeoritmApiError && isAuthFailure(error)) {
            return null;
        }
        throw error;
    }

    if (!response || typeof response.id !== 'number' || response.disabled === 1) {
        return null;
    }

    // Готовый Basic из ответа; при отсутствии вычисляем сами (значение
    // никогда не логируется и не покидает сервер).
    const basic = typeof response.basic === 'string' && response.basic.length > 0
        ? response.basic
        : Buffer.from(`${login}:${password}`, 'utf8').toString('base64');

    const user: PublicAccountUser = {
        id: String(response.id),
        login,
        displayName: typeof response.username === 'string' && response.username.length > 0
            ? response.username
            : login,
    };

    // Проекция прав управления охраной (E12): только подтверждённые коды
    // objects.arm/objects.disarm из фактического allowedActions ответа.
    // Считаются один раз при входе; связь этих кодов с реальной серверной
    // проверкой write-метода не доказана (E11), поэтому это НЕ единственный
    // признак доступности — дополнительно проверяются canArm объекта и
    // разрешимость IMEI/раздела.
    const actions = Array.isArray(response.allowedActions) ? response.allowedActions : [];
    const controlPermissions: SessionControlPermissions = {
        arm: actions.includes('objects.arm'),
        disarm: actions.includes('objects.disarm'),
    };

    const sessionValue = await createGeoritmSession(user, basic, SESSION_TTL, controlPermissions);
    return {user, sessionValue};
};

/** Завершение GEORITM-сессии: отзыв в хранилище + users/logout/ на сервере. */
export const logoutGeoritm = async (): Promise<void> => {
    const auth = await resolveGeoritmAuth();
    if (!auth) {
        return;
    }
    await deleteSession(auth.sessionId);
    try {
        await georitmLogout(auth.basic);
    } catch {
        // Сессия кабинета уже отозвана; ошибка logout на стороне GEORITM
        // (в т.ч. недоступность) не должна мешать выходу пользователя.
    }
};

/**
 * Отзыв сессии кабинета при 401 от GEORITM. Ошибка записи хранилища
 * (например, ENOSPC/EACCES) не должна ни оставаться необработанным
 * отклонением промиса, ни маскировать исходную ошибку GEORITM:
 * логируется и пробрасывается только 401.
 */
const revokeSessionOnUnauthorized = async (auth: GeoritmAuth): Promise<void> => {
    try {
        await deleteSession(auth.sessionId);
    } catch (error) {
        console.error('GEORITM 401: не удалось отозвать сессию кабинета:', error);
    }
};

const SESSION_TTL = 8 * 60 * 60;

// ——————————————————————————— Маппинг данных ————————

/**
 * securityAlarm из objectState. Приоритет: тревога > неисправность >
 * состояние охраны. isGuarded=2 (частично) → 'partial'.
 */
const mapSecurityAlarm = (object: GeoritmObjectSummary): SecurityAlarmState => {
    const state = object.objectState;
    if (!state) {
        // Состояние не подтверждено — не «норма», а явная неисправность данных.
        return 'fault';
    }
    if ((state.hasAlarm ?? 0) > 0) {
        return 'alarm';
    }
    if ((state.hasFault ?? 0) > 0) {
        return 'fault';
    }
    if (state.isGuarded === 1) {
        return 'armed';
    }
    if (state.isGuarded === 2) {
        return 'partial';
    }
    return 'disarmed';
};

/**
 * Связь с объектом. isOnline отсутствует → 'offline': подтверждённой связи
 * нет; подмена отсутствия данных на «норму» недопустима.
 */
const mapConnection = (object: GeoritmObjectSummary): MonitorObject['connection'] =>
    object.objectState?.isOnline === 1 || object.isGsmOnline === 1 ? 'online' : 'offline';

/**
 * Время последнего обновления. Единицы Timestamp в документации противоречивы
 * (REST-API-ANALYSIS.md, 10.1), поэтому поле заполняется только при числовом
 * значении с однозначной эвристикой; иначе — undefined (UI покажет прочерк).
 */
const mapUpdatedAt = (object: GeoritmObjectSummary): string | undefined => {
    const value = object.lastGSMConnectionTime;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return undefined;
    }
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const mapAddress = (object: GeoritmObjectSummary): string => {
    if (object.addressShort && object.addressShort.length > 0) {
        return object.addressShort;
    }
    const parts = [object.city, object.street, object.house].filter(
        (part) => typeof part === 'string' && part.length > 0,
    );
    return parts.join(', ');
};

/**
 * Прибор объекта — whitelist-проекция devices[] (E4.2, подтверждено на
 * сервере 2.27.0 в objects/obj/): только name/shortName/firmware. Остальные
 * поля записи прибора, включая imei, в DTO не переносятся. Первый прибор
 * без внятного имени пропускается; пустой результат — «нет данных», не норма.
 */
const toDeviceInfo = (object: GeoritmObjectSummary): ObjectDeviceInfo | undefined => {
    const devices = Array.isArray(object.devices) ? object.devices : [];
    for (const device of devices) {
        if (!device || typeof device !== 'object') {
            continue;
        }
        const candidate = device as GeoritmDevice;
        if (typeof candidate.name === 'string' && candidate.name.trim().length > 0) {
            return {
                name: candidate.name,
                shortName: typeof candidate.shortName === 'string' && candidate.shortName.trim().length > 0
                    ? candidate.shortName
                    : undefined,
                firmware: typeof candidate.firmware === 'string' && candidate.firmware.trim().length > 0
                    ? candidate.firmware
                    : undefined,
            };
        }
    }
    return undefined;
};

const toMonitorObject = (object: GeoritmObjectSummary): MonitorObject => ({
    id: String(object.id),
    extId: typeof object.extId === 'number' ? object.extId : undefined,
    name: typeof object.name === 'string' ? object.name : `Объект ${object.id}`,
    address: mapAddress(object),
    device: toDeviceInfo(object),
    securityAlarm: mapSecurityAlarm(object),
    fireAlarm: 'unknown',
    connection: mapConnection(object),
    updatedAt: mapUpdatedAt(object),
});

/**
 * Плоский список объектов пользователя из дерева GEORITM.
 * Один запрос objects/objects-tree-set/ — без обхода объектов.
 *
 * cache() — дедупликация в рамках одного серверного рендера (не
 * долгоживущий кэш): generateMetadata, тело страницы и зоны объекта
 * за один запрос к GEORITM выполняют tree-set/ один раз.
 */
const fetchOwnedObjects = cache(async (basic: string): Promise<GeoritmObjectSummary[]> =>
    flattenGeoritmTree(await georitmTreeSet(basic)),
);

/**
 * Объект по id с обогащением: obj/ (детали) и при отсутствии objectState —
 * objects/state/ по IMEI и objects/get-status/. Ошибка любого вызова —
 * исключение (страница показывает деградацию), не пустой список.
 * Дедупликация в рамках рендера — см. fetchOwnedObjects.
 */
const fetchOwnedObject = cache(
    async (
        basic: string,
        owned: GeoritmObjectSummary[],
        objectId: string,
    ): Promise<MonitorObject | null> => {
    const fromTree = owned.find((object) => String(object.id) === objectId);
    if (!fromTree) {
        return null;
    }

    let detail: GeoritmObjectSummary = fromTree;
    const objects = await georitmObjects(basic, [fromTree.id]);
    if (objects[0]) {
        detail = objects[0];
    }

    if (!detail.objectState) {
        // objectState отсутствует — достраиваем состояние из подтверждённых методов.
        const imei = typeof detail.imei === 'string' ? detail.imei : fromTree.imei;
        if (typeof imei === 'string' && imei.length > 0) {
            try {
                const partitions = await georitmPartitionsState(basic, imei);
                const states = Object.values(partitions.state ?? {});
                const armedCount = states.filter((value) => value === 2).length;
                const guarded = states.length > 0
                    ? armedCount === states.length ? 1 : armedCount > 0 ? 2 : 0
                    : undefined;
                if (guarded !== undefined) {
                    detail = {...detail, objectState: {...detail.objectState, isGuarded: guarded}};
                }
            } catch {
                // objects/state/ недоступен — объект возвращается с тем, что известно.
            }
        }
    }

    if (detail.objStatus === undefined) {
        try {
            const status = await georitmObjectStatus(basic, fromTree.id);
            if (typeof status.objStatus === 'number') {
                detail = {...detail, objStatus: status.objStatus};
            }
        } catch {
            // get-status/ недоступен — не критично для карточки.
        }
    }

    return toMonitorObject(detail);
    },
);

/**
 * Истинность флага GEORITM: у зон hasAlarm/hasFault — Boolean, у разделов —
 * Integer 0/1/2 (0 нет, 1 все зоны, 2 частично, «Georitm REST API.docx»,
 * obj-details «Разделы - areas»). Любое значение > 0 означает наличие
 * тревоги/неисправности хотя бы в одной зоне; прочие типы не считаются
 * истиной, а отсутствием данных.
 */
const georitmFlagSet = (value: boolean | number | undefined): boolean =>
    value === true || (typeof value === 'number' && value > 0);

/**
 * Состояние по флагам тревоги/неисправности и признаку охраны:
 * тревога > неисправность > охрана. Это приближение по документированным
 * полям (детальные биты — только obj-scan/) и подлежит уточнению
 * с поставщиком.
 */
const zoneState = (
    hasAlarm: boolean | number | undefined,
    hasFault: boolean | number | undefined,
    guarded: boolean,
): SecurityAlarmState => {
    if (georitmFlagSet(hasAlarm)) {
        return 'alarm';
    }
    if (georitmFlagSet(hasFault)) {
        return 'fault';
    }
    return guarded ? 'armed' : 'disarmed';
};

/** Имя раздела/зоны для отображения: пустые строки и null — признак отсутствия имени. */
const displayName = (raw: string | undefined, fallbackPrefix: string, num: number | undefined): string =>
    typeof raw === 'string' && raw.trim().length > 0
        ? raw
        : `${fallbackPrefix} ${num ?? '?'}`;

/**
 * Разделы и зоны объекта из obj-card/ (подтверждён на тестовом сервере).
 *
 * Разделы (areas) и их зоны (areas[].zones[]) — шлейфы охранно-пожарного
 * оборудования; геозоны (zones/) — другая сущность, здесь не используется.
 * Раздел сохраняется и с пустым zones — он существует и имеет состояние.
 *
 * Классификация «охрана/пожар» на уровне зоны в GEORITM отсутствует
 * (вопрос B7) — все зоны маппятся как охранные. Состояние зоны: тревога >
 * неисправность > охрана раздела (у зоны собственного признака охраны нет).
 */
const toZones = (card: GeoritmObjectCard): ObjectZoneSection[] => {
    const sections: ObjectZoneSection[] = [];
    const areas = Array.isArray(card.areas) ? card.areas : [];

    for (const area of areas) {
        const areaGuarded = area.isGuarded === true;
        const areaId = area.id ?? area.num;

        const zones: ObjectZone[] = [];
        for (const zone of area.zones ?? []) {
            const georitmZone: GeoritmAreaZone = zone;
            const zoneNum = typeof georitmZone.num === 'number' ? georitmZone.num : undefined;
            zones.push({
                id: `zone-${georitmZone.id ?? zoneNum ?? zones.length}`,
                num: zoneNum,
                comment: typeof georitmZone.comment === 'string' && georitmZone.comment.trim().length > 0
                    ? georitmZone.comment
                    : undefined,
                name: displayName(georitmZone.name, 'Зона', zoneNum),
                system: 'security',
                state: zoneState(georitmZone.hasAlarm, georitmZone.hasFault, areaGuarded),
            });
        }

        sections.push({
            id: `area-${areaId ?? sections.length}`,
            num: typeof area.num === 'number' ? area.num : undefined,
            comment: typeof area.comment === 'string' && area.comment.trim().length > 0
                ? area.comment
                : undefined,
            name: displayName(area.name, 'Раздел', typeof area.num === 'number' ? area.num : undefined),
            state: zoneState(area.hasAlarm, area.hasFault, areaGuarded),
            zones,
        });
    }

    return sections;
};

/** Обезличенная проекция obj-card/: только то, что нужно кабинету. */
const filterSensitiveCard = (card: GeoritmObjectCard): GeoritmObjectCard => ({
    // settings намеренно исключён: содержит PASS, RESPONSIVE_PERSONS и
    // прочие чувствительные значения, в DTO кабинета не предназначенные.
    id: card.id,
    item: card.item,
    objsGroups: card.objsGroups,
    hasFault: card.hasFault,
    areas: Array.isArray(card.areas)
        ? card.areas.map((area: GeoritmArea) => ({
            num: area.num,
            id: area.id,
            name: area.name,
            comment: area.comment,
            isGuarded: area.isGuarded,
            hasFault: area.hasFault,
            hasAlarm: area.hasAlarm,
            zones: Array.isArray(area.zones)
                ? area.zones.map((zone) => ({
                    num: zone.num,
                    id: zone.id,
                    name: zone.name,
                    comment: zone.comment,
                    hasFault: zone.hasFault,
                    hasAlarm: zone.hasAlarm,
                }))
                : [],
        }))
        : undefined,
});

// ——————————————————————————— Публичные функции ————————

export const getGeoritmObjectsForUser = async (userId: string): Promise<MonitorObject[]> => {
    const auth = await resolveGeoritmAuth();
    if (!auth || auth.user.id !== userId) {
        return [];
    }

    try {
        return (await fetchOwnedObjects(auth.basic)).map(toMonitorObject);
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            // Basic-credentials недействительны — сессия кабинета завершается.
            deleteSession(auth.sessionId);
        }
        throw error;
    }
};

export const findGeoritmObjectForUser = async (
    userId: string,
    objectId: string,
): Promise<MonitorObject | null> => {
    const auth = await resolveGeoritmAuth();
    if (!auth || auth.user.id !== userId) {
        return null;
    }

    try {
        const owned = await fetchOwnedObjects(auth.basic);
        return await fetchOwnedObject(auth.basic, owned, objectId);
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            deleteSession(auth.sessionId);
        }
        throw error;
    }
};

/**
 * Контекст операции управления охраной (E12): владение объектом подтверждено
 * ДО любого обращения к GEORITM с его идентификаторами (включая резолв IMEI),
 * права управления взяты из проекции сессии. Чужой и несуществующий объект
 * неотличимы (null). Используется georitm-control; сам Basic за пределами
 * серверных модулей не покидает.
 */
export const resolveGeoritmControlContext = async (
    userId: string,
    objectId: string,
): Promise<GeoritmControlContext | null> => {
    const auth = await resolveGeoritmAuth();
    if (!auth || auth.user.id !== userId) {
        return null;
    }

    try {
        const owned = await fetchOwnedObjects(auth.basic);
        const target = owned.find((object) => String(object.id) === objectId);
        if (!target) {
            return null;
        }
        return {
            basic: auth.basic,
            sessionId: auth.sessionId,
            userId: auth.user.id,
            objectId,
            target,
            // Сессии, созданные до E12, проекции прав не имеют — «неизвестно»,
            // управление скрыто (не «нет прав»: семантика другая).
            permissions: auth.controlPermissions,
        };
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            deleteSession(auth.sessionId);
        }
        throw error;
    }
};

export const getGeoritmZonesForObject = async (objectId: string): Promise<ObjectZoneSection[]> => {
    const auth = await resolveGeoritmAuth();
    if (!auth) {
        return [];
    }

    try {
        const owned = await fetchOwnedObjects(auth.basic);
        const target = owned.find((object) => String(object.id) === objectId);
        if (!target) {
            return [];
        }
        const card = await georitmObjectCard(auth.basic, target.id);
        return toZones(filterSensitiveCard(card));
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            deleteSession(auth.sessionId);
        }
        throw error;
    }
};

// ——————————————— Расширенное техническое состояние (E4.2) ———————————————

/**
 * Нормализация GeoritmObjectFault → ObjectFault. Запись без числового
 * faultCode пропускается: код — единственный идентификатор неисправности.
 * Без messageText текст собирается из кода, не подменяется «нормой».
 */
const toObjectFault = (record: GeoritmObjectFault, index: number): ObjectFault | null => {
    if (typeof record?.faultCode !== 'number' || !Number.isFinite(record.faultCode)) {
        return null;
    }
    const message = typeof record.messageText === 'string' && record.messageText.trim().length > 0
        ? record.messageText.trim()
        : `Неисправность (код ${record.faultCode})`;

    return {
        id: typeof record.areaZoneId === 'number'
            ? `fault:${record.areaZoneId}:${record.faultCode}`
            : `fault:row-${index}`,
        code: record.faultCode,
        message,
        areaNum: typeof record.areaNum === 'number' ? record.areaNum : undefined,
        zoneNum: typeof record.areaZoneNum === 'number' ? record.areaZoneNum : undefined,
    };
};

/**
 * Активные неисправности объекта через objects/obj-faults/ (read-only,
 * E4.2; подтверждён на сервере 2.27.0). Доступ — как в остальных методах:
 * объект должен присутствовать в выдаче objects-tree-set/ текущего
 * пользователя; чужой и несуществующий объект неотличимы (пусто).
 *
 * Успешный пустой ответ — сервер явно не зарегистрировал неисправностей;
 * ошибка вызова пробрасывается выше и не превращается в пустой список.
 */
export const getGeoritmDiagnosticsForObject = async (objectId: string): Promise<ObjectFault[]> => {
    const auth = await resolveGeoritmAuth();
    if (!auth) {
        return [];
    }

    try {
        const owned = await fetchOwnedObjects(auth.basic);
        const target = owned.find((object) => String(object.id) === objectId);
        if (!target) {
            return [];
        }

        const records = await georitmObjectFaults(auth.basic, target.id);
        const faults: ObjectFault[] = [];
        for (const [index, record] of records.entries()) {
            if (!record || typeof record !== 'object') {
                continue;
            }
            const fault = toObjectFault(record, index);
            if (fault) {
                faults.push(fault);
            }
        }
        return faults;
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            await revokeSessionOnUnauthorized(auth);
        }
        throw error;
    }
};

// ——————————————— Каналы связи и питание (E9) ———————————————

/**
 * Документированный перечень каналов channels/. Значения вне перечня
 * в DTO не переносятся: состав каналов строится только из подтверждённых
 * типов, неизвестные строки сервера отбрасываются, не интерпретируются.
 */
const CHANNEL_KINDS = ['SIM_1', 'SIM_2', 'LAN', 'WIFI'] as const;

type ChannelKind = (typeof CHANNEL_KINDS)[number];

const isChannelKind = (value: unknown): value is ChannelKind =>
    typeof value === 'string' && (CHANNEL_KINDS as readonly string[]).includes(value);

/**
 * Целое число в границах. Служит для флагов 0/1 и документированных шкал:
 * level (SIM 0–5, WIFI 0–4), percent (0–100). Значение вне границ или не
 * число — «данные отсутствуют», не ноль: подменять некорректное значение
 * нулевым недопустимо.
 */
const boundedInt = (value: unknown, min: number, max: number): number | undefined => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
        return undefined;
    }
    return value;
};

/** Флаг 0/1 из ответа GEORITM: строго 0/1, прочее — отсутствие данных. */
const flag01 = (value: unknown): boolean | undefined =>
    value === 0 ? false : value === 1 ? true : undefined;

/**
 * Проекция характеристик канала по документированным полям. Каждое поле
 * переносится только при валидном значении: отсутствующее поле остаётся
 * undefined, и UI отличает «не передано» от «ноль».
 */
const toCommunicationChannel = (kind: ChannelKind, signal: GeoritmChannelSignal | undefined): CommunicationChannel => {
    if (!signal || typeof signal !== 'object') {
        // Канал назван в channels[], но характеристики не переданы:
        // сохраняется только факт его наличия.
        return {kind};
    }
    return {
        kind,
        ...(kind === 'SIM_1' || kind === 'SIM_2'
            ? {
                inserted: flag01(signal.inserted),
                online: flag01(signal.online),
            }
            : {}),
        ...(kind === 'LAN' ? {connected: flag01(signal.connected)} : {}),
        // Шкалы из документации: SIM level 0–5, WIFI 0–4, percent 0–100.
        ...(kind === 'WIFI' ? {level: boundedInt(signal.level, 0, 4)} : {level: boundedInt(signal.level, 0, 5)}),
        percent: boundedInt(signal.percent, 0, 100),
    };
};

/**
 * Маппинг ответа channels/ в DTO. Пустой успешный ответ или ответ без
 * состава каналов — 'absent' (данные отсутствуют в ответе), не «норма»:
 * объект с каналами связи обязан их передавать, а подмена отсутствия
 * данных пустым списком скрыла бы проблему.
 */
const toCommunicationDiagnostics = (response: GeoritmChannelsResponse): CommunicationDiagnostics => {
    const declared = Array.isArray(response?.channels) ? response.channels.filter(isChannelKind) : [];
    const channels: CommunicationChannel[] = [];
    for (const kind of CHANNEL_KINDS) {
        // Порядок DTO фиксированный; канал попадает, если передан
        // характеристиками или назван в channels[].
        const signal = response?.[kind];
        if ((signal && typeof signal === 'object') || declared.includes(kind)) {
            channels.push(toCommunicationChannel(kind, signal));
        }
    }

    if (channels.length === 0) {
        return {availability: 'absent', channels: []};
    }

    return {
        availability: 'available',
        activeChannel: isChannelKind(response?.activeChannel) ? response.activeChannel : undefined,
        channels,
        fetchedAt: new Date().toISOString(),
    };
};

/**
 * Единая проверка доступа для диагностики (E9): объект должен быть в выдаче
 * objects-tree-set/ текущего пользователя — как в diagnostics/events/reports.
 * Возвращает контекст авторизации или null (чужой/несуществующий объект).
 */
const resolveDiagnosticsTarget = async (
    auth: {basic: string; sessionId: string},
    objectId: string,
): Promise<GeoritmObjectSummary | null> => {
    const owned = await fetchOwnedObjects(auth.basic);
    return owned.find((object) => String(object.id) === objectId) ?? null;
};

/**
 * Кэш классификации «channels/ не реализован на сервере». Свойство версии
 * сервера, а не объекта: подтверждённая сигнатура кэшируется на 10 минут,
 * чтобы каждая загрузка карточки не повторяла заведомо неуспешный вызов
 * (E8: на 2.27.0 channels/ и channels/level/ не реализованы). При смене
 * сервера кэш истекает и метод проверяется заново.
 */
const CHANNELS_UNSUPPORTED_TTL_MS = 10 * 60 * 1000;
let channelsUnsupportedUntil = 0;

/**
 * Диагностика каналов связи объекта через channels/ (read-only, E9).
 *
 * HTTP 400 с сигнатурой «HTTP 404 Not Found» — метод отсутствует на
 * установленной версии сервера (зафиксировано на 2.27.0, E9): возвращает
 * 'unsupported', не ошибку и не пустую диагностику. Прочие ошибки
 * (сеть, тайм-аут, 5xx, неожиданные 400) пробрасываются — страница
 * покажет временную недоступность, подмена ошибки отсутствием данных
 * недопустима. Доступ — как во всех методах: после проверки владения.
 */
export const getGeoritmChannelsForObject = async (objectId: string): Promise<CommunicationDiagnostics> => {
    const auth = await resolveGeoritmAuth();
    if (!auth) {
        return {availability: 'unknown', channels: []};
    }

    try {
        const target = await resolveDiagnosticsTarget(auth, objectId);
        if (!target) {
            // Чужой и несуществующий объект неотличимы; вызов channels/ не выполняется.
            return {availability: 'unknown', channels: []};
        }

        if (Date.now() < channelsUnsupportedUntil) {
            return {availability: 'unsupported', channels: []};
        }

        try {
            return toCommunicationDiagnostics(await georitmChannels(auth.basic, target.id));
        } catch (error) {
            if (error instanceof GeoritmApiError && error.isMethodMissing) {
                channelsUnsupportedUntil = Date.now() + CHANNELS_UNSUPPORTED_TTL_MS;
                return {availability: 'unsupported', channels: []};
            }
            throw error;
        }
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            await revokeSessionOnUnauthorized(auth);
        }
        throw error;
    }
};

/**
 * Диагностика питания прибора (E9). Источник — power{} из objects/obj-details/
 * (callDevice=false, без обращения к прибору). Для стационарных объектов
 * поле power документировано как неприменимое («присутствует только для
 * мобильных объектов») и его отсутствие подтверждено на сервере 2.27.0 —
 * запрос не выполняется ('not-provided'): проблемы питания стационарных
 * объектов видны в активных неисправностях (301/302). У мобильного объекта
 * отсутствие power в ответе — 'absent'.
 */
export const getGeoritmPowerForObject = async (objectId: string): Promise<PowerDiagnostics> => {
    const auth = await resolveGeoritmAuth();
    if (!auth) {
        return {availability: 'unknown'};
    }

    try {
        const target = await resolveDiagnosticsTarget(auth, objectId);
        if (!target) {
            return {availability: 'unknown'};
        }

        // power{} документирован только для мобильных приборов (objType '0');
        // кабинет подключает стационарные объекты (groupType=1), но проверка
        // по фактическому objType сохраняет корректность при расширении.
        if (target.objType !== '0') {
            return {availability: 'not-provided'};
        }

        const details: GeoritmObjectDetails = await georitmObjectDetails(auth.basic, target.id);
        const power = details?.power;
        if (!power || typeof power !== 'object') {
            return {availability: 'absent'};
        }

        const source = power.state === 0 ? 'main' : power.state === 1 ? 'backup' : undefined;
        const voltage = typeof power.voltage === 'number' && Number.isFinite(power.voltage) && power.voltage > 0
            ? power.voltage
            : undefined;
        if (source === undefined && voltage === undefined) {
            // Поле power передано, но без валидных значений — данных нет.
            return {availability: 'absent'};
        }

        return {availability: 'available', source, voltage, fetchedAt: new Date().toISOString()};
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            await revokeSessionOnUnauthorized(auth);
        }
        throw error;
    }
};

/**
 * ISO 8601 из миллисекунд GEORITM. E2.0: все временные метки
 * alerts/history-by-obj/ (alertTs, receivedAt) — Unix time в миллисекундах;
 * метка в секундах не встречалась. Некорректное значение → undefined:
 * отсутствующая дата не подменяется текущим временем.
 */
const toIsoFromMs = (value: unknown): string | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return undefined;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/**
 * «NNN.N» → числовой код справочника NNNN. E2.0: соответствие подтверждено
 * на реальном сервере (12/12 кодов совпали с alert-template/list/,
 * messageText события при этом посимвольно равен message шаблона).
 */
const numericEventCode = (code: string): number | undefined => {
    const normalized = Number(code.replace('.', ''));
    return Number.isInteger(normalized) && normalized > 0 ? normalized : undefined;
};

/**
 * Классификация по группам справочника, фактическим на сервере 2.27.0
 * (E2.0): 1 Тревога, 2 Восстановление, 3 Неисправность, 4 Снятие / Взятие,
 * 5 Системное, 6 Разное. Названия групп из старой документации не совпадают
 * с сервером. Непроверенные группы и отсутствующий шаблон → 'system'.
 */
const GROUP_TYPE: Record<number, MonitorEventType> = {
    1: 'security_alarm',
    2: 'restored',
    3: 'security_fault',
    6: 'system',
};

/**
 * Направление связи и охраны — только по кодам, проверенным на реальном
 * сервере (E2.0, тексты совпадают со справочником). Непроверенные коды
 * направление не получают — классифицируются по группе или как 'system'.
 *
 * Отказ-коды команды (E11, раздел 5; справочник группы 4 целиком получен
 * на сервере 2.27.0): 450.1 «Ошибка снятия», 450.3 «Ошибка взятия»,
 * 920.1 «Неисправность при взятии на охрану». Без явного правила они
 * попали бы в подстрочную эвристику группы 4 («Ошибка снятия» содержит
 * «снят») и были бы показаны в журнале как успешное снятие с охраны —
 * конфликт с классификатором команды (E12), при котором отказ выглядел бы
 * подтверждением. Явное правило переводит их в 'security_fault': это
 * неисправности/отказы (isAlarm=true в справочнике), а не факты охраны.
 * Семантику подтверждает справочник сервера; новые типы событий DTO
 * не вводятся до ответа поставщика (E11, 9.2.6).
 */
const VERIFIED_CODES: Record<string, MonitorEventType> = {
    '402.1': 'security_disarmed', // «Снятие раздела с охраны»
    '402.3': 'security_armed', // «Взятие раздела на охрану»
    '450.1': 'security_fault', // «Ошибка снятия» (отказ команды, E11)
    '450.3': 'security_fault', // «Ошибка взятия» (отказ команды, E11)
    '920.1': 'security_fault', // «Неисправность при взятии на охрану» (E11)
    '761.1': 'connection_lost', // «GPRS SIM1 связь с объектом завершена»
    '761.3': 'connection_restored', // «GPRS SIM1 объект вышел на связь»
};

/**
 * Направление «снят/взят» внутри группы 4 для непроверенных кодов — по
 * содержимому текста шаблона (справочник сервера, не сообщение прибора).
 * Цена ошибки — подпись направления у не-тревожной записи, ложная тревога
 * или пожар при этом невозможны. Без совпадения — 'system'.
 */
const group4Direction = (template: GeoritmAlertTemplate | undefined): MonitorEventType => {
    const text = (typeof template?.message === 'string' ? template.message : '').toLowerCase();
    if (text.includes('снят')) {
        return 'security_disarmed';
    }
    if (text.includes('взят')) {
        return 'security_armed';
    }
    return 'system';
};

/**
 * Классификация события. Не по одному isAlarm: в группе 3 («Неисправность»)
 * встречаются записи с isAlarm=true (E2.0). Пожарная классификация не
 * применяется: проверенных пожарных кодов нет (вопрос B7 поставщику).
 */
const classifyAlert = (
    record: GeoritmObjectAlert,
    template: GeoritmAlertTemplate | undefined,
): MonitorEventType => {
    if (typeof record.code === 'string') {
        const verified = VERIFIED_CODES[record.code];
        if (verified) {
            return verified;
        }
    }
    if (template?.groupId === 4) {
        return group4Direction(template);
    }
    return template?.groupId !== undefined
        ? GROUP_TYPE[template.groupId] ?? 'system'
        : 'system';
};

/** Сообщение события: фактический messageText прибора, шаблон — только запасной. */
const alertMessage = (record: GeoritmObjectAlert, template: GeoritmAlertTemplate | undefined): string => {
    if (typeof record.messageText === 'string' && record.messageText.length > 0) {
        return record.messageText;
    }
    if (typeof template?.message === 'string' && template.message.length > 0) {
        return template.message;
    }
    return typeof record.code === 'string' && record.code.length > 0
        ? `Событие прибора (код ${record.code})`
        : 'Событие прибора';
};

/** Нормализация ObjectAlert → MonitorObjectEvent. Без корректного alertTs запись пропускается. */
const toEventFromAlert = (
    record: GeoritmObjectAlert,
    templates: Map<number, GeoritmAlertTemplate>,
    objectId: string,
    index: number,
): MonitorObjectEvent | null => {
    const occurredAt = toIsoFromMs(record.alertTs);
    if (!occurredAt) {
        // Метка события отсутствует или некорректна. Подменять её
        // receivedAt или текущим временем недопустимо — запись не выдаётся.
        return null;
    }

    const template = typeof record.code === 'string'
        ? templates.get(numericEventCode(record.code) ?? Number.NaN)
        : undefined;
    const isAlarm = typeof record.isAlarm === 'boolean'
        ? record.isAlarm
        : typeof template?.isAlarm === 'boolean' ? template.isAlarm : undefined;

    return {
        id: typeof record.alertId === 'number' ? `alert:${record.alertId}` : `alert:row-${index}`,
        objectId,
        occurredAt,
        type: classifyAlert(record, template),
        message: alertMessage(record, template),
        receivedAt: toIsoFromMs(record.receivedAt),
        code: typeof record.code === 'string' && record.code.length > 0 ? record.code : undefined,
        isAlarm,
    };
};

/** Нейтральные описания действий по документированным actionType (подтверждён только 1). */
const ACTION_FALLBACK_MESSAGE: Record<number, string> = {
    1: 'Закрытие открытых тревог объекта',
    2: 'Комментарий оператора',
};

/** Нормализация ObjectAlertLog → MonitorObjectEvent. */
const toEventFromAlertLog = (
    record: GeoritmObjectAlertLog,
    objectId: string,
    index: number,
): MonitorObjectEvent | null => {
    const occurredAt = toIsoFromMs(record.receivedAt);
    if (!occurredAt) {
        return null;
    }

    const comment = typeof record.comment === 'string' ? record.comment.trim() : '';
    const fallback = typeof record.actionType === 'number'
        ? ACTION_FALLBACK_MESSAGE[record.actionType]
        : undefined;

    return {
        id: typeof record.id === 'number' ? `action:${record.id}` : `action:row-${index}`,
        objectId,
        occurredAt,
        type: 'system',
        message: comment.length > 0 ? comment : fallback ?? 'Действие оператора',
        isUserAction: true,
        userName: typeof record.userName === 'string' && record.userName.length > 0
            ? record.userName
            : undefined,
    };
};

/**
 * Журнал событий объекта постранично (E10) через общий движок
 * event-journal. Первая страница строится из «головы» — history-by-obj/
 * (новейшие ≤1000 событий + ≤1000 действий, один запрос); последующие —
 * шагающими окнами alerts/history-on-obj/ от якорной границы. Доступ —
 * как во всех методах: объект должен присутствовать в выдаче
 * objects-tree-set/ текущего пользователя, вызовы alerts/* выполняются
 * только после этой проверки (чужой objectId даёт от GEORITM 401).
 */

// ——————————————— Постраничный журнал событий (E10) ————————

/** Документированный предел history-by-obj/: «последние 1000 действий и 1000 событий». */
const HISTORY_CAP_PER_KIND = 1000;

/** Пустая страница (чужой/несуществующий объект). */
const EMPTY_EVENTS_PAGE: EventJournalPage = {
    events: [],
    hasMore: false,
    depthLimited: false,
    bottomCursor: null,
    upperCursor: null,
};

/** Результат постраничной загрузки журнала вместе со справочными данными UI. */
export interface GeoritmEventsPage {
    page: EventJournalPage;
    /** Типы, встречающиеся в журнале (для чипов фильтра); может быть неполным. */
    availableTypes: MonitorEventType[];
    /** Точный total источнику GEORITM неизвестен — всегда null. */
    totalEvents: number | null;
}

const countByKind = (records: GeoritmHistoryRecord[], kind: 'ObjectAlert' | 'ObjectAlertLog'): number =>
    records.filter((record) => record?.type === kind).length;

/** Голова усечена сервером — глубже её покрытия могут быть записи. */
const isHistoryCapped = (records: GeoritmHistoryRecord[]): boolean =>
    countByKind(records, 'ObjectAlert') >= HISTORY_CAP_PER_KIND
    || countByKind(records, 'ObjectAlertLog') >= HISTORY_CAP_PER_KIND;

/**
 * Метка receivedAt записи в миллисекундах — ключ постраничного порядка.
 * Подтверждено пробой (E10): history-on-obj/ фильтрует и сортирует именно
 * по receivedAt. У событий без receivedAt (не встречались на сервере)
 * используется alertTs — запись не выбрасывается, но её позиция может
 * отличаться от серверной сортировки; отмечено как ограничение.
 */
const recordReceivedAtMs = (record: GeoritmHistoryRecord, fallbackMs: number): number =>
    typeof record.receivedAt === 'number' && Number.isFinite(record.receivedAt) && record.receivedAt > 0
        ? record.receivedAt
        : fallbackMs;

/** Нормализация ответа history-* в записи движка. Неизвестные типы — пропуск. */
const toJournalEntries = (
    records: GeoritmHistoryRecord[],
    templates: Map<number, GeoritmAlertTemplate>,
    objectId: string,
): JournalEntry[] => {
    const entries: JournalEntry[] = [];
    for (const [index, record] of records.entries()) {
        if (!record || typeof record !== 'object') {
            continue;
        }
        if (record.type === 'ObjectAlertLog') {
            const event = toEventFromAlertLog(record as GeoritmObjectAlertLog, objectId, index);
            // У действия occurredAt = receivedAt — метка порядка совпадает с ней.
            if (event) {
                entries.push({event, receivedAtMs: Date.parse(event.occurredAt)});
            }
        } else if (record.type === 'ObjectAlert') {
            const event = toEventFromAlert(record as GeoritmObjectAlert, templates, objectId, index);
            if (event) {
                entries.push({event, receivedAtMs: recordReceivedAtMs(record, Date.parse(event.occurredAt))});
            }
        }
    }
    return entries;
};

/**
 * Окно alerts/history-on-obj/ в записях движка. Границы передаются как
 * есть (миллисекунды, включающие); перекрытие окон и дедупликация по id —
 * в движке: у действий хранимая метка суб-секундная, неперекрывающиеся
 * границы теряли бы записи на стыках (проба E10).
 */
const fetchGeoritmWindow = async (
    auth: {basic: string; user: PublicAccountUser},
    georitmObjectId: number,
    objectId: string,
    fromMs: number,
    toMs: number,
): Promise<JournalEntry[]> => {
    const [records, templates] = await Promise.all([
        georitmHistoryOnObject(auth.basic, georitmObjectId, fromMs, toMs),
        getAlertTemplatesByCode(auth.basic, auth.user.id),
    ]);
    return toJournalEntries(records, templates, objectId);
};

// ——————— Кэш типов журнала для чипов фильтра ———————

/**
 * Типы, встречающиеся в журнале объекта, вычисляются из «головы»
 * (history-by-obj/) и кэшируются в памяти процесса: страницы 2+ не видят
 * полный журнал, а чипы фильтра должны оставаться прежними. Кэш
 * изолирован парой «пользователь:объект», TTL 10 минут (как у справочника
 * шаблонов), переживать рестарт не обязан — при холодном кэше чипы
 * строятся по текущей странице. Значение — только список кодов типов,
 * персональных данных не содержит.
 */
const AVAILABLE_TYPES_TTL_MS = 10 * 60 * 1000;
const availableTypesCache = new Map<string, {types: MonitorEventType[]; expiresAt: number}>();

const rememberAvailableTypes = (userId: string, objectId: string, entries: JournalEntry[]): void => {
    const types = new Set<MonitorEventType>();
    for (const entry of entries) {
        types.add(entry.event.type);
    }
    if (types.size > 0) {
        availableTypesCache.set(`${userId}:${objectId}`, {
            types: [...types],
            expiresAt: Date.now() + AVAILABLE_TYPES_TTL_MS,
        });
    }
};

const readAvailableTypes = (userId: string, objectId: string, pageEvents: MonitorObjectEvent[]): MonitorEventType[] => {
    const cached = availableTypesCache.get(`${userId}:${objectId}`);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.types;
    }
    // Холодный кэш (рестарт процесса или истечение TTL): чипы по текущей
    // странице — неполно, но корректно; полный набор восстановится при
    // возврате на первую страницу.
    return [...new Set(pageEvents.map((event) => event.type))];
};

export const getGeoritmEventsPageForObject = async (
    objectId: string,
    pageSize: number,
    eventType: MonitorEventType | undefined,
    cursor: EventJournalCursor | null,
    direction: EventJournalDirection,
): Promise<GeoritmEventsPage> => {
    const auth = await resolveGeoritmAuth();
    if (!auth) {
        throw new GeoritmApiError('network', null, null, 'Нет активной сессии GEORITM');
    }

    try {
        const owned = await fetchOwnedObjects(auth.basic);
        const target = owned.find((object) => String(object.id) === objectId);
        if (!target) {
            // Чужой и несуществующий объект неотличимы; страница при этом
            // уже показала 404 (findObjectForUser), здесь защита в глубину.
            return {page: EMPTY_EVENTS_PAGE, availableTypes: [], totalEvents: null};
        }

        const page = await fetchEventJournalPage({
            pageSize,
            eventType,
            cursor,
            direction,
            windowFetch: (fromMs, toMs) => fetchGeoritmWindow(auth, target.id, objectId, fromMs, toMs),
            ...(cursor === null
                ? {
                    headFetch: async () => {
                        const [records, templates] = await Promise.all([
                            georitmHistoryByObject(auth.basic, target.id),
                            getAlertTemplatesByCode(auth.basic, auth.user.id),
                        ]);
                        const entries = toJournalEntries(records, templates, objectId);
                        rememberAvailableTypes(auth.user.id, objectId, entries);
                        return {entries, capped: isHistoryCapped(records)};
                    },
                }
                : {}),
        });

        return {
            page,
            availableTypes: readAvailableTypes(auth.user.id, objectId, page.events),
            totalEvents: null,
        };
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            await revokeSessionOnUnauthorized(auth);
        }
        throw error;
    }
};

// ——————————————————————————— Отчёты объекта (E4.3) ————————

/** Тайм-аут формирования отчёта: синхронная генерация дольше обычного вызова. */
const REPORT_TIMEOUT_MS = 30_000;

/**
 * Подтверждённые типы отчётов (E4.3): проверены на сервере 2.27.0
 * (ALERTSUM/ALERTS json; ALERTSUM также pdf/excel). Метод reports/ со
 * списком типов на сервере недоступен — белый список задаётся здесь,
 * UI других типов предложить не может.
 */
const GEORITM_REPORT_TYPES: Readonly<Record<ObjectReportRequest['type'], {
    georitmType: string;
    title: string;
}>> = {
    'alerts-summary': {georitmType: 'ALERTSUM', title: 'Сводный отчёт по событиям и тревогам'},
    'alerts-events': {georitmType: 'ALERTS', title: 'События и тревоги'},
};

const REPORT_EXTENSIONS: Readonly<Record<ObjectReportRequest['format'], string>> = {
    pdf: 'pdf',
    excel: 'xlsx',
};

const REPORT_CONTENT_TYPES: Readonly<Record<ObjectReportRequest['format'], string>> = {
    pdf: 'application/pdf',
    excel: 'application/vnd.ms-excel',
};

/**
 * Отчёт объекта в файловом формате (reports/{type}/{format}, синхронное
 * формирование — ответ и есть файл). Доступ — как в остальных методах:
 * объект должен присутствовать в выдаче objects-tree-set/ текущего
 * пользователя. Это обязательно и до вызова отчёта: сервер GEORITM на
 * неизвестный objectId отвечает HTTP 401 «Invalid username or wrong
 * password» (наблюдение 2.27.0), и без собственной проверки владения
 * запрос чужого объекта отзывал бы сессию кабинета.
 *
 * 401 по подтверждённому владению объекту обрабатывается как обычная
 * утрата credentials: сессия отзывается, ошибка пробрасывается.
 */
export const getGeoritmReportForObject = async (
    objectId: string,
    request: ObjectReportRequest,
): Promise<ObjectReportFile> => {
    const auth = await resolveGeoritmAuth();
    if (!auth) {
        throw new GeoritmApiError('network', null, null, 'Нет активной сессии GEORITM');
    }

    try {
        const owned = await fetchOwnedObjects(auth.basic);
        const target = owned.find((object) => String(object.id) === objectId);
        if (!target) {
            // Чужой и несуществующий объект неотличимы; вызов reports/ не выполняется.
            throw new GeoritmApiError('http', 404, null, 'Объект не найден среди доступных пользователю');
        }

        const meta = GEORITM_REPORT_TYPES[request.type];
        // Календарные дни МСК разворачиваются в границы суток; формат
        // documented 'YYYY-MM-dd HH:mm:ss', tzId подтверждён на сервере.
        const file = await callGeoritmReport(
            meta.georitmType,
            request.format,
            {
                objectId: [target.id],
                from: `${request.from} 00:00:00`,
                to: `${request.to} 23:59:59`,
                tzId: 'Europe/Moscow',
                sort: 'name',
                scode: 'YDX',
                ...(request.type === 'alerts-events' ? {alertGroupId: [1, 2, 3, 4, 5, 6]} : {}),
            },
            auth.basic,
            REPORT_TIMEOUT_MS,
        );

        return {
            filename: `${meta.title} — ${target.name ?? `объект ${target.id}`} — ${request.from}_${request.to}.${REPORT_EXTENSIONS[request.format]}`,
            // Содержимое ответа GEORITM соответствует запрошенному формату;
            // Content-Type задаём статически по формату, заголовки сервера
            // (включая Content-Disposition) наружу не пробрасываются.
            contentType: REPORT_CONTENT_TYPES[request.format],
            content: file.content,
        };
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            await revokeSessionOnUnauthorized(auth);
        }
        throw error;
    }
};
