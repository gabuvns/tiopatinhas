import { useEffect } from "react";
export type Theme = "system" | "light" | "dark";
export default function ThemeControl({
  value,
  onChange,
}: {
  value: Theme;
  onChange: (theme: Theme) => void;
}) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        value === "system" ? (media.matches ? "dark" : "light") : value;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [value]);
  return (
    <label className="theme-control">
      <span className="sr-only">Tema da interface</span>
      <select
        aria-label="Tema da interface"
        value={value}
        onChange={(event) => onChange(event.target.value as Theme)}
      >
        <option value="system">Tema do sistema</option>
        <option value="light">Tema claro</option>
        <option value="dark">Tema escuro</option>
      </select>
    </label>
  );
}
