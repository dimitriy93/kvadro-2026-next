import {cookies} from 'next/headers';
import type {
    MonitorEventType,
    MonitorObject,
    MonitorObjectEvent,
    ObjectZone,
    PublicAccountUser,
    SecurityAlarmState,
} from './contracts';
import {ACCOUNT_SESSION_COOKIE_NAME} from './session';
import {
    createGeoritmSession,
    deleteSession,
    getSessionRecord,
} from './session-store';
import {getAlertTemplatesByCode} from '@/lib/georitm/alert-template-cache';
import {
    GeoritmApiError,
    flattenGeoritmTree,
    georitmHistoryByObject,
    georitmLogin,
    georitmLogout,
    georitmObjectCard,
    georitmObjectStatus,
    georitmObjects,
    georitmPartitionsState,
    georitmTreeSet,
    type GeoritmAlertTemplate,
    type GeoritmArea,
    type GeoritmAreaZone,
    type GeoritmObjectAlert,
    type GeoritmObjectAlertLog,
    type GeoritmObjectCard,
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

    const record = getSessionRecord(sessionId);
    if (!record) {
        return null;
    }

    return {basic: record.georitmBasic, user: record.user, sessionId};
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

    const sessionValue = createGeoritmSession(user, basic, SESSION_TTL);
    return {user, sessionValue};
};

