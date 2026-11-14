/**
 * Пользовательские настройки отображения разделов страницы объекта
 * (E7.3.5). Хранение — localStorage по аналогии с темой light/dark,
 * но с обязательной изоляцией по пользователю: ключ содержит id
 * пользователя кабинета (PublicAccountUser.id — не секрет, он и так
 * известен клиенту), поэтому настройки одного пользователя не применяются
 * к другому в том же браузере.
 *
 * Раздел «Карта» намеренно отсутствует: сейчас это заглушка, и пустой
 * раздел не должен попадать в настройки и интерфейс объекта. При
 * появлении реальной интеграции достаточно добавить id в SECTIONS —
 * mergeSettings() корректно дополнит сохранённые настройки пользователей.
 */

export type CabinetObjectSectionId = 'state' | 'events' | 'reports';

export type CabinetObjectSectionsSettings = {
    visibleSections: CabinetObjectSectionId[];
    sectionOrder: CabinetObjectSectionId[];
};

export const OBJECT_SECTIONS: ReadonlyArray<{id: CabinetObjectSectionId; title: string}> = [
    {id: 'state', title: 'Состояние'},
    {id: 'events', title: 'События'},
    {id: 'reports', title: 'Отчёты'},
];

const SECTION_IDS: ReadonlyArray<CabinetObjectSectionId> = OBJECT_SECTIONS.map((section) => section.id);

const SETTINGS_KEY_PREFIX = 'cabinet-object-sections:';

const storageKey = (userId: string): string => `${SETTINGS_KEY_PREFIX}${userId}`;

export const defaultObjectSectionsSettings = (): CabinetObjectSectionsSettings => ({
    visibleSections: [...SECTION_IDS],
    sectionOrder: [...SECTION_IDS],
});

const isSectionId = (value: unknown): value is CabinetObjectSectionId =>
    typeof value === 'string' && (SECTION_IDS as readonly string[]).includes(value);

const dedupe = (ids: CabinetObjectSectionId[]): CabinetObjectSectionId[] =>
    [...new Set(ids)];

/**
 * Восстанавливает настройки из произвольных данных. Неизвестные
 * идентификаторы отбрасываются, отсутствующие разделы добавляются
 * включёнными в конец порядка, дубликаты устраняются — при появлении
 * новых разделов существующие пользовательские настройки не теряются.
 */
export const mergeObjectSectionsSettings = (raw: unknown): CabinetObjectSectionsSettings => {
    const fallback = defaultObjectSectionsSettings();

    if (typeof raw !== 'object' || raw === null) {
        return fallback;
    }

    const {visibleSections, sectionOrder} = raw as Record<string, unknown>;

    if (!Array.isArray(sectionOrder) || !Array.isArray(visibleSections)) {
        return fallback;
    }

    const order = dedupe(sectionOrder.filter(isSectionId));
    // Разделы, которых не было при сохранении (например, добавленные
    // после обновления сайта), включаются и ставятся в конец порядка.
    const missing = SECTION_IDS.filter((id) => !order.includes(id));
    const fullOrder = [...order, ...missing];
    const visible = new Set(visibleSections.filter(isSectionId));

    return {
        sectionOrder: fullOrder,
        visibleSections: fullOrder.filter((id) => visible.has(id)),
    };
};

/** Читает настройки пользователя; отсутствие или повреждение данных — значения по умолчанию. */
export const loadObjectSectionsSettings = (userId: string): CabinetObjectSectionsSettings => {
    try {
        const stored = window.localStorage.getItem(storageKey(userId));
        return stored ? mergeObjectSectionsSettings(JSON.parse(stored)) : defaultObjectSectionsSettings();
    } catch {
        return defaultObjectSectionsSettings();
    }
};

/** Сохраняет настройки пользователя и уведомляет подписчиков. */
export const saveObjectSectionsSettings = (userId: string, settings: CabinetObjectSectionsSettings): void => {
    try {
        window.localStorage.setItem(storageKey(userId), JSON.stringify(settings));
    } catch {
        // Недоступный localStorage (приватный режим и т.п.) — настройки
        // просто не сохранятся между загрузками, страница остаётся рабочей.
    }
    notifyObjectSectionsSettings(settings);
};

// ————— Простая подписка между клиентскими компонентами —————
// Шапка объекта и окно настроек — независимые клиентские компоненты
// одного дерева; контекст React здесь избыточен, достаточно модульных
// подписчиков, которые переживают клиентские переходы Next.js.

type SettingsListener = (settings: CabinetObjectSectionsSettings) => void;

const listeners = new Set<SettingsListener>();

export const subscribeObjectSectionsSettings = (listener: SettingsListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const notifyObjectSectionsSettings = (settings: CabinetObjectSectionsSettings): void => {
    for (const listener of listeners) {
        listener(settings);
    }
};
