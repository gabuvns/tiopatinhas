import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { searchableLabel } from "../../domain/comparison";

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
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const filtered = options.filter((item) =>
    searchableLabel(item.label).includes(searchableLabel(query.trim())),
  );
  return (
    <div
      className="series-picker"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
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
        <div
          id={id}
          className="series-picker-panel"
          role="dialog"
          aria-label="Selecionar linhas do gráfico"
        >
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
      )}
    </div>
  );
}