/** Завершение GEORITM-сессии: отзыв в хранилище + users/logout/ на сервере. */
export const logoutGeoritm = async (): Promise<void> => {
    const auth = await resolveGeoritmAuth();
    if (!auth) {
        return;
    }
    deleteSession(auth.sessionId);
    try {
        await georitmLogout(auth.basic);
    } catch {
        // Сессия кабинета уже отозвана; ошибка logout на стороне GEORITM
        // (в т.ч. недоступность) не должна мешать выходу пользователя.
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

const toMonitorObject = (object: GeoritmObjectSummary): MonitorObject => ({
    id: String(object.id),
    extId: typeof object.extId === 'number' ? object.extId : undefined,
    name: typeof object.name === 'string' ? object.name : `Объект ${object.id}`,
    address: mapAddress(object),
    securityAlarm: mapSecurityAlarm(object),
    fireAlarm: 'unknown',
    connection: mapConnection(object),
    updatedAt: mapUpdatedAt(object),
});

/**
 * Плоский список объектов пользователя из дерева GEORITM.
 * Один запрос objects/objects-tree-set/ — без обхода объектов.
 */
const fetchOwnedObjects = async (basic: string): Promise<GeoritmObjectSummary[]> =>
    flattenGeoritmTree(await georitmTreeSet(basic));

/**
 * Объект по id с обогащением: obj/ (детали) и при отсутствии objectState —
 * objects/state/ по IMEI и objects/get-status/. Ошибка любого вызова —
 * исключение (страница показывает деградацию), не пустой список.
 */
const fetchOwnedObject = async (
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
};

/**
 * Зоны объекта из obj-card/ (подтверждён на тестовом сервере).
 *
 * Разделы (areas) и их зоны (areas[].zones[]) — шлейфы охранно-пожарного
 * оборудования; геозоны (zones/) — другая сущность, здесь не используется.
 *
 * Классификация «охрана/пожар» на уровне зоны в GEORITM отсутствует
 * (вопрос B7) — все зоны маппятся как охранные. Состояние зоны: тревога >
 * неисправность > охрана раздела. Это приближение по документированным
 * полям и подлежит уточнению с поставщиком.
 */
const toZones = (card: GeoritmObjectCard): ObjectZone[] => {
    const zones: ObjectZone[] = [];
    const areas = Array.isArray(card.areas) ? card.areas : [];

    const zoneState = (
        hasAlarm: boolean | undefined,
        hasFault: boolean | undefined,
        areaGuarded: boolean,
    ): SecurityAlarmState => {
        if (hasAlarm) {
            return 'alarm';
        }
        if (hasFault) {
            return 'fault';
        }
        return areaGuarded ? 'armed' : 'disarmed';
    };

    for (const area of areas) {
        const areaGuarded = area.isGuarded === true;
        if (area.name || area.num !== undefined) {
            zones.push({
                id: `area-${area.id ?? area.num ?? zones.length}`,
                name: area.name ?? `Раздел ${area.num ?? '?'}`,
                system: 'security',
                state: zoneState(
                    area.hasAlarm === true,
                    area.hasFault === true,
                    areaGuarded,
                ),
            });
        }
        for (const zone of area.zones ?? []) {
            const georitmZone: GeoritmAreaZone = zone;
            zones.push({
                id: `zone-${georitmZone.id ?? georitmZone.num ?? zones.length}`,
                name: georitmZone.name ?? `Зона ${georitmZone.num ?? '?'}`,
                system: 'security',
                state: zoneState(georitmZone.hasAlarm === true, georitmZone.hasFault === true, areaGuarded),
            });
        }
    }

    return zones;
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
            isGuarded: area.isGuarded,
            hasFault: area.hasFault,
            hasAlarm: area.hasAlarm,
            zones: Array.isArray(area.zones)
                ? area.zones.map((zone) => ({
                    num: zone.num,
                    id: zone.id,
                    name: zone.name,
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

export const getGeoritmZonesForObject = async (objectId: string): Promise<ObjectZone[]> => {
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

// ——————————————————— Нормализация журнала событий (E2.0) ————————

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
 */
const VERIFIED_CODES: Record<string, MonitorEventType> = {
    '402.1': 'security_disarmed', // «Снятие раздела с охраны»
    '402.3': 'security_armed', // «Взятие раздела на охрану»
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
 * Журнал событий объекта через alerts/history-by-obj/ (E2.1). Записи двух
 * типов (ObjectAlert/ObjectAlertLog) нормализуются в единый DTO и сортируются
 * по occurredAt от новых к старым (порядок ответа GEORITM не гарантирован).
 * Инкрементальный опрос через history-on-obj/ — отдельный будущий этап.
 */
export const getGeoritmEventsForObject = async (
    objectId: string,
    eventType?: MonitorEventType,
): Promise<MonitorObjectEvent[] | null> => {
    const auth = await resolveGeoritmAuth();
    if (!auth) {
        return null;
    }

    try {
        // Доступ проверяется тем же способом, что и в остальных методах:
        // объект должен присутствовать в выдаче objects-tree-set/ текущего
        // пользователя. Прямого вызова alerts/* без проверки нет.
        const owned = await fetchOwnedObjects(auth.basic);
        const target = owned.find((object) => String(object.id) === objectId);
        if (!target) {
            // Чужой и несуществующий объект — пусто; страница при этом уже
            // показала 404 (findObjectForUser), здесь защита в глубину.
            return [];
        }

        const [records, templates] = await Promise.all([
            georitmHistoryByObject(auth.basic, target.id),
            getAlertTemplatesByCode(auth.basic, auth.user.id),
        ]);

        const events: MonitorObjectEvent[] = [];
        for (const [index, record] of records.entries()) {
            if (!record || typeof record !== 'object') {
                continue;
            }
            const event = record.type === 'ObjectAlertLog'
                ? toEventFromAlertLog(record as GeoritmObjectAlertLog, objectId, index)
                : record.type === 'ObjectAlert'
                    ? toEventFromAlert(record as GeoritmObjectAlert, templates, objectId, index)
                    : null; // Неизвестный тип записи — пропуск, не ошибка загрузки.
            if (event) {
                events.push(event);
            }
        }

        const sorted = events.sort(
            (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
        );
        return eventType
            ? sorted.filter((event) => event.type === eventType)
            : sorted;
    } catch (error) {
        if (error instanceof GeoritmApiError && error.isUnauthorized) {
            deleteSession(auth.sessionId);
        }
        throw error;
    }
};
