import { useState, type FormEvent } from "react";
import {
  createDefaultPockets,
  pocketBalances,
  validatePocket,
  type Pocket,
} from "../../domain/pockets";
import type { Position } from "../../domain/domain";
import PocketAllocationEditor from "./PocketAllocationEditor";
import { useDisplayCurrency } from "../../shared/DisplayCurrency";
const defaultPockets = createDefaultPockets();
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
  const [draft, setDraft] = useState<Pocket | null>(null);
  const current = draft ?? pockets.find((p) => p.id === editing);
  const balances = pocketBalances(pockets, positions);
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
    try {
      validatePocket(next, pockets, positions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revise o cofrinho.");
      return;
    }
    onChange(
      pockets.some((p) => p.id === next.id)
        ? pockets.map((p) => (p.id === next.id ? next : p))
        : [...pockets, next],
    );
    setEditing(null);
    setDraft(null);
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
            setDraft(p);
            setEditing(null);
            setError("");
          }}
        >
          Criar cofrinho
        </button>
      </div>
      <div className="goal-grid">
        {pockets.map((p) => {
          const balance = balances.find((item) => item.id === p.id)!;
          const total = balance.total;
          return (
            <article className="goal-item" key={p.id}>
              <strong>{p.name}</strong>
              <small>
                {p.id === "fun-spending"
                  ? "FunSpending · lazer sem culpa"
                  : "Seu objetivo pessoal"}
              </small>
              <strong className="goal-amount">{formatMoney(total)}</strong>
              {balance.shortfall > 0.005 && (
                <p className="pocket-warning" role="status">
                  O valor disponível caiu. Destinado:{" "}
                  {formatMoney(balance.requested)}. Revise a divisão dos ativos.
                </p>
              )}
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
                  setDraft(null);
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
        é gerenciada separadamente.
      </p>
      {current && (
        <form key={current.id} className="pocket-editor" onSubmit={save}>
          <h3>{draft ? "Novo cofrinho" : "Gerenciar cofrinho"}</h3>
          <PocketAllocationEditor
            current={current}
            pockets={pockets}
            positions={positions}
          />
          {error && <p role="alert">{error}</p>}
          <div className="goal-actions">
            <button className="button button-primary">Salvar cofrinho</button>
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setEditing(null);
                setDraft(null);
                setError("");
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
