import { useEffect, useRef, useState } from "react";

/** Measure a container so charts can render at real pixel width (no stroke distortion). */
export function useElementWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 0) setWidth(next);
    });
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width || fallback);
    return () => observer.disconnect();
  }, [fallback]);

  return { ref, width };
}
