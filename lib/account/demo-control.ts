import {ControlError} from './contracts.ts';
import type {
    ControlAction,
    ControlOperationResult,
    MonitorObject,
    ObjectControlState,
    ObjectZoneSection,
    PartitionControlState,
} from './contracts';
import {isGeoritmControlEnabled} from './control-gate.ts';
import {findDemoObjectForUser, getDemoZonesForObject} from './demo-data.ts';

/**
 * Демонстрационный источник управления охраной (E12). Полный аналог
 * серверного контракта GEORITM-модуля на фиктивных данных: тот же feature
 * gate GEORITM_CONTROL_ENABLED (обход через demo-режим запрещён), та же
 * трёхзначность результата, те же DTO. Команда изменяет оверлей состояния
 * в памяти процесса; рестарт сбрасывает его к фиксированным демо-данным.
 *
 * Назначение — проверка UI и сценариев маршрута без реального оборудования.
 * Данные вымышлены и не связаны с GEORITM.
 */

/** Оверлей состояния охраны демо-разделов: objectId → (num → guarded). */
const demoGuardedOverlay = new Map<string, Map<number, boolean>>();

const overlayFor = (objectId: string): Map<number, boolean> => {
    let overlay = demoGuardedOverlay.get(objectId);
    if (!overlay) {
        overlay = new Map();
        demoGuardedOverlay.set(objectId, overlay);
    }
    return overlay;
};

/**
 * Разделы демо-объекта из фиксированных данных (зоны, сгруппированные по
 * разделам). Состояние охраны: 'armed' → true, 'disarmed' → false, прочие
 * (alarm/fault) → null — состояние охраны неизвестно, управление скрыто
 * (правило «запрет управления при неизвестном состоянии» соблюдается
 * и на демо-данных).
 */
const sectionGuarded = (section: ObjectZoneSection): boolean | null =>
    section.state === 'armed' ? true : section.state === 'disarmed' ? false : null;

/** Состояние управления демо-объектом. Чужой/несуществующий объект → null. */
export const getDemoControlState = (userId: string, objectId: string): ObjectControlState | null => {
    // demo-режим подчиняется общему feature gate: без gate управление
    // отсутствует и данные разделов для UI управления не собираются.
    if (!isGeoritmControlEnabled()) {
        return {enabled: false, availability: 'unknown', partitions: []};
    }

    // Владение объектом — как в остальных демо-методах: чужой и
    // несуществующий объект неотличимы.
    if (!findDemoObjectForUser(userId, objectId)) {
        return null;
    }

    const sections = getDemoZonesForObject(objectId);
    const overlay = overlayFor(objectId);
    const partitions: PartitionControlState[] = [];
    for (const section of sections) {
        if (typeof section.num !== 'number') {
            continue;
        }
        const base = sectionGuarded(section);
        const guarded = overlay.has(section.num) ? overlay.get(section.num)! : base;
        partitions.push({
            num: section.num,
            name: section.name,
            guarded,
            // Демо-пользователь считается имеющим оба права; при неизвестном
            // состоянии compute-правило даёт 'unknown' (кнопки скрыты).
            arm: guarded === null ? 'unknown' : 'available',
            disarm: guarded === null ? 'unknown' : 'available',
        });
    }
    return {enabled: true, availability: 'available', partitions};
};

/**
 * Команда управления демо-разделом. Соблюдает серверные инварианты
 * GEORITM-модуля: gate до любых действий, проверка владения объектом,
 * запрет при неизвестном состоянии, отказ при разделе в целевом состоянии,
 * трёхзначный результат (демо-команда считается подтверждённой сразу —
 * это фиктивный источник, без имитации отказов).
 */
export const executeDemoControl = (
    userId: string,
    objectId: string,
    action: ControlAction,
    areaNum: number,
): ControlOperationResult => {
    // Gate — первая строка: demo-режим не может обойти запрет (требование E12).
    if (!isGeoritmControlEnabled()) {
        throw new ControlError('gate-disabled', 'Управление охраной отключено');
    }

    // Владение объектом — как в остальных демо-методах: чужой и
    // несуществующий объект неотличимы.
    const object: MonitorObject | null = findDemoObjectForUser(userId, objectId);
    if (!object) {
        throw new ControlError('not-owned', 'Объект не найден');
    }

    const partitions = getDemoControlState(userId, objectId);
    if (!partitions || partitions.availability !== 'available') {
        throw new ControlError('unknown-capability', 'Управление недоступно');
    }
    const partition = partitions.partitions.find((candidate) => candidate.num === areaNum);
    if (!partition) {
        throw new ControlError('unknown-area', 'Раздел не найден среди разделов объекта');
    }
    if (partition.arm !== 'available' || partition.disarm !== 'available') {
        throw new ControlError('unknown-capability', 'Управление этим разделом недоступно');
    }
    if (action === 'arm' && partition.guarded === true) {
        throw new ControlError('already-in-state', 'Раздел уже под охраной — команда не отправлялась');
    }
    if (action === 'disarm' && partition.guarded === false) {
        throw new ControlError('already-in-state', 'Раздел уже снят с охраны — команда не отправлялась');
    }

    const target = action === 'arm';
    overlayFor(objectId).set(areaNum, target);

    const fresh = getDemoControlState(userId, objectId);
    return {
        result: 'confirmed',
        message: action === 'arm' ? 'Раздел взят под охрану' : 'Раздел снят с охраны',
        partitions: fresh?.partitions ?? [],
    };
};
