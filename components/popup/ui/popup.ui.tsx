"use client";
import { ReactNode, useEffect } from "react";
import "./popup.styles.scss";

export interface IPopupProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
}

export const Popup = ({ isOpen, onClose, children }: IPopupProps) => {
    useEffect(() => {
        if (!isOpen) return;

        const scrollY = window.scrollY;

        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.position = "";
            document.body.style.top = "";
            document.body.style.width = "";

            window.scrollTo(0, scrollY);

            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="popup popup--visible" onClick={onClose}>
            <div
                className="popup__content"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <button
                    className="popup__close"
                    onClick={onClose}
                    aria-label="Закрыть"
                    type="button"
                >
                    ×
                </button>

                {children}
            </div>
        </div>
    );
};