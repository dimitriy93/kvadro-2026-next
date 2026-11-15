'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import type {KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent} from 'react';
import {createPortal} from 'react-dom';
import type {
    ControlAction,
    ObjectControlState,
    PartitionControlState,
} from '@/lib/account';
import type {SafePreviewPartition} from './object-control.shared';
import './object-control.styles.scss';

/**
 * Секция управления охраной объекта (E12, capability-aware preview E16).
 *
 * Принципы (E11, раздел 8; E16):
 *  - кнопки показываются только при подтверждённой сервером доступности
 *    ('available'); capability вычисляется сервером, клиент не влияет на него;
 *  - видимость секции определяется фактическими возможностями учётной
 *    записи: если подтверждённых разделов нет, секция управления не
 *    отображается вовсе — ни неработающих кнопок, ни декоративных элементов,
 *    ни технических причин недоступности (E16);
 *  - при выключенном feature gate реальный источник (GEORITM) показывает
 *    только подтверждённые разделы в режиме Safe Preview — демонстрационный
 *    диалог с заблокированным подтверждением, без вызова API; demo-источник
 *    сохраняет прежний Safe Preview из DTO зон (E13.1);
 *  - обоим направлениям требуется подтверждение: снятие убирает защиту,
 *    взятие может вызвать тревогу при людях внутри;
 *  - во время операции все кнопки заблокированы — повторное нажатие
 *    невозможно (дубль блокируется и на сервере, HTTP 409);
 *  - успех не выдаётся до подтверждения фактического состояния: сервер
 *    отвечает 'confirmed' только по переходу objects/state/, {success: 1}
 *    успехом не считается;
 *  - после «Результат неизвестен» кнопки остаются заблокированными до
 *    очередного успешного опроса состояния (endpoint partitions), после
 *    которого UI показывает актуальное состояние; автоматической повторной
 *    отправки команды нет.
 */

interface IObjectControlSectionProps {
    objectId: string;
    objectName: string;
    /** Состояние управления на момент рендера страницы (RSC-снимок). */
    initial: ObjectControlState;
    /**
     * Safe Preview (E13.1): разделы демонстрационного источника при
     * выключенном feature gate — выведены сервером из уже загруженных DTO
     * зон объекта, без новых запросов. null — состояние разделов недоступно
     * (ошибка загрузки зон); [] — разделы не настроены. Используется
     * только для demo-данных; GEORITM использует capability-aware разделы
     * из DTO управления (E16).
     */
    preview: SafePreviewPartition[] | null;
    /** true — демонстрационный источник данных; false — реальный GEORITM. */
    isDemoData: boolean;
}

/** Вид баннера результата. 'unknown' выделен отдельно — это не успех и не отказ. */
type ResultKind = 'confirmed' | 'rejected' | 'unknown';

const GUARDED_LABEL = {
    true: 'Под охраной',
    false: 'Снят с охраны',
} as const;

const UNKNOWN_STATE_LABEL = 'Состояние неизвестно';

/** Точное демо-уведомление Safe Preview (E13.1, направление B). */
const DEMO_NOTICE = 'Демонстрационный режим. Реальная команда не отправляется. Управление охраной пока недоступно';

/**
 * Заголовок диалога по согласованной формулировке (E12.3 5.3, дефект 5;
 * E13.1 направление A): номер — из фактических данных, операция
 * соответствует нажатой кнопке.
 */
const actionTitle = (action: ControlAction, zoneNum: number): string =>
    action === 'arm'
        ? `Поставить зону ${zoneNum} под охрану?`
        : `Снять зону ${zoneNum} с охраны?`;

/** Последствия действия — только для выбранной операции, не «наоборот». */
const actionConsequence = (action: ControlAction): string =>
    action === 'arm'
        ? 'После взятия под охрану движение в охраняемых зонах вызовет тревогу.'
        : 'Объект останется без охранной защиты этого раздела.';

