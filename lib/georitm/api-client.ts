/**
 * Серверный клиент GEORITM REST API.
 *
 * Только для серверного кода Next.js (Node.js runtime): модуль читает
 * переменные окружения и оперирует GEORITM Basic-credentials — они не должны
 * попадать в клиентский bundle, cookie, HTML и логи. Не импортировать из
 * клиентских компонентов.
 *
 * Соглашения API (GEO RITM/REST-API-ANALYSIS.md, раздел 3):
 *  - все вызовы — HTTP POST с JSON-телом, UTF-8;
 *  - URL: `<base>/restapi/<ресурс>/<метод>/<формат>`; замыкающий слэш
 *    обязателен у `<метод>`, формат через одиночный слэш — двойные слэши
 *    не допускаются;
 *  - ошибки: HTTP 400/401/500 с телом `{msg, hdr, data}`; тело ошибки
 *    сокращается до msg/hdr — сырое тело не сохраняется и не логируется.
 *
 * Реальные факты (диагностический прогон, GEORITM 2.27.0):
 *  - stateless-клиенты работают через `Authorization: Basic <basic>`;
 *  - ответ users/login/ содержит эхо пароля и Basic — полный ответ
 *    из этого модуля наружу не отдаётся.
 */

/** Классифицированная ошибка вызова GEORITM. */
export class GeoritmApiError extends Error {
    readonly kind: 'network' | 'timeout' | 'http';
    readonly status: number | null;
    /** Короткое сообщение сервера из документированного формата ошибки. */
    readonly serverMessage: string | null;

    constructor(kind: 'network' | 'timeout' | 'http', status: number | null, serverMessage: string | null, message: string) {
        super(message);
        this.name = 'GeoritmApiError';
        this.kind = kind;
        this.status = status;
        this.serverMessage = serverMessage;
    }

    /** HTTP 401 — Basic-credentials недействительны, сессию кабинета нужно завершить. */
    get isUnauthorized(): boolean {
        return this.kind === 'http' && this.status === 401;
    }
}

const REQUEST_TIMEOUT_MS = 10_000;

export const georitmConfigured = (): boolean => {
    const base = process.env.GEORITM_BASE_URL?.trim();
    return typeof base === 'string' && /^https?:\/\//.test(base);
};

const baseUrl = (): string => process.env.GEORITM_BASE_URL!.trim().replace(/\/+$/, '');

/**
 * Один POST-вызов `<base>/restapi/<method>/json`.
 *
 * `method` — путь ресурса с завершающим слэшем ('users/login/');
 * завершающий слэш нормализуется, чтобы не образовался двойной слэш
 * перед форматом ответа.
 *
 * Заголовок Authorization передаётся, но никогда не выводится и не логируется.
 */
