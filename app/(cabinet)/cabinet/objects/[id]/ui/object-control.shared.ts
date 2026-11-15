/**
 * Общие вычисления секции управления охраной (E13.1 Safe Preview).
 *
 * Модуль без 'use client': вызывается из серверного ObjectStateView до
 * передачи пропсов в клиентскую секцию управления. Использует только
 * уже загруженные DTO зон объекта — новых обращений к источникам данных
 * (включая GEORITM) не выполняет, при выключенном feature gate ничего
 * не запрашивает.
 */

import type {ObjectZoneSection} from '@/lib/account';

/**
 * Раздел объекта для демонстрационного показа (Safe Preview). Только
 * фактические данные из DTO зон: номер, имя и состояние охраны, если оно
 * выразимо. Capability (canArm, права) сознательно отсутствует — при
 * выключенном gate она не вычисляется и не имитируется.
 */
export interface SafePreviewPartition {
    num: number;
    name: string;
    /** true — под охраной, false — снят, null — состояние не выразимо из DTO (alarm/fault/неизвестно). */
    guarded: boolean | null;
}

/**
 * Разделы для Safe Preview из DTO зон (ObjectZoneSection). Отображается
 * только фактическое состояние: 'armed' → под охраной, 'disarmed' → снят;
 * тревога/неисправность состояния охраны не дают — 'unknown' (null),
 * состояние не выдумывается. Разделы без номера не адресуемы командой
 * (парой объект/раздел) и в демонстрацию не попадают — как и в рабочем
 * режиме (демо-источник E12 использует то же правило).
 */
export const deriveSafePreviewPartitions = (zones: ObjectZoneSection[]): SafePreviewPartition[] => {
    const partitions: SafePreviewPartition[] = [];
    for (const section of zones) {
        if (typeof section.num !== 'number' || !Number.isInteger(section.num) || section.num < 0) {
            continue;
        }
        partitions.push({
            num: section.num,
            name: section.name,
            guarded: section.state === 'armed' ? true : section.state === 'disarmed' ? false : null,
        });
    }
    return partitions;
};
