/**
 * Контракты личного кабинета — внутренние DTO, общие для всех источников
 * данных (демо и GEORITM). UI работает только с этими типами и не знает
 * о формате ответов внешнего API.
 *
 * Источник данных выбирается переменной окружения ACCOUNT_DATA_SOURCE
 * (см. lib/account/source.ts). Демо-значения вымышлены и не являются
 * данными реального оборудования или GEORITM.
 */

/** Состояние охранной сигнализации объекта. */
export type SecurityAlarmState = 'armed' | 'disarmed' | 'partial' | 'alarm' | 'fault';

/** Состояние пожарной сигнализации объекта. */
export type FireAlarmState = 'normal' | 'alarm' | 'fault' | 'maintenance' | 'unknown';

/** Состояние связи мониторинговой станции с объектом. */
export type ConnectionState = 'online' | 'unstable' | 'offline';

/**
 * Сведения о приборе (контрольной панели) объекта. Whitelist-проекция
 * GEORITM devices[]: модель, короткое имя и прошивка. Остальные поля
 * записи прибора (включая imei) в DTO не переносятся.
 */
export interface ObjectDeviceInfo {
    name: string;
    /** Короткое имя модели, если задано. */
    shortName?: string;
    /** Версия прошивки прибора, если известна. */
    firmware?: string;
}

/**
 * Активная неисправность оборудования объекта (GEORITM obj-faults/).
 *
 * `message` — текст, предоставленный сервером GEORITM; семантика `code`
 * справочником не документирована (кроме примеров), поэтому UI показывает
 * только текст сервера и код во второстепенном виде.
 */
export interface ObjectFault {
    id: string;
    /** Код неисправности GEORITM. */
    code: number;
    /** Текст неисправности от сервера (рус.). */
    message: string;
    /** Номер раздела, если известен. */
    areaNum?: number;
    /** Номер зоны, если известен. */
    zoneNum?: number;
}

/**
 * Объект мониторинга.
 *
 * `id` — внутренний идентификатор кабинета; для GEORITM это строка от
 * числового `id` объекта (стабилен в рамках инсталляции). `extId` —
 * внешний номер объекта договорного учёта, `imei` не включён в DTO:
 * он нужен только для вызовов оборудования и не предназначен для UI.
 *
 * `updatedAt` — время последнего обновления состояния (ISO 8601), если
 * источник его достоверно знает; иначе undefined — UI не показывает дату.
 */
export interface MonitorObject {
    id: string;
    name: string;
    address: string;
    /** Внешний номер объекта (GEORITM extId), если известен. */
    extId?: number;
    /** Прибор объекта, если источник сообщил; иначе undefined — UI не показывает карточку прибора. */
    device?: ObjectDeviceInfo;
    securityAlarm: SecurityAlarmState;
    fireAlarm: FireAlarmState;
    connection: ConnectionState;
    updatedAt?: string;
}

/** Система, к которой относится зона объекта. */
export type ZoneSystem = 'security' | 'fire';

/**
 * Зона (шлейф) объекта. Дискриминированное объединение связывает систему
 * зоны с допустимыми состояниями: у охранной и пожарной зоны разные наборы
 * состояний, смешать их в одном поле невозможно.
 *
 * `num` — номер зоны в приборе, `comment` — комментарий GEORITM, если
 * задан. Классификации «охранная/пожарная» в GEORITM нет (вопрос B7):
 * у реального источника system всегда 'security'.
 */
export type ObjectZone =
    | {
        id: string;
        name: string;
        /** Номер зоны в приборе (GEORITM zones[].num), если известен. */
        num?: number;
        /** Комментарий зоны GEORITM, если задан. */
        comment?: string;
        system: 'security';
        state: SecurityAlarmState;
    }
    | {
        id: string;
        name: string;
        num?: number;
        comment?: string;
        system: 'fire';
        state: FireAlarmState;
    };

/**
 * Раздел объекта (GEORITM areas[]): группа зон охранно-пожарного
 * оборудования с собственным состоянием охраны. Раздел с пустым
 * zones — реальная ситуация (раздел без настроенных зон), а не ошибка.
 */
