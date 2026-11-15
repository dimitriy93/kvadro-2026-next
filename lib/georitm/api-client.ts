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

    /**
     * Метод отсутствует на установленной версии сервера. Сигнатура
     * зафиксирована на 2.27.0 (E9) и отличима от остальных ошибок:
     * HTTP 400 с телом {"status":500,"message":"HTTP 404 Not Found"}
     * — одинаково для любого тела запроса и стабильно при повторах;
     * чужой/несуществующий объект при этом даёт 401, а параметры
     * существующих методов с невалидным телом — иной текст ошибки.
     * Свойство означает «сервер такой версии не реализует ресурс»,
     * а не «функция не настроена для объекта».
     */
    get isMethodMissing(): boolean {
        return this.kind === 'http'
            && this.status === 400
            && this.serverMessage === 'HTTP 404 Not Found';
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
        // Документированный формат ошибки: {msg, hdr, data}. Фактически
        // встречается и {status, message} — сигнатура отсутствующего метода
        // (E9: channels/ на 2.27.0). Оставляем только короткий текст;
        // сырое тело ошибки не сохраняем и не логируем.
        let serverMessage: string | null = null;
        try {
            const parsed: unknown = JSON.parse(text);
            if (parsed && typeof parsed === 'object') {
                const record = parsed as Record<string, unknown>;
                serverMessage = typeof record.msg === 'string' && record.msg.length > 0
                    ? record.msg
                    : typeof record.message === 'string' && record.message.length > 0
                        ? record.message
                        : null;
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

/**
 * Характеристики канала связи из ответа channels/ (документация «Georitm
 * REST API.docx», ресурс channels). Поля приходят частично: «level» и
 * «percent» могут отсутствовать; недостающий уровень добирается отдельным
 * методом channels/level/ (в кабинете не используется — один запрос).
 */
export interface GeoritmChannelSignal {
    /** SIM: карта установлена (0/1, приходит всегда). */
    inserted?: number;
    /** SIM: регистрация в сети (0/1, приходит всегда). */
    online?: number;
    /** Уровень сигнала: SIM 0–5, WIFI 0–4 (может отсутствовать). */
    level?: number;
    /** Качество сигнала, проценты 0–100 (может отсутствовать). */
    percent?: number;
    /** LAN: кабель подключён (0/1). */
    connected?: number;
    [key: string]: unknown;
}

/**
 * Ответ channels/ (документация). Активный канал — активныйChannel,
 * состав каналов — channels[]; характеристики передаются не для всех
 * каналов. E9: на сервере 2.27.0 метод не реализован (сигнатура
 * «HTTP 404 Not Found») — тип по документации, проверка при появлении.
 */
export interface GeoritmChannelsResponse {
    activeChannel?: string;
    channels?: string[];
    SIM_1?: GeoritmChannelSignal;
    SIM_2?: GeoritmChannelSignal;
    LAN?: GeoritmChannelSignal;
    WIFI?: GeoritmChannelSignal;
    [key: string]: unknown;
}

/**
 * Проекция ответа objects/obj-details/ для диагностики питания (E9).
 * power{} документирован «только для мобильных объектов»: state 0 —
 * основное питание, 1 — резервное; voltage — бортовое напряжение (В).
 * Полный ответ содержит персональные и чувствительные поля — наружу
 * отдаётся только проекция power, выполняет её GeoritmSource.
 */
export interface GeoritmObjectDetails {
    objType?: string;
    power?: {
        name?: string;
        /** 0 — основное питание, 1 — резервное. */
        state?: number;
        /** Бортовое напряжение, вольты. */
        voltage?: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
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

/**
 * Расширенные сведения об объекте objects/obj-details/ с callDevice=false:
 * данные отдаются из состояния сервера без обращения к прибору (документация,
 * параметр callDevice). Используется для диагностики питания (E9); полный
 * ответ содержит чувствительные поля — проекцию выполняет GeoritmSource.
 *
 * E11 (проба 2.27.0): параметр objectId передаётся ТОЛЬКО массивом.
 * Скалярное значение вызывает HTTP 500 «java.lang.Integer cannot be cast
 * to java.util.Collection» — сервер приводит параметр к коллекции.
 * Сериализация массивом проверяется smoke-сценарием scripts/control-smoke.mjs.
 */
export const georitmObjectDetails = async (basic: string, objectId: number): Promise<GeoritmObjectDetails> =>
    callGeoritm<GeoritmObjectDetails>('objects/obj-details/', {objectId: [objectId], callDevice: false}, basic);

/**
 * Разделы объекта objects/obj-areas/ (read-only). Контракт подтверждён
 * пробой E11 на сервере 2.27.0: флаги isGuarded/hasFault/hasAlarm разделов
 * приходят всегда (в отличие от obj-details/, где они появляются только
 * при callDevice=true). Используется для разрешения допустимых разделов
 * и состояний охраны (E12). Ответ — плоский массив; неожиданный формат —
 * ошибка, а не пустой список.
 */
export const georitmObjectAreas = async (basic: string, objectId: number): Promise<GeoritmArea[]> => {
    const response = await callGeoritm<GeoritmArea[] | {areas?: GeoritmArea[]}>(
        'objects/obj-areas/',
        {objectId},
        basic,
    );
    const areas = Array.isArray(response) ? response : response?.areas;
    if (!Array.isArray(areas)) {
        throw new GeoritmApiError('http', 200, null, 'Неожиданный формат objects/obj-areas/');
    }
    return areas;
};

/**
 * Ответ objects/arm/ и objects/disarm/. Документация: «Результат исполнения
 * 1-выполнено», прочие значения не документированы. По совокупности с IDP
 * (E11) значение 1 означает лишь ПРИЁМ команды сервером (в лучшем случае —
 * передачу прибору) и не является доказательством исполнения: фактическое
 * состояние подтверждает только objects/state/ и события журнала группы 4.
 */
export interface GeoritmCommandResponse {
    success?: number;
}

/**
 * Взятие раздела под охрану objects/arm/ (E12). WRITE-метод: вызывается
 * исключительно серверным модулем управления охраной при включённом
 * feature gate GEORITM_CONTROL_ENABLED после проверки владения объектом,
 * прав и разрешения IMEI/раздела на сервере. Контракт: POST {imei: String,
 * area: Integer} → {success: Integer}; других параметров у метода нет.
 */
export const georitmArm = async (basic: string, imei: string, area: number): Promise<GeoritmCommandResponse> =>
    callGeoritm<GeoritmCommandResponse>('objects/arm/', {imei, area}, basic);

/**
 * Снятие раздела с охраны objects/disarm/ (E12). WRITE-метод: ограничения
 * вызова те же, что у georitmArm. Контракт симметричен objects/arm/.
 */
export const georitmDisarm = async (basic: string, imei: string, area: number): Promise<GeoritmCommandResponse> =>
    callGeoritm<GeoritmCommandResponse>('objects/disarm/', {imei, area}, basic);

/**
 * Каналы связи и уровни сигнала channels/ (read-only, документация).
 * E9: на сервере 2.27.0 ресурс не реализован — вызов завершится ошибкой
 * с isMethodMissing; вызывающая сторона классифицирует её как 'unsupported',
 * не как ошибку объекта или отсутствие прав.
 */
export const georitmChannels = async (basic: string, objectId: number): Promise<GeoritmChannelsResponse> =>
    callGeoritm<GeoritmChannelsResponse>('channels/', {objectId}, basic);

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
 * Ответ отчёта reports/{type}/{format} в файловом формате (E4.3).
 * Подтверждено на сервере 2.27.0: PDF — application/pdf, Excel —
 * XLSX-байты (PK-сигнатура, content-type application/vnd.ms-excel).
 * Заголовки ответа наружу не пробрасываются — Content-Type/Content-
 * Disposition для браузера строит серверная сторона кабинета.
 */
export interface GeoritmReportFile {
    contentType: string | null;
    content: Uint8Array;
}

/**
 * Предельный размер файла отчёта. Ответ читается целиком в память —
 * без ограничения аномально большой ответ GEORITM (или его сбой) мог бы
 * исчерпать память экземпляра. Для подтверждённых типов отчётов за
 * подтверждённый максимум периода (31 день) реальные файлы на порядки
 * меньше; значение с запасом, не от протокола.
 */
const REPORT_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Вызов отчёта `reports/{type}/{format}` с файловым ответом (E4.3,
 * read-only). В отличие от callGeoritm тело не парсится как JSON;
 * классификация ошибок та же. Заголовки ответа GEORITM (включая
 * Content-Disposition с фиксированным именем файла) наружу не отдаются.
 *
 * Формирование отчёта синхронное и может занимать больше обычного
 * вызова — тайм-аут задаёт вызывающая сторона.
 */
export const callGeoritmReport = async (
    type: string,
    format: 'pdf' | 'excel',
    body: Record<string, unknown>,
    basic: string,
    timeoutMs: number,
): Promise<GeoritmReportFile> => {
    if (!georitmConfigured()) {
        throw new GeoritmApiError('network', null, null, 'GEORITM_BASE_URL не задан или не содержит протокол');
    }

    const url = `${baseUrl()}/restapi/reports/${type}/${format}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/pdf, application/vnd.ms-excel, */*',
                Authorization: `Basic ${basic}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new GeoritmApiError('timeout', null, null, `Тайм-аут ${timeoutMs} мс: reports/${type}/${format}`);
        }
        throw new GeoritmApiError('network', null, null, `Нет соединения с GEORITM: reports/${type}/${format}`);
    } finally {
        clearTimeout(timer);
    }

    if (response.status !== 200) {
        // Документированный формат ошибки — {msg, hdr, data}; оставляем
        // только msg. Сырое тело (может быть PDF-ошибкой) не сохраняется.
        let serverMessage: string | null = null;
        try {
            const parsed: unknown = JSON.parse(await response.text());
            if (parsed && typeof parsed === 'object') {
                const record = parsed as Record<string, unknown>;
                serverMessage = typeof record.msg === 'string' ? record.msg : null;
            }
        } catch {
            // Тело ошибки не JSON — классифицируем по статусу.
        }
        throw new GeoritmApiError('http', response.status, serverMessage, `HTTP ${response.status}: reports/${type}/${format}`);
    }

    // Размер известен из заголовка — читаем тело только при допустимом объёме.
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > REPORT_MAX_BYTES) {
        throw new GeoritmApiError('http', response.status, null, `Ответ отчёта превышает ${REPORT_MAX_BYTES} байт: reports/${type}/${format}`);
    }

    const content = new Uint8Array(await response.arrayBuffer());
    if (content.length > REPORT_MAX_BYTES) {
        throw new GeoritmApiError('http', response.status, null, `Ответ отчёта превышает ${REPORT_MAX_BYTES} байт: reports/${type}/${format}`);
    }
    return {contentType: response.headers.get('content-type'), content};
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

/**
 * История за период alerts/history-on-obj/ (read-only, E10). Контракт
 * подтверждён пробой на сервере 2.27.0 (docs/development/17):
 *  - from/to — Unix time В МИЛЛИСЕКУНДАХ (окно в секундах даёт пустой ответ);
 *  - фильтрация и сортировка идут по receivedAt (времени получения
 *    станцией), а не по alertTs: записи с alertTs из 2003 г., но
 *    receivedAt в 2026 г., возвращаются окном 2026 года;
 *  - границы включающие на миллисекундной точности; у действий
 *    (ObjectAlertLog) хранимая метка суб-секундная — сериализованное
 *    receivedAt может отличаться от хранимого до ~1 с, поэтому границы
 *    порций обязаны перекрываться с дедупликацией по id (слой event-journal);
 *  - параметров limit/offset/cursor нет, ответ — все записи окна;
 *    from=null → «со времени последнего сброса», to=null → «по текущее
 *    время» (кабинет всегда передаёт обе границы явно);
 *  - чужой/несуществующий objectId → HTTP 401 (поэтому вызов выполняется
 *    только после собственной проверки владения в GeoritmSource).
 *
 * Ожидаемый формат — плоский массив; неожиданный формат — ошибка, а не
 * пустой список: отсутствие данных не должно выглядеть как «истории нет».
 */
export const georitmHistoryOnObject = async (
    basic: string,
    objectId: number,
    fromMs: number,
    toMs: number,
): Promise<GeoritmHistoryRecord[]> => {
    const response = await callGeoritm<GeoritmHistoryRecord[] | {alerts?: GeoritmHistoryRecord[]; history?: GeoritmHistoryRecord[]}>(
        'alerts/history-on-obj/',
        {objectId, from: fromMs, to: toMs},
        basic,
    );
    const records = Array.isArray(response) ? response : response?.alerts ?? response?.history;
    if (!Array.isArray(records)) {
        throw new GeoritmApiError('http', 200, null, 'Неожиданный формат alerts/history-on-obj/');
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
