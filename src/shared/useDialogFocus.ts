import { useEffect, useRef, type RefObject } from "react";

/** Focus containment and background isolation for the non-native ledger dialogs. */
export default function useDialogFocus(
  ref: RefObject<HTMLElement>,
  onClose: () => void,
) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    const siblings = Array.from(
      dialog.closest(".app-shell")?.children ?? [],
    ).filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && !node.contains(dialog),
    );
    const inert = siblings.map((node) => node.inert);
    siblings.forEach((node) => {
      node.inert = true;
    });
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']",
        ),
      ).filter((node) => node.getClientRects().length > 0);
    controls()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const items = controls(),
        first = items[0],
        last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", key);
    return () => {
      dialog.removeEventListener("keydown", key);
      siblings.forEach((node, index) => {
        node.inert = inert[index];
      });
      document.body.style.overflow = overflow;
      if (previous?.isConnected && previous.getClientRects().length)
        previous.focus();
      else
        document.querySelector<HTMLElement>(".header-menu > summary")?.focus();
    };
  }, [ref]);
}
