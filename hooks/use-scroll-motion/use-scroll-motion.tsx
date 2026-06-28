import { RefObject, useEffect, useRef, useState } from 'react';

export function useScrollMotion(elementRef: RefObject<HTMLElement | null>) {
  const [offset, setOffset] = useState(0);
  const [velocity, setVelocity] = useState(0);

  const lastScrollY = useRef(0);
  const lastTime = useRef(Date.now());

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const handleScroll = () => {
      const rect = el.getBoundingClientRect();

      setOffset(rect.top);

      const now = Date.now();
      const deltaTime = now - lastTime.current;
      const deltaScroll = window.scrollY - lastScrollY.current;
      const v = deltaTime > 0 ? deltaScroll / deltaTime : 0;

      setVelocity(v);

      lastScrollY.current = window.scrollY;
      lastTime.current = now;
    };

    document.body.addEventListener('scroll', handleScroll, { passive: true });

    handleScroll();

    return () => {
      document.body.removeEventListener('scroll', handleScroll);
    };
  }, [elementRef]);

  return { offset, velocity };
}
