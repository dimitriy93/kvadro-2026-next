'use client';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {
    OBJECT_SECTIONS,
    loadObjectSectionsSettings,
    saveObjectSectionsSettings,
    type CabinetObjectSectionId,
    type CabinetObjectSectionsSettings,
} from './object-sections.shared';
import './object-sections-settings.styles.scss';

/**
 * Окно настроек отображения разделов объекта (E7.3.5).
 *
 * Открытие — кнопка-шестерёнка в шапке объекта. Внутри: checkbox
 * включения раздела и смена порядка перетаскиванием (pointer events —
 * один путь и для мыши, и для сенсорных экранов) либо кнопками
 * «Выше/Ниже», доступными с клавиатуры.
 *
 * Изменения до «Сохранить» живут в локальном состоянии окна: «Отмена»,
 * Escape и закрытие их отбрасывают. Сохранить пустой список нельзя —
 * пользователь не может остаться без единого раздела.
 */

const OBJECT_SECTIONS_MAP = new Map(OBJECT_SECTIONS.map((section) => [section.id, section.title]));

interface IObjectSectionsSettingsModalProps {
    userId: string;
    /** Настройки, действующие на странице в момент открытия окна. */
    current: CabinetObjectSectionsSettings;
    onClose: () => void;
}

export const ObjectSectionsSettingsModal = ({userId, current, onClose}: IObjectSectionsSettingsModalProps) => {
    const [order, setOrder] = useState<CabinetObjectSectionId[]>(current.sectionOrder);
    const [enabled, setEnabled] = useState<ReadonlySet<CabinetObjectSectionId>>(new Set(current.visibleSections));
    const [draggingId, setDraggingId] = useState<CabinetObjectSectionId | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const rowsRef = useRef<HTMLUListElement>(null);

    const discard = useCallback(() => onClose(), [onClose]);

    // Первичный фокус внутрь окна; возврат фокуса на кнопку-шестерёнку
    // выполняет родительский компонент в onClose.
    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                discard();
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [discard]);

    const toggleSection = (id: CabinetObjectSectionId) => {
        setEnabled((previous) => {
            const next = new Set(previous);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const moveSection = (id: CabinetObjectSectionId, offset: number) => {
        setOrder((previous) => {
            const index = previous.indexOf(id);
            const target = index + offset;
            if (target < 0 || target >= previous.length) {
                return previous;
            }
            const next = [...previous];
            next.splice(index, 1);
            next.splice(target, 0, id);
            return next;
        });
    };

    const save = () => {
        const settings: CabinetObjectSectionsSettings = {
            sectionOrder: order,
            visibleSections: order.filter((id) => enabled.has(id)),
        };
        saveObjectSectionsSettings(userId, settings);
        onClose();
    };

    // ————— Перетаскивание (pointer events: мышь и сенсорные экраны) —————

    const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: CabinetObjectSectionId) => {
        // preventDefault не даёт вызвать фокус/прокрутку тач-страницы и
        // случайные клики; checkbox в этой строке не задет — drag-ручка
        // отдельный элемент.
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingId(id);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!draggingId || !rowsRef.current) {
            return;
        }

        const rows = rowsRef.current.querySelectorAll<HTMLElement>('[data-section-row]');
        let insertBefore: CabinetObjectSectionId | null = null;
        for (const row of rows) {
            const rect = row.getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
                insertBefore = row.dataset.sectionRow as CabinetObjectSectionId;
                break;
            }
        }

        setOrder((previous) => {
            const currentIndex = previous.indexOf(draggingId);
            let targetIndex = insertBefore === null
                ? previous.length
                : previous.indexOf(insertBefore);
            if (targetIndex === currentIndex || targetIndex === -1) {
                return previous;
            }
            // Вставка после удаления перетаскиваемого элемента сдвигает
            // индексы, если цель стоит ниже исходной позиции.
            if (targetIndex > currentIndex) {
                targetIndex -= 1;
            }
            const next = [...previous];
            next.splice(currentIndex, 1);
            next.splice(targetIndex, 0, draggingId);
            return next;
        });
    };

    const endDrag = () => setDraggingId(null);

    const enabledCount = enabled.size;
    const canSave = enabledCount > 0;

    const orderedSections = useMemo(
        () => order.map((id) => ({id, title: OBJECT_SECTIONS_MAP.get(id) ?? id})),
        [order],
    );

    // Portal в body: модалка выводится из контекста наложения шапки
    // объекта. Без этого compositor hit-test в отдельных точках панели
    // отдавал приоритет статическому контенту страницы поверх
    // position:fixed-оверлея, и клики по checkbox не доходили.
    return createPortal(
        <div className="obj-sections-modal" role="presentation">
            <div
                ref={panelRef}
                className="obj-sections-modal__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="obj-sections-modal-title"
                tabIndex={-1}
            >
                <h2 className="obj-sections-modal__title" id="obj-sections-modal-title">
                    Настройка разделов
                </h2>
                <p className="obj-sections-modal__hint">
                    Выберите, какие разделы отображать, и задайте их порядок
                </p>

                <ul className="obj-sections-modal__list" ref={rowsRef}>
                    {orderedSections.map(({id, title}, index) => (
                        <li
                            key={id}
                            data-section-row={id}
                            className={`obj-sections-modal__row${draggingId === id ? ' obj-sections-modal__row--dragging' : ''}`}
                        >
                            <label className="obj-sections-modal__name">
                                <input
                                    type="checkbox"
                                    checked={enabled.has(id)}
                                    onChange={() => toggleSection(id)}
                                    aria-label={`Показывать раздел «${title}»`}
                                />
                                <span>{title}</span>
                            </label>

                            <button
                                type="button"
                                className="obj-sections-modal__move"
                                onClick={() => moveSection(id, -1)}
                                disabled={index === 0}
                                aria-label={`Переместить раздел «${title}» выше`}
                                title="Переместить выше"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="18 15 12 9 6 15"/>
                                </svg>
                            </button>
                            <button
                                type="button"
                                className="obj-sections-modal__move"
                                onClick={() => moveSection(id, 1)}
                                disabled={index === orderedSections.length - 1}
                                aria-label={`Переместить раздел «${title}» ниже`}
                                title="Переместить ниже"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="6 9 12 15 18 9"/>
                                </svg>
                            </button>

                            <button
                                type="button"
                                className="obj-sections-modal__handle"
                                aria-hidden="true"
                                tabIndex={-1}
                                title="Перетащите, чтобы изменить порядок"
                                onPointerDown={(event) => handlePointerDown(event, id)}
                                onPointerMove={handlePointerMove}
                                onPointerUp={endDrag}
                                onPointerCancel={endDrag}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
                                    <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
                                    <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
                                </svg>
                            </button>
                        </li>
                    ))}
                </ul>

                {!canSave && (
                    <p className="obj-sections-modal__warning" role="status">
                        Выберите хотя бы один раздел — полностью скрывать все разделы нельзя.
                    </p>
                )}

                <div className="obj-sections-modal__actions">
                    <button
                        type="button"
                        className="obj-sections-modal__save"
                        onClick={save}
                        disabled={!canSave}
                    >
                        Сохранить
                    </button>
                    <button
                        type="button"
                        className="obj-sections-modal__cancel"
                        onClick={discard}
                    >
                        Отмена
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};