export interface ObjectZoneSection {
    id: string;
    name: string;
    /** Номер раздела в приборе (GEORITM areas[].num), если известен. */
    num?: number;
    /** Комментарий раздела GEORITM, если задан. */
    comment?: string;
    /** Состояние раздела: тревога > неисправность > охрана. */
    state: SecurityAlarmState;
    zones: ObjectZone[];
}

/** Тип записи журнала событий. */
export type MonitorEventType =
    | 'security_armed'
    | 'security_disarmed'
    | 'security_alarm'
    | 'security_fault'
    | 'fire_alarm'
    | 'fire_fault'
    | 'fire_maintenance'
    | 'connection_lost'
    | 'connection_restored'
    | /** Восстановление (исходное событие достоверно неизвестно). */ 'restored'
    | 'system';

/** Запись журнала событий объекта. */
export interface MonitorObjectEvent {
    id: string;
    objectId: string;
    /** ISO 8601, время возникновения (у действий — время выполнения). */
    occurredAt: string;
    type: MonitorEventType;
    /** Короткое человекочитаемое описание. */
    message: string;
    /** Зона, к которой относится событие, если применимо. */
    zoneName?: string;
    /**
     * ISO 8601, время получения станцией (только для событий оборудования).
     * У импортированных событий может существенно отличаться от occurredAt.
     */
    receivedAt?: string;
    /** Код события GEORITM в исходном виде «NNN.N» (только для событий). */
    code?: string;
    /** Признак тревоги (справочник GEORITM; группа 3 тоже даёт true). */
    isAlarm?: boolean;
    /** Запись — действие пользователя или оператора станции. */
    isUserAction?: boolean;
    /** Кто выполнил действие (только для isUserAction). */
    userName?: string;
}

/**
 * Тип отчёта объекта, разрешённый в кабинете (E4.3). Белый список —
 * только типы, подтверждённые на реальном сервере GEORITM 2.27.0
 * (метод reports/ со списком типов на сервере недоступен). Каждому типу
 * соответствует метод reports/{GEORITM_TYPE}/{format} из документации.
 */
export type ObjectReportType =
    /** Сводный отчёт по событиям и тревогам (GEORITM ALERTSUM). */
    | 'alerts-summary'
    /** События и тревоги — детальный отчёт (GEORITM ALERTS). */
    | 'alerts-events';

/**
 * Формат файла отчёта. Подтверждены на сервере для ALERTSUM (PDF и
 * XLSX-байты); для ALERTS механизм тот же по документации.
 */
export type ObjectReportFormat = 'pdf' | 'excel';

/** Параметры запроса отчёта объекта (период — календарные дни, МСК). */
export interface ObjectReportRequest {
    type: ObjectReportType;
    /** Дата начала периода, YYYY-MM-DD. */
    from: string;
    /** Дата конца периода, YYYY-MM-DD (включительно). */
    to: string;
    /** Файл отчёта; в демонстрационном источнике игнорируется (CSV). */
    format: ObjectReportFormat;
}

/**
 * Готовый файл отчёта (E4.3). Содержимое — байты, курсируют только по
 * серверной цепочке «источник → API-маршрут → бинарный ответ» и никогда
 * не сериализуются в JSON DTO браузера.
 *
 * `filename` — имя файла для Content-Disposition (строит источник,
 * маршруты только кодируют); `contentType` — MIME-тип для ответа
 * (у демо-источника text/csv, у GEORITM — по формату отчёта).
 */
export interface ObjectReportFile {
    filename: string;
    contentType: string;
    content: Uint8Array;
}

// ————————————————— Диагностика каналов связи и питания (E9) ————————

/**
 * Доступность блока данных диагностики. Различает постоянную
 * недоступность (нет поддержки/настройки) и временную ошибку получения:
 * ошибка API не превращается в «функции нет», отсутствие данных —
 * в «всё нормально» (принципы E8, раздел 6).
 *
 * Не встречающиеся на текущем сервере значения ('no-access',
 * 'device-unreachable') оставлены в модели: обработка ошибок должна
 * знать эти причины заранее, а не узнавать о них появлением.
 */
