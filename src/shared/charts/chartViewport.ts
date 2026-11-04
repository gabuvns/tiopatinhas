import { useEffect, useRef, useState } from "react";

/** Keep text and touch coordinates in actual CSS pixels on narrow screens. */
export function chartGeometry(containerWidth: number, dualAxis = false) {
  const compact = containerWidth > 0 && containerWidth < 560;
  const width = compact ? Math.max(200, Math.round(containerWidth)) : 960;
  const start = compact ? 36 : 90;
  const end = width - (compact ? (dualAxis ? 48 : 12) : 90);
  return {
    compact,
    width,
    height: compact ? 272 : 340,
    start,
    end,
    top: compact ? 48 : 58,
    bottom: compact ? 230 : 282,
  };
}

export function nearestChartIndex(
  clientX: number,
  bounds: { left: number; width: number },
  geometry: ReturnType<typeof chartGeometry>,
  count: number,
) {
  if (count <= 1 || bounds.width <= 0) return 0;
  const cursor = ((clientX - bounds.left) / bounds.width) * geometry.width;
  return Math.max(
    0,
    Math.min(
      count - 1,
      Math.round(
        ((cursor - geometry.start) / (geometry.end - geometry.start)) *
          (count - 1),
      ),
    ),
  );
}

export function useChartViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 0 : Math.max(200, window.innerWidth - 64),
  );
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function useCompactScreen() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 680px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return compact;
}
