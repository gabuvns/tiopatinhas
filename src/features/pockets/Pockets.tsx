import { useState, type FormEvent } from "react";
import type { Pocket } from "../../infrastructure/store";
import type { Position } from "../../domain/domain";
import { useDisplayCurrency } from "../../shared/DisplayCurrency";
export const defaultPockets: Pocket[] = [
  {
    id: "fun-spending",
    name: "Banco do Tio Patinhas",
    target: 5000,
    allocations: [],
  },
];
export default function Pockets({
  positions,
  pockets = defaultPockets,
  onChange,
}: {
  positions: Position[];
  pockets?: Pocket[];
  onChange: (p: Pocket[]) => void;
}) {
  const { formatMoney } = useDisplayCurrency();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const current = pockets.find((p) => p.id === editing);
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!current) return;
    const f = new FormData(e.currentTarget);
    const allocations = positions
      .filter((p) => !p.isEmergencyReserve)
      .map((p) => ({
        assetId: p.assetId,
        amount: Number(f.get(p.assetId) ?? 0),
      }))
      .filter((a) => a.amount > 0);
    for (const a of allocations) {
      const asset = positions.find((p) => p.assetId === a.assetId)!;
      const other = pockets
        .filter((p) => p.id !== current?.id)
        .flatMap((p) => p.allocations)
        .filter((v) => v.assetId === a.assetId)
        .reduce((s, v) => s + v.amount, 0);
      if (a.amount + other > asset.value + 0.005) {
        setError(
          "A divisão de " + asset.ticker + " ultrapassa o valor disponível.",
        );
        return;
      }
    }
    const next = {
      ...current,
      name: String(f.get("name")).trim(),
      target: Number(f.get("target")),
      allocations,
    };
    if (!next.name || !Number.isFinite(next.target) || next.target < 0) {
      setError("Revise o nome e a meta.");
      return;
    }
    onChange(pockets.map((p) => (p.id === next.id ? next : p)));
    setEditing(null);
    setError("");
  }
  return (
    <section className="panel pockets-panel">
      <div className="panel-heading">
        <div>
          <h2>Dinheiro com propósito</h2>
          <p>
            Cofrinhos para seus planos e para gastar sem culpa. Valores
            reservados em BRL.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() => {
            const p = {
              id: crypto.randomUUID(),
              name: "Novo cofrinho",
              target: 1000,
              allocations: [],
            };
            onChange([...pockets, p]);
            setEditing(p.id);
          }}
        >
          Criar cofrinho
        </button>
      </div>
      <div className="goal-grid">
        {pockets.map((p) => {
          const total = p.allocations.reduce(
            (s, a) =>
              s +
              (a.amount /
                Math.max(
                  Number.EPSILON,
                  pockets
                    .flatMap((v) => v.allocations)
                    .filter((v) => v.assetId === a.assetId)
                    .reduce((s, v) => s + v.amount, 0),
                )) *
                Math.min(
                  pockets
                    .flatMap((v) => v.allocations)
                    .filter((v) => v.assetId === a.assetId)
                    .reduce((s, v) => s + v.amount, 0),
                  positions.find((v) => v.assetId === a.assetId && !v.isEmergencyReserve)?.value ?? 0,
                ),
            0,
          );
          return (
            <article className="goal-item" key={p.id}>
              <strong>{p.name}</strong>
              <small>
                {p.id === "fun-spending"
                  ? "FunSpending · lazer sem culpa"
                  : "Seu objetivo pessoal"}
              </small>
              <strong className="goal-amount">{formatMoney(total)}</strong>
              <small>
                Meta {formatMoney(p.target)} · {p.allocations.length} ativos
              </small>
              <div className="progress-track">
                <span
                  style={{
                    width:
                      Math.min(100, p.target ? (total / p.target) * 100 : 0) +
                      "%",
                  }}
                />
              </div>
              <button
                className="button button-outline"
                onClick={() => {
                  setEditing(p.id);
                  setError("");
                }}
              >
                Gerenciar
              </button>
              {p.id !== "fun-spending" && (
                <button
                  className="button button-quiet"
                  onClick={() => onChange(pockets.filter((v) => v.id !== p.id))}
                >
                  Remover cofrinho
                </button>
              )}
            </article>
          );
        })}
      </div>
      <p className="muted">
        Cofrinhos separam uma finalidade dentro dos ativos existentes; seus
        valores não são somados novamente ao patrimônio. A reserva de emergência
        é gerenciada abaixo.
      </p>
      {current && (
        <form key={current.id} className="pocket-editor" onSubmit={save}>
          <h3>Gerenciar cofrinho</h3>
          <div className="form-fields">
            <label className="field">
              <span>Nome</span>
              <input name="name" required defaultValue={current.name} />
            </label>
            <label className="field">
              <span>Meta em BRL</span>
              <input
                name="target"
                type="number"
                min="0"
                step="0.01"
                defaultValue={current.target}
              />
            </label>
          </div>
          <p>
            Quanto de cada ativo deseja reservar? A soma entre cofrinhos não
            pode superar a posição. Ativos da reserva de emergência ficam
            separados.
          </p>
          <div className="pocket-options">
            {positions
              .filter((p) => !p.isEmergencyReserve && p.value > 0)
              .map((p) => (
                <label className="field" key={p.assetId}>
                  <span>
                    {p.ticker} · {formatMoney(p.value)}
                  </span>
                  <input
                    aria-label={"Reservar " + p.ticker + " em BRL"}
                    name={p.assetId}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={
                      current.allocations.find((a) => a.assetId === p.assetId)
                        ?.amount ?? 0
                    }
                  />
                </label>
              ))}
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="goal-actions">
            <button className="button button-primary">Salvar cofrinho</button>
            <button
              type="button"
              className="button button-outline"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