export type DiagnosticsAvailability =
    /** Данные получены от источника. */
    | 'available'
    /** Метод не поддерживается установленной версией сервера GEORITM. */
    | 'unsupported'
    /** Тип прибора/объекта не передаёт эти данные (документировано GEORITM). */
    | 'not-provided'
    /** Нет прав доступа к данным (read-методы прав не различают — defensively). */
    | 'no-access'
    /** Оборудование объекта недоступно для получения данных. */
    | 'device-unreachable'
    /** Временная ошибка API (сеть, тайм-аут, 5xx, неожиданный ответ). */
    | 'error'
    /** Данные отсутствуют в успешном ответе сервера. */
    | 'absent'
    /** Причину недоступности установить не удалось. */
    | 'unknown';

/** Канал связи прибора (GEORITM channels/, документированный набор). */
export interface CommunicationChannel {
    /** Тип канала — документированный перечень GEORITM. */
    kind: 'SIM_1' | 'SIM_2' | 'LAN' | 'WIFI';
    /** SIM: карта установлена (документировано, 0/1). */
    inserted?: boolean;
    /** SIM: регистрация в сети оператора (документировано, 0/1). */
    online?: boolean;
    /** LAN: кабель подключён (документировано, 0/1). */
    connected?: boolean;
    /** Уровень сигнала: SIM 0–5, Wi-Fi 0–4 (документированная шкала). */
    level?: number;
    /** Качество сигнала в процентах 0–100 (документировано). */
    percent?: number;
}

/**
 * Диагностика каналов связи объекта (E9). Переносятся только документированные
 * поля ответа channels/; SIM-идентификаторы, номера и прочие чувствительные
 * данные в DTO не попадают — канал идентифицируется только слотом (SIM_1/SIM_2).
 *
 * `fetchedAt` — момент получения данных сервером кабинета (ISO 8601), только
 * для 'available': это время запроса кабинета, а не время измерения прибора.
 */
export interface CommunicationDiagnostics {
    availability: DiagnosticsAvailability;
    /** Активный канал связи, если сервер его сообщил. */
    activeChannel?: CommunicationChannel['kind'];
    /** Каналы, фактически присутствующие в ответе сервера. */
    channels: CommunicationChannel[];
    /** ISO 8601, момент получения данных (только для 'available'). */
    fetchedAt?: string;
}

/**
 * Диагностика питания прибора (E9). Источник — поле power{} ответа
 * objects/obj-details/: документировано только для мобильных приборов
 * («state: 0 — основное питание, 1 — резервное»; voltage — бортовое
 * напряжение в вольтах). У стационарных приборов поле отсутствует —
 * состояние 'not-provided'; проблемы питания стационарных объектов видны
 * в списке активных неисправностей (коды 301 «сеть 220», 302 «разряд
 * аккумулятора», подтверждены на сервере 2.27.0).
 */
export interface PowerDiagnostics {
    availability: DiagnosticsAvailability;
    /** Текущее питание: основное или резервное (power.state 0/1). */
    source?: 'main' | 'backup';
    /** Бортовое напряжение, вольты (power.voltage). */
    voltage?: number;
    /** ISO 8601, момент получения данных (только для 'available'). */
    fetchedAt?: string;
}

// ————————————— Управление охраной: постановка/снятие (E12) ————————

/**
 * Действие управления охраной раздела. Контракт GEORITM objects/arm/ и
 * objects/disarm/ — ровно два параметра (imei, area); других действий
 * (все разделы, частичное взятие и т.п.) API не предоставляет.
 */
export type ControlAction = 'arm' | 'disarm';

/**
 * Доступность управления разделом. Вычисляется только на сервере из
 * feature gate, прав пользователя, флага объекта и разрешимости IMEI/раздела
 * (E11, раздел 9.2). В браузер передаётся как готовый вердикт — браузер
 * не вычисляет доступность и не влияет на неё.
 *
 * 'disabled' — feature gate выключен (в E12 — постоянное состояние);
 * UI не показывает активные элементы управления.
 */
export type ControlAvailability =
    /** Управление подтверждённо доступно. */
    | 'available'
    /** Нет права пользователя или флага объекта (allowedActions / canArm=false). */
    | 'no-permission'
    /** Тип объекта не поддерживает управление охраной (мобильные объекты). */
    | 'unsupported'
    /** Feature gate выключен — управление отключено на сервере. */
    | 'disabled'
    /** Доступность достоверно установить нельзя (canArm отсутствует, нет IMEI,
     * состояние раздела неизвестно) — консервативный запрет, кнопки скрыты. */
    | 'unknown';

