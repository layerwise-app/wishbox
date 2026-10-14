import { useEffect, useRef, useState } from 'react';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Reveals every [data-reveal] element on the page as it scrolls into view. */
export function useReveal() {
  useEffect(() => {
    if (reducedMotion()) return;
    const root = document.documentElement;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-visible', '');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    root.classList.add('reveal-ready');
    document.querySelectorAll('[data-reveal]').forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      root.classList.remove('reveal-ready');
    };
  }, []);
}

/**
 * Steps through frames while the element is on screen, waiting `durations[frame]` ms on each.
 * Starts on the last frame, which should be a finished state: that is what the server renders
 * and what visitors who prefer reduced motion keep seeing.
 */
export function useLoop<T extends HTMLElement>(durations: readonly number[]) {
  const ref = useRef<T>(null);
  const [frame, setFrame] = useState(durations.length - 1);
  useEffect(() => {
    const node = ref.current;
    if (!node || reducedMotion()) return;
    let current = durations.length - 1;
    let timer: number | undefined;
    const tick = () => {
      current = (current + 1) % durations.length;
      setFrame(current);
      timer = window.setTimeout(tick, durations[current]);
    };
    const observer = new IntersectionObserver(([entry]) => {
      window.clearTimeout(timer);
      if (entry?.isIntersecting) tick();
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [durations]);
  return [ref, frame] as const;
}
