import { useEffect, useRef, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
export default function HeaderMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target))
        ref.current?.removeAttribute("open");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.removeAttribute("open");
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details ref={ref} className="header-menu">
      <summary aria-label="Dados e conta">
        <span className="header-menu-label">Dados e conta</span>
        <MoreHorizontal
          className="header-menu-mobile-icon"
          size={22}
          aria-hidden="true"
        />
      </summary>
      <div
        className="header-menu-body"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button"))
            ref.current?.removeAttribute("open");
        }}
      >
        {children}
      </div>
    </details>
  );
}