/**
 * Состояние одного раздела для управления охраной. `num` — номер раздела
 * в приборе (GEORITM areas[].num / ключ карты objects/state/); имя — из
 * справочника разделов источника. IMEI и внутренние идентификаторы GEORITM
 * в DTO не переносятся — команда адресуется только парой (objectId
 * кабинета, номер раздела), разрешение IMEI выполняет сервер.
 */
export interface PartitionControlState {
    num: number;
    name: string;
    /** true — под охраной, false — снят, null — достоверно неизвестно. */
    guarded: boolean | null;
    /** Доступность постановки на охрану этого раздела. */
    arm: ControlAvailability;
    /** Доступность снятия с охраны этого раздела. */
    disarm: ControlAvailability;
}

/**
 * Состояние управления охраной объекта (read-only опрос для UI).
 * `enabled: false` — канал команд выключен (feature gate): команды
 * невозможны, UI показывает только Safe Preview. Для GEORITM разделы
 * заполняются фактической capability-оценкой и при выключенном gate
 * (E16): видимость управления определяется возможностями учётной
 * записи, gate помечает лишь недоступность команд.
 */
export interface ObjectControlState {
    enabled: boolean;
    /** 'available' — данные разделов получены из источника; 'unknown' —
     * получить их не удалось (источник недоступен, объект не найден). */
    availability: 'available' | 'unknown';
    partitions: PartitionControlState[];
}

/**
 * Итог операции управления (трёхзначность E11, раздел 4.2):
 * 'confirmed' — фактическое состояние раздела стало целевым (переход
 * подтверждён objects/state/); 'rejected' — достоверный отказ (отказ-код
 * журнала 4501/4503/9201 или явный отказ сервера GEORITM); 'unknown' —
 * результат за окно наблюдения установить не удалось. Успех никогда не
 * выдаётся на основании одного {success: 1}.
 */
export type ControlResult = 'confirmed' | 'rejected' | 'unknown';

/** Ответ POST-команды управления для UI. Содержит свежее состояние разделов. */
export interface ControlOperationResult {
    result: ControlResult;
    /** Человекочитаемое описание для показа пользователю (без технических деталей). */
    message: string;
    /** Свежее состояние разделов после операции (опрос источника кабинета). */
    partitions: PartitionControlState[];
}

/**
 * Причина отказа операции управления. Маршрут переводит её в HTTP-статус
 * и безопасное сообщение; причины не раскрывают внутренние параметры GEORITM.
 */
export type ControlErrorReason =
    /** Feature gate выключен (403). */
    | 'gate-disabled'
    /** Нет права на действие, canArm=false (запрет объекта)
     * или restricted=1 (ограничение доступа «пользователь × объект») (403). */
    | 'no-permission'
    /** Управление не поддерживается объектом/разделом (403). */
    | 'unsupported'
    /** Доступность управления не подтверждена (403): canArm отсутствует или
     * некорректен, права неизвестны, нет IMEI, состояние раздела неизвестно. */
    | 'unknown-capability'
    /** Раздел не найден среди разделов объекта (400). */
    | 'unknown-area'
    /** Раздел уже в целевом состоянии — команда не отправлялась (409). */
    | 'already-in-state'
    /** По этой паре объект/раздел уже выполняется команда (409). */
    | 'in-flight'
    /** Предыдущая команда завершилась неизвестным результатом; повтор заблокирован (409). */
    | 'cooldown'
    /** Превышен лимит команд (429). */
    | 'rate-limited'
    /** Объект не принадлежит пользователю (404). */
    | 'not-owned';

/** Ошибка операции управления охраной с машинной причиной для маршрута. */
export class ControlError extends Error {
    readonly reason: ControlErrorReason;

    constructor(reason: ControlErrorReason, message: string) {
        super(message);
        this.name = 'ControlError';
        this.reason = reason;
    }
}

/**
 * Пользователь кабинета без секретных полей — безопасен для отдачи
 * в API-ответах и на серверных страницах.
 */
export interface PublicAccountUser {
    id: string;
    login: string;
    displayName: string;
}

/**
 * Способ, которым пользователь аутентифицирован в текущей сессии.
 * 'demo' — тестовая учётная запись; 'georitm' — реальный вход через
 * users/login/ GEORITM (credentials только в серверном хранилище).
 */
export type AccountSessionKind = 'demo' | 'georitm';
