import { useId, useState } from "react";
import { Search, X } from "lucide-react";
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
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [target, setTarget] = useState(String(current.target));
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      current.allocations.map((item) => [item.assetId, item.amount]),
    ),
  );
  const total = Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
  const goal = Math.max(0, Number(target) || 0);
  const remaining = Math.max(0, goal - total);
  const eligible = positions.filter(
    (asset) => !asset.isEmergencyReserve && asset.value > 0,
  );
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const matches = (asset: Position) =>
    (!selectedOnly || (amounts[asset.assetId] ?? 0) > 0) &&
    normalize(asset.ticker + " " + asset.name).includes(
      normalize(search.trim()),
    );
  const visibleCount = eligible.filter(matches).length;
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
            inputMode="decimal"
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
      <div className="allocation-toolbar">
        <label className="allocation-search" htmlFor={searchId}>
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Buscar ativo para o cofrinho</span>
          <input
            id={searchId}
            type="search"
            placeholder="Buscar ativo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
          {search && (
            <button
              type="button"
              aria-label="Limpar busca de ativos do cofrinho"
              onClick={() => setSearch("")}
            >
              <X size={17} aria-hidden="true" />
            </button>
          )}
        </label>
        <button
          className="allocation-selected-filter"
          type="button"
          aria-pressed={selectedOnly}
          onClick={() => setSelectedOnly((value) => !value)}
        >
          Somente destinados
        </button>
      </div>
      <p className="allocation-result-count" role="status">
        {visibleCount} de {eligible.length} ativos
      </p>
      {!visibleCount && (
        <p className="allocation-empty">
          Nenhum ativo encontrado. Ajuste a busca ou mostre todos os ativos.
        </p>
      )}
      <div className="pocket-options">
        {/* Keep filtered fields mounted: the parent saves every allocation through FormData. */}
        {eligible.map((asset) => {
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
            <div
              className="field allocation-asset"
              key={asset.assetId}
              hidden={!matches(asset)}
            >
              <label htmlFor={"amount-" + current.id + asset.assetId}>
                {asset.ticker}
              </label>
              <input
                id={"amount-" + current.id + asset.assetId}
                aria-label={"Reservar " + asset.ticker + " em BRL"}
                name={asset.assetId}
                type="number"
                inputMode="decimal"
                aria-describedby={"limit-" + current.id + asset.assetId}
                min="0"
                max={cap}
                step="0.01"
                value={amount}
                onChange={(event) => update(event.target.value)}
              />
              <input
                aria-label={"Slider de " + asset.ticker + " em BRL"}
                aria-valuetext={formatMoney(amount)}
                aria-describedby={"limit-" + current.id + asset.assetId}
                type="range"
                min="0"
                max={Math.max(cap, amount)}
                step="0.01"
                value={amount}
                onChange={(event) => update(event.target.value)}
              />
              <small id={"limit-" + current.id + asset.assetId}>
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
