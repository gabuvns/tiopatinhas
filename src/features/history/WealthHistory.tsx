import { useState } from "react";
import {
  formatDate,
  wealthHistory,
  type DisplayCurrency,
  type LedgerEvent,
} from "../../domain/domain";
import { historySeries, historyViews } from "../../domain/history";
import { snapshotRate, snapshotValue } from "../../domain/money";
import { useDisplayCurrency } from "../../shared/DisplayCurrency";
import TimeSeriesChart from "../../shared/charts/TimeSeriesChart";
export default function WealthHistory({ events }: { events: LedgerEvent[] }) {
  const { currency } = useDisplayCurrency();
  const [selected, setSelected] = useState<string[]>([
    "total",
    "contributions",
  ]);
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [area, setArea] = useState(true);
  const all = wealthHistory(events);
  const categories = [
    ...new Set(all.flatMap((point) => Object.keys(point.byCategory ?? {}))),
  ].sort();
  const options = [
    ...Object.entries(historyViews),
    ...categories.map((category) => [category, category]),
  ];
  const history = all.filter(
    (point) => (!from || point.date >= from) && (!to || point.date <= to),
  );
  const invalid = Boolean(from && to && from > to);
  function period(months: number) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (months - 1));
    setFrom(
      [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        "01",
      ].join("-"),
    );
    setTo("");
  }
  const money = (value: number, unit: DisplayCurrency) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: unit,
    }).format(value);
  return (
    <section className="panel wealth-history">
      <div className="panel-heading">
        <div>
          <h2>Patrimônio e aportes</h2>
          <p>
            Compare categorias, explore os pontos e acompanhe o dinheiro
            investido em cada mês.
          </p>
        </div>
        <label className="chart-area-toggle">
          <input
            type="checkbox"
            checked={area}
            onChange={(event) => setArea(event.target.checked)}
          />{" "}
          Mostrar área
        </label>
      </div>
      <div className="history-controls">
        <label className="field">
          <span>Visualização principal</span>
          <select
            aria-label="Visualização do histórico"
            value={selected[0] ?? "total"}
            onChange={(event) =>
              setSelected([
                event.target.value,
                ...selected
                  .slice(1)
                  .filter((view) => view !== event.target.value),
              ])
            }
          >
            {options.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>De</span>
          <input
            type="date"
            aria-label="Histórico de"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Até</span>
          <input
            type="date"
            aria-label="Histórico até"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <div className="goal-actions">
          {[3, 6, 12, 36].map((months) => (
            <button
              type="button"
              className="button button-outline"
              key={months}
              onClick={() => period(months)}
            >
              {months < 12
                ? months + " meses"
                : months / 12 + (months === 12 ? " ano" : " anos")}
            </button>
          ))}
          <button
            className="button button-outline"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Tudo
          </button>
        </div>
      </div>
      <fieldset className="chart-comparison">
        <legend>Gráficos simultâneos</legend>
        {options.map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={selected.includes(key)}
              disabled={selected.length === 1 && selected[0] === key}
              onChange={(event) =>
                setSelected((views) =>
                  event.target.checked
                    ? [...views, key]
                    : views.filter((view) => view !== key),
                )
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      {invalid ? (
        <p role="alert">A data inicial deve ser anterior à final.</p>
      ) : (
        <div className="history-charts-grid">
          {selected.map((view) => (
            <TimeSeriesChart
              key={view + currency + from + to}
              title={options.find(([key]) => key === view)?.[1] ?? view}
              points={historySeries(events, view, currency, from, to)}
              currency={currency}
              bars={view === "contributions"}
              area={area}
            />
          ))}
        </div>
      )}
      <p className="wealth-history-note">
        Cada painel usa sua própria escala. O patrimônio em outras moedas
        preserva o câmbio do snapshot. Aportes convertidos usam o câmbio
        registrado na operação ou disponível até sua data; sem ele, o mês fica
        indisponível. Vendas não reduzem o total de compras e aportes. Registros
        consolidados e operações precisam representar lançamentos distintos para
        evitar dupla contagem.
      </p>
      <details>
        <summary>
          Consultar os {history.length} registros e suas origens
        </summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Referência</th>
                <th>BRL</th>
                <th>{currency === "BRL" ? "USD" : currency} histórico</th>
                <th>BRL por 1 {currency === "BRL" ? "USD" : currency}</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {history.map((point) => (
                <tr key={point.id}>
                  <td>
                    {point.origin === "export"
                      ? new Date(point.createdAt).toLocaleString("pt-BR")
                      : formatDate(point.date)}
                  </td>
                  <td>{money(point.totalValue, "BRL")}</td>
                  <td>
                    {snapshotValue(
                      point,
                      currency === "BRL" ? "USD" : currency,
                    ) === undefined
                      ? "Não registrado"
                      : money(
                          snapshotValue(
                            point,
                            currency === "BRL" ? "USD" : currency,
                          )!,
                          currency === "BRL" ? "USD" : currency,
                        )}
                  </td>
                  <td>
                    {snapshotRate(
                      point,
                      currency === "BRL" ? "USD" : currency,
                    ) ?? "—"}
                  </td>
                  <td>
                    {point.provenance
                      ? point.provenance.sheet + "!" + point.provenance.range
                      : "Snapshot da exportação"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
