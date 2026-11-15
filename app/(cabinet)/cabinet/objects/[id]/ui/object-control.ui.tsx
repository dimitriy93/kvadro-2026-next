'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {
    ControlAction,
    ObjectControlState,
    PartitionControlState,
} from '@/lib/account';
import './object-control.styles.scss';

/**
 * Секция управления охраной объекта (E12).
 *
 * Принципы (E11, раздел 8):
 *  - кнопки показываются только при подтверждённой сервером доступности
 *    ('available'); capability вычисляется сервером, клиент не влияет на него;
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
 *    отправки команды нет;
 *  - при выключенном feature gate секция не рендерится вовсе — не создаётся
 *    впечатление, что пользователь может управлять объектом.
 */

interface IObjectControlSectionProps {
    objectId: string;
    objectName: string;
    /** Состояние управления на момент рендера страницы (RSC-снимок). */
    initial: ObjectControlState;
}

/** Вид баннера результата. 'unknown' выделен отдельно — это не успех и не отказ. */
type ResultKind = 'confirmed' | 'rejected' | 'unknown';

const ACTION_LABEL: Readonly<Record<ControlAction, string>> = {
    arm: 'Поставить на охрану',
    disarm: 'Снять с охраны',
};

const GUARDED_LABEL = {
    true: 'Под охраной',
    false: 'Снят с охраны',
} as const;

/** Секция управления. При выключенном gate (enabled: false) не рендерится. */
export const ObjectControlSection = ({objectId, objectName, initial}: IObjectControlSectionProps) => {
    const [partitions, setPartitions] = useState<PartitionControlState[]>(initial.partitions);
    const [availability, setAvailability] = useState<ObjectControlState['availability']>(initial.availability);
    // Раздел, ждущий подтверждения в диалоге.
    const [confirmTarget, setConfirmTarget] = useState<{action: ControlAction; partition: PartitionControlState} | null>(null);
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
                setAvailability(payload.control.availability);
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
        setConfirmTarget(null);
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
            }
        }
    }, [objectId]);

    // Секция скрыта целиком при выключенном feature gate — никаких
    // активных элементов управления и намёка на возможность управления.
    if (!initial.enabled) {
        return null;
    }

    const availablePartitions = partitions.filter(
        (partition) => partition.arm === 'available' || partition.disarm === 'available',
    );

    if (availablePartitions.length === 0) {
        // Доступность не подтверждена (unknown/no-permission/unsupported):
        // объясняем отсутствие управления, не имитируя рабочие кнопки.
        return (
            <section className="obj-section" aria-label="Управление охраной">
                <h2 className="obj-section__title">Управление охраной</h2>
                <p className="obj-control-note" role="status">
                    Управление охраной для этого объекта недоступно.
                    {availability === 'unknown' ? ' Доступность управления не подтверждена.' : ''}
                </p>
            </section>
        );
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
                    const running = operation !== null
                        && operation.areaNum === partition.num
                        && operation.action !== undefined;
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
                                        onClick={() => setConfirmTarget({action: 'arm', partition})}
                                    >
                                        Поставить на охрану
                                    </button>
                                )}
                                {partition.guarded === true && partition.disarm === 'available' && (
                                    <button
                                        type="button"
                                        className="obj-control-btn obj-control-btn--disarm"
                                        disabled={anyOperation}
                                        onClick={() => setConfirmTarget({action: 'disarm', partition})}
                                    >
                                        Снять с охраны
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            {confirm && createPortal(
                <div className="obj-control-modal" role="presentation">
                    <div
                        className="obj-control-modal__panel"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="obj-control-modal-title"
                        tabIndex={-1}
                    >
                        <h2 className="obj-control-modal__title" id="obj-control-modal-title">
                            {ACTION_LABEL[confirm.action]}?
                        </h2>
                        <p className="obj-control-modal__text">
                            Раздел «{confirm.partition.name}» (№ {confirm.partition.num}) объекта «{objectName}».
                        </p>
                        <p className="obj-control-modal__warning">
                            {confirm.action === 'disarm'
                                ? 'Объект останется без охранной защиты этого раздела.'
                                : 'После взятия под охрану движение в охраняемых зонах вызовет тревогу.'}
                        </p>
                        <div className="obj-control-modal__actions">
                            <button
                                type="button"
                                className="obj-control-modal__confirm obj-control-modal__confirm--danger"
                                disabled={operation !== null}
                                onClick={() => runOperation(confirm.action, confirm.partition.num)}
                            >
                                Подтвердить
                            </button>
                            <button
                                type="button"
                                className="obj-control-modal__cancel"
                                disabled={operation !== null}
                                onClick={() => setConfirmTarget(null)}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </section>
    );
};