export const callGeoritm = async <T>(
    method: string,
    body: Record<string, unknown> | null,
    basic?: string,
    timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<T> => {
    if (!georitmConfigured()) {
        throw new GeoritmApiError('network', null, null, 'GEORITM_BASE_URL не задан или не содержит протокол');
    }

    const url = `${baseUrl()}/restapi/${method.replace(/\/+$/, '')}/json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: '*/*',
                ...(basic ? {Authorization: `Basic ${basic}`} : {}),
            },
            body: JSON.stringify(body ?? {}),
            signal: controller.signal,
            // TLS-проверка сертификата остаётся включённой по умолчанию.
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new GeoritmApiError('timeout', null, null, `Тайм-аут ${timeoutMs} мс: ${method}`);
        }
        throw new GeoritmApiError('network', null, null, `Нет соединения с GEORITM: ${method}`);
    } finally {
        clearTimeout(timer);
    }

    const text = await response.text();

    if (response.status !== 200) {
        // Документированный формат ошибки: {msg, hdr, data}. Оставляем
        // только msg/hdr; сырое тело ошибки не сохраняем и не логируем.
        let serverMessage: string | null = null;
        try {
            const parsed: unknown = JSON.parse(text);
            if (parsed && typeof parsed === 'object') {
                const record = parsed as Record<string, unknown>;
                serverMessage = typeof record.msg === 'string' ? record.msg : null;
            }
        } catch {
            // Тело ошибки не JSON — классифицируем по статусу.
        }
        throw new GeoritmApiError('http', response.status, serverMessage, `HTTP ${response.status}: ${method}`);
    }

    try {
        return JSON.parse(text) as T;
    } catch {
        throw new GeoritmApiError('http', response.status, null, `Некорректный JSON в ответе: ${method}`);
    }
};

// ——————————————————————————— Типизация подтверждённых ответов ————————

/** Ответ users/login/. Содержит пароль и Basic — наружу не отдаётся. */
export interface GeoritmLoginResponse {
    id: number;
    username?: string;
    isAdmin?: 0 | 1;
    disabled?: 0 | 1;
    allowedActions?: string[];
    hasStationary?: boolean;
    stationaryCount?: number;
    hasMobile?: boolean;
    mobileCount?: number;
    /** Готовый Basic-заголовок (base64(login:password), без префикса). */
    basic?: string;
    [key: string]: unknown;
}

/** Состояние стационарного объекта (objects/obj/ и дерево объектов). */
export interface GeoritmObjectState {
    isOnline?: 0 | 1;
    isGuarded?: 0 | 1 | 2;
    hasFault?: 0 | 1 | 2;
    hasAlarm?: 0 | 1 | 2;
}

/**
 * Запись прибора из devices[] (objects/obj/ и obj-details/, подтверждено
 * на сервере 2.27.0). Содержит imei — наружу отдаётся только whitelist
 * (name/shortName/firmware), проекцию выполняет GeoritmSource.
 */
export interface GeoritmDevice {
    name?: string;
    shortName?: string;
    firmware?: string;
    description?: string;
    imei?: string;
    [key: string]: unknown;
}

/** Краткая запись объекта в дереве objects/objects-tree-set/ и в objects/obj/. */
export interface GeoritmObjectSummary {
    id: number;
    extId?: number;
    name?: string;
    /** '0' — мобильный, '1' — стационарный. */
    objType?: string;
    objStatus?: number;
    imei?: string;
    addressShort?: string;
    city?: string;
    street?: string;
    house?: string;
    lat?: number;
    lon?: number;
    isGsmOnline?: 0 | 1;
    isGpsOnline?: 0 | 1;
    hasAlarm?: 0 | 1 | 2;
    objectState?: GeoritmObjectState;
    lastGSMConnectionTime?: number | string;
    lastGPSConnectionTime?: number | string;
    canArm?: 0 | 1;
    /** Приборы объекта (объект/obj/, наблюдение 2.27.0; в документации не описан). */
    devices?: GeoritmDevice[];
    [key: string]: unknown;
}

/** Группа дерева объектов (рекурсивная). */
export interface GeoritmObjectGroup {
    id?: number;
    name?: string;
    objs?: GeoritmObjectSummary[];
    objsGroups?: GeoritmObjectGroup[];
    [key: string]: unknown;
}

/** Ответ objs-groups/group/ — фактически объект {objects, groups} (2.27.0). */
export interface GeoritmGroupsResponse {
    objects?: GeoritmObjectSummary[];
    groups?: GeoritmObjectGroup[];
}

/** Раздел объекта (obj-card/ и obj-areas/). */
export interface GeoritmArea {
    num?: number;
    id?: number;
    name?: string;
    comment?: string;
    isGuarded?: boolean;
    hasFault?: 0 | 1 | 2 | boolean;
    hasAlarm?: 0 | 1 | 2 | boolean;
    zones?: GeoritmAreaZone[];
    [key: string]: unknown;
}

/** Зона охранно-пожарного оборудования внутри раздела. */
export interface GeoritmAreaZone {
    num?: number;
    id?: number;
    name?: string;
    comment?: string;
    hasFault?: boolean;
    hasAlarm?: boolean;
    [key: string]: unknown;
}

/**
 * Ответ objects/obj-card/. Содержит settings с чувствительными полями
 * (PASS, RESPONSIVE_PERSONS) — наружу отдаётся только обезличенная
 * проекция; полный ответ не логируется.
 */
export interface GeoritmObjectCard {
    id?: number;
    item?: {id?: number; name?: string; deviceTypeId?: number; deviceTypeName?: string; [key: string]: unknown};
    objsGroups?: unknown[];
    hasFault?: boolean;
    areas?: GeoritmArea[];
    settings?: Record<string, unknown>;
    [key: string]: unknown;
}

/** Ответ objects/get-status/. */
export interface GeoritmObjectStatus {
    objStatus?: number;
}

/** Ответ objects/state/ — словарь «номер раздела → 1 снят / 2 под охраной». */
export interface GeoritmPartitionsState {
    state?: Record<string, number>;
}

/**
 * Запись неисправности objects/obj-faults/ (E4.2, подтверждено на сервере
 * 2.27.0: faultCode 301 «Неисправность сети 220», 302 «Разряд аккумулятора»,
 * 308 «Выключение системы»). Список — активные неисправности (их снимает
 * objects/clear-faults/); справочника кодов в документации нет, смысл —
 * только по messageText сервера.
 */
export interface GeoritmObjectFault {
    areaZoneId?: number;
    areaZoneName?: string | null;
    areaZoneNum?: number;
    areaNum?: number;
    areaName?: string | null;
    faultCode?: number;
    messageText?: string;
    [key: string]: unknown;
}

/**
 * Шаблон события из alert-template/list/ (E2.0, сервер 2.27.0). code —
 * число; связь с кодом журнала «NNN.N» — удаление точки. Справочник
 * наружу не отдаётся (может содержать клиентские шаблоны).
 */
export interface GeoritmAlertTemplate {
    id?: number;
    code?: number;
    groupId?: number;
    message?: string;
    isAlarm?: boolean;
    isVisible?: boolean;
    isRelayed?: boolean;
    bgColor?: string;
    fgColor?: string;
    clientId?: number | null;
    isBaseCode?: boolean;
    version?: number;
    [key: string]: unknown;
}

/** Событие оборудования (type="ObjectAlert") из alerts/history-by-obj/. */
export interface GeoritmObjectAlert {
    type?: 'ObjectAlert';
    alertId?: number;
    /** Unix time мс, время события по прибору (E2.0). */
    alertTs?: number;
    /** Unix time мс, время получения станцией (E2.0). */
    receivedAt?: number;
    isAlarm?: boolean;
    /** Строка вида «NNN.N» (E2.0). */
    code?: string;
    messageText?: string;
    area?: number;
    areaZone?: number;
    isKey?: boolean;
    bgColor?: string;
    fgColor?: string;
    channelName?: string;
    objectId?: number;
    objStatus?: number;
    [key: string]: unknown;
}

/** Действие пользователя/оператора (type="ObjectAlertLog") из history-by-obj/. */
export interface GeoritmObjectAlertLog {
    type?: 'ObjectAlertLog';
    id?: number;
    /** 1 — закрытие тревоги, 2 — комментарий (документация; подтверждён 1). */
    actionType?: number;
    comment?: string;
    /** Unix time мс (E2.0). */
    receivedAt?: number;
    userName?: string;
    userId?: number;
    objectId?: number;
    extId?: number;
    [key: string]: unknown;
}

export type GeoritmHistoryRecord = GeoritmObjectAlert | GeoritmObjectAlertLog;

// ——————————————————————————————————— Обёртки методов ————————

export const georitmLogin = async (login: string, password: string): Promise<GeoritmLoginResponse> =>
    callGeoritm<GeoritmLoginResponse>('users/login/', {login, password});

export const georitmLogout = async (basic: string): Promise<void> => {
    await callGeoritm('users/logout/', null, basic);
};

/**
 * Дерево объектов текущего пользователя (плоский список собирается
 * вызывающей стороной). groupType=1 — стационарные объекты.
 */
export const georitmTreeSet = async (basic: string): Promise<GeoritmObjectGroup[]> => {
    const response = await callGeoritm<GeoritmObjectGroup[] | {groups?: GeoritmObjectGroup[]}>(
        'objects/objects-tree-set/',
        {groupType: 1, sort: 'name'},
        basic,
    );
    const groups = Array.isArray(response) ? response : response?.groups;
    if (!Array.isArray(groups)) {
        throw new GeoritmApiError('http', 200, null, 'Неожиданный формат objects/objects-tree-set/');
    }
    return groups;
};

export const georitmObjects = async (basic: string, objectIds: number[]): Promise<GeoritmObjectSummary[]> => {
    const response = await callGeoritm<GeoritmObjectSummary[] | {objects?: GeoritmObjectSummary[]}>(
        'objects/obj/',
        {objectId: objectIds},
        basic,
    );
    const objects = Array.isArray(response) ? response : response?.objects;
    if (!Array.isArray(objects)) {
        throw new GeoritmApiError('http', 200, null, 'Неожиданный формат objects/obj/');
    }
    return objects;
};

/** Карточка объекта. Результат содержит чувствительные settings — фильтрует GeoritmSource. */
export const georitmObjectCard = async (basic: string, objectId: number): Promise<GeoritmObjectCard> =>
    callGeoritm<GeoritmObjectCard>('objects/obj-card/', {objectId}, basic);

export const georitmObjectStatus = async (basic: string, objectId: number): Promise<GeoritmObjectStatus> =>
    callGeoritm<GeoritmObjectStatus>('objects/get-status/', {objectId}, basic);

export const georitmPartitionsState = async (basic: string, imei: string): Promise<GeoritmPartitionsState> =>
    callGeoritm<GeoritmPartitionsState>('objects/state/', {imei}, basic);

/**
 * Активные неисправности объекта objects/obj-faults/ (read-only, E4.2).
 * Ответ — плоский массив записей; неожиданный формат — ошибка, а не пустой
 * список: отсутствие данных не должно выглядеть как «неисправностей нет».
 */
export const georitmObjectFaults = async (basic: string, objectId: number): Promise<GeoritmObjectFault[]> => {
    const response = await callGeoritm<GeoritmObjectFault[] | {faults?: GeoritmObjectFault[]}>(
        'objects/obj-faults/',
        {objectId},
        basic,
    );
    const faults = Array.isArray(response) ? response : response?.faults;
    if (!Array.isArray(faults)) {
        throw new GeoritmApiError('http', 200, null, 'Неожиданный формат objects/obj-faults/');
    }
    return faults;
};

/**
 * Справочник шаблонов событий alert-template/list/ (read-only). Приходит
 * целиком (~1200 записей), кэшируется вызывающей стороной по пользователю.
 */
export const georitmAlertTemplates = async (basic: string): Promise<GeoritmAlertTemplate[]> => {
    const response = await callGeoritm<GeoritmAlertTemplate[] | {templates?: GeoritmAlertTemplate[]}>(
        'alert-template/list/',
        {},
        basic,
    );
    const templates = Array.isArray(response) ? response : response?.templates;
    if (!Array.isArray(templates)) {
        throw new GeoritmApiError('http', 200, null, 'Неожиданный формат alert-template/list/');
    }
    return templates;
};

/**
 * История событий и действий объекта alerts/history-by-obj/ (read-only).
 * Ответ — плоский массив записей ObjectAlert/ObjectAlertLog, порядок
 * не гарантирован (E2.0); сортирует вызывающая сторона.
 */
export const georitmHistoryByObject = async (basic: string, objectId: number): Promise<GeoritmHistoryRecord[]> => {
    const response = await callGeoritm<GeoritmHistoryRecord[] | {alerts?: GeoritmHistoryRecord[]; history?: GeoritmHistoryRecord[]}>(
        'alerts/history-by-obj/',
        {objectId},
        basic,
    );
    const records = Array.isArray(response) ? response : response?.alerts ?? response?.history;
    if (!Array.isArray(records)) {
        throw new GeoritmApiError('http', 200, null, 'Неожиданный формат alerts/history-by-obj/');
    }
    return records;
};

/** Собирает плоский список объектов из рекурсивного дерева групп. */
export const flattenGeoritmTree = (groups: GeoritmObjectGroup[]): GeoritmObjectSummary[] => {
    const result: GeoritmObjectSummary[] = [];
    const seen = new Set<number>();
    const walk = (nodes: GeoritmObjectGroup[]): void => {
        for (const group of nodes) {
            for (const object of group.objs ?? []) {
                if (typeof object?.id === 'number' && !seen.has(object.id)) {
                    seen.add(object.id);
                    result.push(object);
                }
            }
            if (group.objsGroups) {
                walk(group.objsGroups);
            }
        }
    };
    walk(groups);
    return result;
};
