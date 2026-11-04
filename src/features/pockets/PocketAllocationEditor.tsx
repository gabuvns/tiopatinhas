import { useState } from "react";
import { availableForPocket, type Pocket } from "../../domain/pockets";
import { formatMoney, type Position } from "../../domain/domain";

export default function PocketAllocationEditor({
  current,
  pockets,
  positions,
}: {
  current: Pocket;
  pockets: Pocket[];
  positions: Position[];
}) {
  const [target, setTarget] = useState(String(current.target));
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      current.allocations.map((item) => [item.assetId, item.amount]),
    ),
  );
  const total = Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
  const goal = Math.max(0, Number(target) || 0);
  const remaining = Math.max(0, goal - total);
  return (
    <>
      <div className="form-fields">
        <label className="field">
          <span>Nome</span>
          <input autoFocus name="name" required defaultValue={current.name} />
        </label>
        <label className="field">
          <span>Meta em BRL</span>
          <input
            name="target"
            type="number"
            min="0"
            step="0.01"
            required
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </label>
      </div>
      <p className="allocation-summary" role="status">
        Destinado: <strong>{formatMoney(total)}</strong> · Restante até a meta:{" "}
        <strong>{formatMoney(remaining)}</strong>
      </p>
      {total > goal + 0.005 && (
        <p role="alert" className="pocket-warning">
          A soma ultrapassa a meta. Reduza as destinações ou aumente a meta
          antes de salvar.
        </p>
      )}
      <p>
        Distribua o valor entre os ativos. O limite considera a meta, as outras
        destinações e o saldo disponível fora da reserva de emergência.
      </p>
      <div className="pocket-options">
        {positions
          .filter((asset) => !asset.isEmergencyReserve && asset.value > 0)
          .map((asset) => {
            const amount = amounts[asset.assetId] ?? 0;
            const available = availableForPocket(asset, pockets, current.id);
            const cap =
              Math.floor(
                Math.max(0, Math.min(available, goal - (total - amount))) * 100,
              ) / 100;
            const update = (raw: string) => {
              const next = Number(raw);
              if (Number.isFinite(next))
                setAmounts((values) => ({
                  ...values,
                  [asset.assetId]: Math.max(0, Math.min(cap, next)),
                }));
            };
            return (
              <div className="field allocation-asset" key={asset.assetId}>
                <label htmlFor={"amount-" + current.id + asset.assetId}>
                  {asset.ticker}
                </label>
                <input
                  id={"amount-" + current.id + asset.assetId}
                  aria-label={"Reservar " + asset.ticker + " em BRL"}
                  name={asset.assetId}
                  type="number"
                  min="0"
                  max={cap}
                  step="0.01"
                  value={amount}
                  onChange={(event) => update(event.target.value)}
                />
                <input
                  aria-label={"Slider de " + asset.ticker + " em BRL"}
                  aria-valuetext={formatMoney(amount)}
                  type="range"
                  min="0"
                  max={Math.max(cap, amount)}
                  step="0.01"
                  value={amount}
                  onChange={(event) => update(event.target.value)}
                />
                <small>
                  Até {formatMoney(cap)} para este ativo · disponível{" "}
                  {formatMoney(available)}
                </small>
              </div>
            );
          })}
      </div>
      {current.allocations.some(
        (item) =>
          !positions.some(
            (asset) =>
              asset.assetId === item.assetId &&
              !asset.isEmergencyReserve &&
              asset.value > 0,
          ),
      ) && (
        <p className="pocket-warning">
          Há ativos indisponíveis. Remova suas destinações para redistribuir o
          valor.
        </p>
      )}
      {current.allocations
        .filter(
          (item) =>
            !positions.some(
              (asset) =>
                asset.assetId === item.assetId &&
                !asset.isEmergencyReserve &&
                asset.value > 0,
            ),
        )
        .map((item) => (
          <button
            className="button button-outline"
            type="button"
            key={item.assetId}
            onClick={() =>
              setAmounts((values) => ({ ...values, [item.assetId]: 0 }))
            }
          >
            Liberar {item.assetId}: {formatMoney(amounts[item.assetId] ?? 0)}
          </button>
        ))}
    </>
  );
}
