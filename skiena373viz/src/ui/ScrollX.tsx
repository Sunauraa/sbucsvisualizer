import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * A box that scrolls sideways on its own, so wide content never widens the page. It becomes a tab stop
 * (and claims the left/right keys) only while it really overflows; otherwise arrows still step the player.
 */
export function ScrollX({ label, className = '', children }: { readonly label: string; readonly className?: string; readonly children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setOverflows(element.scrollWidth > element.clientWidth + 1));
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className={`scroll-x ${className}`} {...(overflows ? { role: 'group', 'aria-label': `${label} (scrolls sideways)`, tabIndex: 0, 'data-player-keys': 'arrows' } : {})}>
      {children}
    </div>
  );
}
