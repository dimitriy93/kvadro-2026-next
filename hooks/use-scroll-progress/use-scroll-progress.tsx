import {RefObject, useEffect, useState} from "react";

export function useScrollProgress(elementRef: RefObject<HTMLElement | null>, triggerRatio: number = 0.6) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const el = elementRef.current;
        if (!el) return;

        const handleScroll = () => {
            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight;
            const trigger = vh * triggerRatio;
            const raw = (trigger - rect.top) / rect.height;
            const clamped = Math.min(1, Math.max(0, raw));

            setProgress(clamped);
        };

        document.body.addEventListener("scroll", handleScroll, {
            passive: true
        });

        handleScroll();

        return () => {
            document.body.removeEventListener("scroll", handleScroll);
        };
    }, [elementRef, triggerRatio]);

    return progress;
}