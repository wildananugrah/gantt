import { useEffect, useState } from 'react';

/** Matches Tailwind's `sm` breakpoint (640px). */
export const MOBILE_BREAKPOINT_PX = 640;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}
