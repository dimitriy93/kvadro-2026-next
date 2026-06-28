import { useEffect, useState } from 'react';
import { useMediaQuery } from 'usehooks-ts';

export const useIsMobile = (breakpoint: number) => {
  const [mounted, setMounted] = useState<boolean>(false);
  const isMobile = useMediaQuery(`(max-width: ${breakpoint}px)`);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return isMobile;
};
