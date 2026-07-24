import { useEffect, useRef, useState } from 'react';

/*
 * A tiny, dependency-free scroll reveal. It watches one element with an
 * IntersectionObserver and flips a boolean the first time the element enters the
 * viewport, so a section can add its entrance class only when it is seen. When
 * the observer is unavailable the content is shown immediately, so nothing is
 * ever trapped behind an effect that never runs, and reduced motion is honored
 * by the shared animation rules in the token sheet.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T>;
  shown: boolean;
} {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, shown };
}
