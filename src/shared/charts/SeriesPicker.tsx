import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { searchableLabel } from "../../domain/comparison";
import { useCompactScreen } from "./chartViewport";

export default function SeriesPicker({
  options,
  selected,
  onChange,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    input = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const compact = useCompactScreen();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) return;
    if (compact) closeButton.current?.focus();
    else input.current?.focus();
    const oldOverflow = document.body.style.overflow;
    if (compact) document.body.style.overflow = "hidden";
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      if (compact) document.body.style.overflow = oldOverflow;
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, compact]);
  const filtered = options.filter((item) =>
    searchableLabel(item.label).includes(searchableLabel(query.trim())),
  );
  return (
    <div
      className="series-picker"
      ref={root}
      onBlur={(event) => {
        if (
          !compact &&
          !event.currentTarget.contains(event.relatedTarget as Node)
        )
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="series-picker-trigger"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
      >
        <Search size={16} />
        <span>Selecionar linhas</span>
        <span className="series-count">{selected.length}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <>
          {compact && (
            <button
              type="button"
              className="series-picker-backdrop"
              aria-label="Fechar seleção de linhas"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            />
          )}
          <div
            id={id}
            className="series-picker-panel"
            role="dialog"
            aria-modal={compact ? true : undefined}
            aria-label="Selecionar linhas do gráfico"
            onKeyDown={(event) => {
              if (!compact || event.key !== "Tab") return;
              const elements = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled), input:not(:disabled)",
                ),
              ).filter((element) => element.getClientRects().length > 0);
              const first = elements[0],
                last = elements[elements.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
          >
            <div className="series-picker-panel-heading">
              <strong>Linhas do gráfico</strong>
              <button
                ref={closeButton}
                type="button"
                aria-label="Fechar linhas do gráfico"
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="series-picker-search">
              <Search size={16} aria-hidden="true" />
              <input
                ref={input}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar categoria ou indicador"
                aria-label="Buscar linhas do gráfico"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Limpar busca de linhas"
                  onClick={() => {
                    setQuery("");
                    input.current?.focus();
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <div
              className="series-picker-list"
              role="group"
              aria-label="Linhas disponíveis"
            >
              {filtered.map((item) => (
                <label key={item.id} className="series-picker-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    disabled={selected.length === 1 && selected[0] === item.id}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...selected, item.id]
                          : selected.filter((value) => value !== item.id),
                      )
                    }
                  />
                  <span>{item.label}</span>
                  {selected.includes(item.id) && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </label>
              ))}
              {!filtered.length && (
                <p role="status">Nenhuma linha encontrada para “{query}”.</p>
              )}
            </div>
            <div className="series-picker-footer">
              <span>
                {selected.length} selecionada{selected.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                Concluir
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