/**
 * Понятное имя зоны из фактических данных: пустое/отсутствующее имя
 * заменяется нейтральным обозначением «Зона N» — без придумывания
 * названий и без undefined/null в UI (E13.1, сценарий 4).
 */
const zoneLabel = (name: string, zoneNum: number): string => {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    return trimmed.length > 0 ? trimmed : `Зона ${zoneNum}`;
};

/** Снимок цели подтверждения: примитивы, зафиксированные в момент нажатия. */
interface ConfirmTarget {
    action: ControlAction;
    zoneNum: number;
    zoneName: string;
    /** true — демонстрационный диалог Safe Preview (подтверждение заблокировано). */
    demo: boolean;
}

/**
 * Строка preview-списка при выключенном gate (E16). Состояние и действия
 * вычисляются заранее: у GEORITM — из capability-оценки сервера
 * (действие допустимо только при 'available'), у demo — из DTO зон (E13.1).
 */
interface PreviewRow {
    num: number;
    name: string;
    guarded: boolean | null;
    armAction: boolean;
    disarmAction: boolean;
}

/** Диалог подтверждения (E13.1): доступность, focus trap, безопасное закрытие. */
interface IControlConfirmDialogProps {
    target: ConfirmTarget;
    objectName: string;
    /** true — операция выполняется (рабочий режим): закрытие и повторное подтверждение заблокированы. */
    busy: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/** Фокусируемые элементы диалога для focus trap (без внешних зависимостей). */
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), '
    + 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), '
    + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ControlConfirmDialog = ({target, objectName, busy, onConfirm, onCancel}: IControlConfirmDialogProps) => {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const restoreRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        // Дефект 2 (E12.3): перенос фокуса внутрь диалога при открытии —
        // скринридер и клавиатура сразу в контексте диалога.
        panelRef.current?.focus();
        // Корректный возврат фокуса на исходный элемент при закрытии.
        return () => {
            restoreRef.current?.focus();
        };
    }, []);

    // Focus trap (дефект 3) + закрытие по Escape (дефект 4). Во время
    // операции закрытие заблокировано: результат команды не должен терять
    // адресат и создавать неоднозначность (E13.1, направление A).
    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            if (!busy) {
                event.preventDefault();
                onCancel();
            }
            return;
        }
        if (event.key !== 'Tab') {
            return;
        }
        const panel = panelRef.current;
        if (!panel) {
            return;
        }
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) {
            event.preventDefault();
            panel.focus();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement;
        const inside = current instanceof HTMLElement && panel.contains(current);
        if (event.shiftKey) {
            // С первой фокусируемой позиции или с самой панели — на последнюю.
            if (!inside || current === first || current === panel) {
                event.preventDefault();
                last.focus();
            }
            return;
        }
        // С последней фокусируемой позиции или с самой панели — на первую.
        if (!inside || current === last || current === panel) {
            event.preventDefault();
            first.focus();
        }
    };

    // Дефект 4 (E12.3): клик по оверлею закрывает диалог (семантика
    // «Отмена»); клик внутри содержимого — нет. Во время операции
    // закрытие заблокировано.
    const handleOverlayClick = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget && !busy) {
            onCancel();
        }
    };

    return createPortal(
        <div className="obj-control-modal" role="presentation" onKeyDown={handleKeyDown} onClick={handleOverlayClick}>
            <div
                ref={panelRef}
                className="obj-control-modal__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="obj-control-modal-title"
                aria-describedby="obj-control-modal-description"
                tabIndex={-1}
            >
                <h2 className="obj-control-modal__title" id="obj-control-modal-title">
                    {actionTitle(target.action, target.zoneNum)}
                </h2>
                <p className="obj-control-modal__text" id="obj-control-modal-description">
                    Объект «{objectName}», зона «{target.zoneName}» (раздел № {target.zoneNum}).
                </p>
                <p className="obj-control-modal__warning">{actionConsequence(target.action)}</p>
                {target.demo ? (
                    <p className="obj-control-modal__demo">{DEMO_NOTICE}</p>
                ) : (
                    <p className="obj-control-modal__mode">
                        Рабочий режим: подтверждение отправит команду в систему мониторинга GEORITM.
                    </p>
                )}
                {busy && (
                    <p className="obj-control-modal__status" role="status" aria-live="polite">
                        Выполняется…
                    </p>
                )}
                <div className="obj-control-modal__actions">
                    {/*
                        Демонстрационный режим: подтверждение заблокировано, обработчик
                        не выполняет ничего (даже при снятии disabled извне API недостижим).
                    */}
                    <button
                        type="button"
                        className="obj-control-modal__confirm obj-control-modal__confirm--danger"
                        disabled={target.demo || busy}
                        title={target.demo ? 'Демонстрационный режим: подтверждение недоступно' : undefined}
                        onClick={target.demo ? () => undefined : onConfirm}
                    >
                        Подтвердить
                    </button>
                    <button
                        type="button"
                        className="obj-control-modal__cancel"
                        disabled={busy}
                        onClick={onCancel}
                    >
                        Отмена
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

/** Секция управления. При выключенном gate — capability-aware preview (E16). */
export const ObjectControlSection = ({objectId, objectName, initial, preview, isDemoData}: IObjectControlSectionProps) => {
    const [partitions, setPartitions] = useState<PartitionControlState[]>(initial.partitions);
    // Снимок цели подтверждения — зафиксирован в момент нажатия кнопки.
    const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
    // Выполняющаяся операция: все кнопки секции заблокированы.
    const [operation, setOperation] = useState<{action: ControlAction; areaNum: number} | null>(null);
    const [banner, setBanner] = useState<{kind: ResultKind | 'info'; message: string} | null>(null);
    // После «неизвестного результата»: повтор опроса partitions до успеха.
    const [awaitingState, setAwaitingState] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Опрос состояния после неопределённого результата: кнопки остаются
    // заблокированными до очередного успешного ответа partitions.
    useEffect(() => {
        if (!awaitingState) {
            return;
        }
        let cancelled = false;
        const poll = async () => {
            try {
                const response = await fetch(`/api/cabinet/objects/${objectId}/partitions`, {cache: 'no-store'});
                if (cancelled || !response.ok) {
                    return;
                }
                const payload = await response.json() as {success?: boolean; control?: ObjectControlState};
                if (!payload?.success || !payload.control) {
                    return;
                }
                setPartitions(payload.control.partitions);
                if (payload.control.availability === 'available') {
                    setAwaitingState(false);
                }
            } catch {
                // Сеть недоступна — продолжаем опрос до размонтирования.
            }
        };
        const timer = setInterval(poll, 3000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [awaitingState, objectId]);

    const anyOperation = operation !== null || awaitingState;

    const runOperation = useCallback(async (action: ControlAction, areaNum: number) => {
        setBanner(null);
        setOperation({action, areaNum});
        try {
            const response = await fetch(`/api/cabinet/objects/${objectId}/control`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action, areaNum}),
            });
            if (!mountedRef.current) {
                return;
            }
            const payload = await response.json().catch(() => null) as
                | {success?: boolean; result?: string; message?: string; partitions?: PartitionControlState[]; error?: string; controlDisabled?: boolean}
                | null;

            if (response.status === 401) {
                setBanner({kind: 'info', message: 'Сессия истекла. Обновите страницу и войдите в кабинет заново'});
                return;
            }
            if (payload?.partitions && payload.partitions.length > 0) {
                setPartitions(payload.partitions);
            }
            if (response.ok && payload?.success && (payload.result === 'confirmed' || payload.result === 'rejected' || payload.result === 'unknown')) {
                setBanner({kind: payload.result, message: payload.message ?? ''});
                if (payload.result === 'unknown') {
                    // Кнопки остаются заблокированными до успешного опроса состояния.
                    setAwaitingState(true);
                }
                return;
            }
            setBanner({
                kind: payload?.controlDisabled ? 'info' : 'rejected',
                message: payload?.error ?? 'Команду не удалось выполнить. Попробуйте позже',
            });
        } catch {
            if (mountedRef.current) {
                setBanner({kind: 'rejected', message: 'Нет соединения с сервером. Проверьте состояние объекта перед повтором'});
            }
        } finally {
            if (mountedRef.current) {
                setOperation(null);
                // Диалог закрывается только после завершения операции —
                // результат показывается баннером секции (E13.1).
                setConfirmTarget(null);
            }
        }
    }, [objectId]);

    const closeConfirm = useCallback(() => setConfirmTarget(null), []);

    // ————— Capability-aware preview (E16) / Safe Preview demo (E13.1): gate выключен —————
    if (!initial.enabled) {
        // GEORITM: capability-оценка сервера уже в DTO управления (E16).
        // Показываются только подтверждённые разделы; при их отсутствии
        // секция не отображается вовсе — ни декоративных кнопок, ни
        // технических причин недоступности. Demo-источник сохраняет прежний
        // Safe Preview из DTO зон (E13.1).
        const previewRows: PreviewRow[] | null = isDemoData
            ? preview === null
                ? null
                : preview.map((partition) => ({
                    num: partition.num,
                    name: partition.name,
                    guarded: partition.guarded,
                    armAction: partition.guarded === false,
                    disarmAction: partition.guarded === true,
                }))
            : initial.partitions
                .filter((partition) => partition.arm === 'available' || partition.disarm === 'available')
                .map((partition) => ({
                    num: partition.num,
                    name: partition.name,
                    guarded: partition.guarded,
                    armAction: partition.guarded === false && partition.arm === 'available',
                    disarmAction: partition.guarded === true && partition.disarm === 'available',
                }));

        if (previewRows === null) {
            // demo: состояние разделов определить не удалось (ошибка загрузки зон).
            return (
                <section className="obj-section" aria-label="Управление охраной">
                    <h2 className="obj-section__title">Управление охраной</h2>
                    <p className="obj-control-note" role="status">
                        Состояние разделов определить не удалось: данные объекта недоступны.
                        Попробуйте обновить страницу позже.
                    </p>
                </section>
            );
        }

        if (previewRows.length === 0) {
            // GEORITM: подтверждённых разделов нет (может включать объект без
            // разделов и учётную запись без права управления) — секция скрыта.
            if (!isDemoData) {
                return null;
            }
            return (
                <section className="obj-section" aria-label="Управление охраной">
                    <h2 className="obj-section__title">Управление охраной</h2>
                    <p className="obj-control-note">Для этого объекта разделы не настроены.</p>
                </section>
            );
        }

        return (
            <section className="obj-section" aria-label="Управление охраной">
                <h2 className="obj-section__title">Управление охраной</h2>

                <p className="obj-control-banner obj-control-banner--demo" role="status">
                    {DEMO_NOTICE}
                </p>

                <ul className="obj-control-list">
                    {previewRows.map((row) => {
                        const label = zoneLabel(row.name, row.num);
                        return (
                            <li key={row.num} className="obj-control-row">
                                <div className="obj-control-row__info">
                                    <span className="obj-control-row__name">{label}</span>
                                    <span className="obj-control-row__num">раздел № {row.num}</span>
                                    <span
                                        className={`obj-control-row__state obj-control-row__state--${
                                            row.guarded === null ? 'unknown' : row.guarded ? 'armed' : 'disarmed'
                                        }`}
                                    >
                                        {row.guarded === null
                                            ? UNKNOWN_STATE_LABEL
                                            : row.guarded
                                                ? GUARDED_LABEL.true
                                                : GUARDED_LABEL.false}
                                    </span>
                                </div>

                                <div className="obj-control-row__actions">
                                    {/*
                                        Демонстрационный режим: подтверждение заблокировано, обработчик
                                        не выполняет ничего (даже при снятии disabled извне API недостижим).
                                    */}
                                    {row.armAction && (
                                        <button
                                            type="button"
                                            className="obj-control-btn obj-control-btn--arm"
                                            onClick={() => setConfirmTarget({action: 'arm', zoneNum: row.num, zoneName: label, demo: true})}
                                        >
                                            Поставить на охрану
                                        </button>
                                    )}
                                    {row.disarmAction && (
                                        <button
                                            type="button"
                                            className="obj-control-btn obj-control-btn--disarm"
                                            onClick={() => setConfirmTarget({action: 'disarm', zoneNum: row.num, zoneName: label, demo: true})}
                                        >
                                            Снять с охраны
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>

                {confirmTarget && confirmTarget.demo && (
                    <ControlConfirmDialog
                        target={confirmTarget}
                        objectName={objectName}
                        busy={false}
                        onConfirm={() => undefined}
                        onCancel={closeConfirm}
                    />
                )}
            </section>
        );
    }

    const availablePartitions = partitions.filter(
        (partition) => partition.arm === 'available' || partition.disarm === 'available',
    );

    if (availablePartitions.length === 0) {
        // E16: подтверждённых разделов нет — секция управления не отображается
        // вовсе: ни неработающих кнопок, ни технических объяснений и
        // capability-флагов (причины недоступности пользователю не показываются).
        // Обычная информация об объекте, событиях и других разделах кабинета
        // продолжает работать; при изменении прав сервер пересчитывает
        // разрешение заново (DTO не является источником истины для команд).
        return null;
    }

    const confirm = confirmTarget;

    return (
        <section className="obj-section" aria-label="Управление охраной">
            <h2 className="obj-section__title">Управление охраной</h2>

            {banner && (
                <p
                    className={`obj-control-banner obj-control-banner--${banner.kind}`}
                    role={banner.kind === 'rejected' ? 'alert' : 'status'}
                >
                    {banner.message}
                    {banner.kind === 'unknown' && ' Состояние будет обновлено автоматически.'}
                </p>
            )}

            {anyOperation && (
                <p className="obj-control-banner obj-control-banner--running" role="status" aria-live="polite">
                    {operation ? 'Выполняется…' : 'Ожидание подтверждения состояния…'}
                </p>
            )}

            <ul className="obj-control-list">
                {availablePartitions.map((partition) => {
                    const running = operation !== null && operation.areaNum === partition.num;
                    return (
                        <li key={partition.num} className={`obj-control-row${running ? ' obj-control-row--running' : ''}`}>
                            <div className="obj-control-row__info">
                                <span className="obj-control-row__name">{partition.name}</span>
                                <span className="obj-control-row__num">раздел № {partition.num}</span>
                                {partition.guarded !== null && (
                                    <span
                                        className={`obj-control-row__state obj-control-row__state--${partition.guarded ? 'armed' : 'disarmed'}`}
                                    >
                                        {partition.guarded ? GUARDED_LABEL.true : GUARDED_LABEL.false}
                                    </span>
                                )}
                            </div>

                            <div className="obj-control-row__actions">
                                {partition.guarded === false && partition.arm === 'available' && (
                                    <button
                                        type="button"
                                        className="obj-control-btn obj-control-btn--arm"
                                        disabled={anyOperation}
                                        onClick={() => setConfirmTarget({
                                            action: 'arm',
                                            zoneNum: partition.num,
                                            zoneName: zoneLabel(partition.name, partition.num),
                                            demo: false,
                                        })}
                                    >
                                        Поставить на охрану
                                    </button>
                                )}
                                {partition.guarded === true && partition.disarm === 'available' && (
                                    <button
                                        type="button"
                                        className="obj-control-btn obj-control-btn--disarm"
                                        disabled={anyOperation}
                                        onClick={() => setConfirmTarget({
                                            action: 'disarm',
                                            zoneNum: partition.num,
                                            zoneName: zoneLabel(partition.name, partition.num),
                                            demo: false,
                                        })}
                                    >
                                        Снять с охраны
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            {confirm && (
                <ControlConfirmDialog
                    target={confirm}
                    objectName={objectName}
                    busy={operation !== null}
                    onConfirm={() => runOperation(confirm.action, confirm.zoneNum)}
                    onCancel={closeConfirm}
                />
            )}
        </section>
    );
};
