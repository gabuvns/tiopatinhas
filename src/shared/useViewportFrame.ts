import { useEffect } from "react";

/** Browser chrome and the on-screen keyboard change the visual viewport without
 * consistently changing CSS vh. Keep dialog sizing separate from financial state. */
export default function useViewportFrame() {
  useEffect(() => {
    const root = document.documentElement,
      viewport = window.visualViewport;
    let width = window.innerWidth,
      baseline = viewport?.height ?? window.innerHeight,
      frame = 0;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      if (Math.abs(width - window.innerWidth) > 80) {
        width = window.innerWidth;
        baseline = height;
      }
      baseline = Math.max(baseline, height);
      root.style.setProperty("--app-viewport-height", `${height}px`);
      root.style.setProperty(
        "--app-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
      const editable = document.activeElement?.matches(
        "input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]",
      );
      root.dataset.keyboardOpen =
        editable && baseline - height > 120 ? "true" : "false";
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("resize", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      root.style.removeProperty("--app-viewport-height");
      root.style.removeProperty("--app-viewport-top");
      delete root.dataset.keyboardOpen;
    };
  }, []);
}
