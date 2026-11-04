import { useState } from "react";
import {
  formatDate,
  wealthHistory,
  type LedgerEvent,
} from "../../domain/domain";
import { useDisplayCurrency } from "../../shared/DisplayCurrency";
export default function WealthHistory({ events }: { events: LedgerEvent[] }) {
  const { currency } = useDisplayCurrency();
  const [view, setView] = useState("total");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [area, setArea] = useState(true);
  const all = wealthHistory(events);
  const categories = [
    ...new Set(all.flatMap((p) => Object.keys(p.byCategory ?? {}))),
  ];
  const history = all.filter(
    (p) => (!from || p.date >= from) && (!to || p.date <= to),
  );
  const values = history.map((p) => {
    const brl =
      view === "total"
        ? p.totalValue
        : view === "liquid"
          ? p.liquidValue
          : view === "illiquid"
            ? p.illiquidValue
            : p.byCategory?.[view];
    return {
      p,
      value:
        currency === "BRL"
          ? brl
          : view === "total"
            ? p.usdValue
            : brl !== undefined && p.fxRate
              ? brl / p.fxRate
              : undefined,
    };
  });
  const maximum = Math.max(1, ...values.map((v) => v.value ?? 0)) * 1.08;
  const start = Date.parse(history[0]?.date ?? "2000-01-01"),
    end = Date.parse(history[history.length - 1]?.date ?? "2000-01-01");
  const x = (i: number) =>
    history.length < 2
      ? 345
      : 90 + ((Date.parse(history[i].date) - start) / (end - start || 1)) * 510;
  const y = (v: number) => 190 - (v / maximum) * 155;
  const money = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  const compact = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 0,
    }).format(v);
  const segments: string[][] = [[]];
  values.forEach((v, i) => {
    if (v.value === undefined) {
      segments.push([]);
    } else segments[segments.length - 1].push(x(i) + "," + y(v.value));
  });
  function period(months: number) {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    setFrom(d.toISOString().slice(0, 10));
    setTo("");
  }
  return (
    <section className="panel wealth-history">
      <div className="panel-heading">
        <div>
          <h2>Histórico do patrimônio total</h2>
          <p>Snapshots preservados no tempo, em BRL e USD.</p>
        </div>
        <label>
          <input
            type="checkbox"
            checked={area}
            onChange={(e) => setArea(e.target.checked)}
          />{" "}
          Mostrar área
        </label>
      </div>
      <div className="history-controls">
        <label className="field">
          <span>Visualização</span>
          <select
            aria-label="Visualização do histórico"
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="total">Patrimônio total</option>
            <option value="liquid">Patrimônio líquido</option>
            <option value="illiquid">Patrimônio ilíquido</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>De</span>
          <input
            aria-label="Histórico de"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Até</span>
          <input
            aria-label="Histórico até"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <div className="goal-actions">
          <button className="button button-outline" onClick={() => period(6)}>
            6 meses
          </button>
          <button className="button button-outline" onClick={() => period(12)}>
            1 ano
          </button>
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
      {from && to && from > to ? (
        <p role="alert">A data inicial deve ser anterior à final.</p>
      ) : history.length ? (
        <div className="wealth-chart-scroll">
          <svg
            className="wealth-chart"
            viewBox="0 0 640 230"
            role="img"
            aria-label="Evolução do patrimônio"
          >
            <title>Patrimônio total declarado ao longo do tempo</title>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line
                  x1="90"
                  x2="600"
                  y1={y(maximum * f)}
                  y2={y(maximum * f)}
                  className="wealth-grid"
                />
                <text x="78" y={y(maximum * f) + 5} textAnchor="end">
                  {compact(maximum * f)}
                </text>
              </g>
            ))}
            {segments
              .filter((s) => s.length)
              .map((s, i) => (
                <g key={i}>
                  {area && s.length > 1 && (
                    <polygon
                      points={
                        s[0].split(",")[0] +
                        ",190 " +
                        s.join(" ") +
                        " " +
                        s[s.length - 1].split(",")[0] +
                        ",190"
                      }
                      className="wealth-fill"
                    />
                  )}
                  <polyline points={s.join(" ")} className="wealth-line" />
                </g>
              ))}
            {values.map((v, i) =>
              v.value === undefined ? null : (
                <circle
                  key={v.p.id}
                  cx={x(i)}
                  cy={y(v.value)}
                  r="4"
                  className="wealth-point"
                >
                  <title>{formatDate(v.p.date) + " · " + money(v.value)}</title>
                </circle>
              ),
            )}
            <text x="90" y="220">
              {formatDate(history[0].date)}
            </text>
            <text x="600" y="220" textAnchor="end">
              {formatDate(history[history.length - 1].date)}
            </text>
          </svg>
        </div>
      ) : (
        <p>
          Sem registros neste período. Exporte para registrar seu primeiro
          snapshot.
        </p>
      )}
      <p className="wealth-history-note">
        USD usa o câmbio salvo no snapshot. Registros antigos sem câmbio ou
        composição aparecem como indisponíveis, sem estimativas retroativas.
        Cada exportação registra um novo ponto, sem alterar os anteriores.
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
                <th>USD histórico</th>
                <th>Câmbio</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.date)}</td>
                  <td>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(p.totalValue)}
                  </td>
                  <td>
                    {p.usdValue === undefined
                      ? "Não registrado"
                      : new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "USD",
                        }).format(p.usdValue)}
                  </td>
                  <td>{p.fxRate ?? "—"}</td>
                  <td>
                    {p.provenance
                      ? p.provenance.sheet + "!" + p.provenance.range
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
