import { useEffect, useMemo, useState } from "react";
import {
  formatDate,
  wealthHistory,
  type DisplayCurrency,
  type LedgerEvent,
} from "../../domain/domain";
import { historySeries, historyViews } from "../../domain/history";
import { snapshotRate, snapshotValue } from "../../domain/money";
import { useDisplayCurrency } from "../../shared/DisplayCurrency";
import ComparisonChart from "../../shared/charts/ComparisonChart";
import SeriesPicker from "../../shared/charts/SeriesPicker";
import "./comparison.css";

export default function WealthHistory({ events }: { events: LedgerEvent[] }) {
  const { currency } = useDisplayCurrency();
  const [selected, setSelected] = useState<string[]>([
    "total",
    "contributions",
  ]);
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [indexed, setIndexed] = useState(false),
    [preset, setPreset] = useState<number | null>(0);
  const all = useMemo(() => wealthHistory(events), [events]);
  const options = useMemo(() => {
    const categories = [
      ...new Set(all.flatMap((point) => Object.keys(point.byCategory ?? {}))),
    ].sort();
    return [
      ...Object.entries(historyViews),
      ...categories.map((category) => [category, category]),
    ].map(([id, label]) => ({ id, label }));
  }, [all]);
  useEffect(() => {
    setSelected((previous) => {
      const available = previous.filter((id) =>
        options.some((option) => option.id === id),
      );
      return available.length === previous.length
        ? previous
        : available.length
          ? available
          : ["total"];
    });
  }, [options]);
  const series = useMemo(
    () =>
      selected.map((view) => ({
        id: view,
        label: options.find((option) => option.id === view)?.label ?? view,
        colorIndex: Math.max(
          0,
          options.findIndex((option) => option.id === view),
        ),
        points: historySeries(events, view, currency, from, to),
      })),
    [events, selected, currency, from, to, options],
  );
  const history = all.filter(
    (point) => (!from || point.date >= from) && (!to || point.date <= to),
  );
  const invalid = Boolean(from && to && from > to);
  function period(months: number) {
    setPreset(months);
    setTo("");
    if (!months) {
      setFrom("");
      return;
    }
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
  }
  const money = (value: number, unit: DisplayCurrency) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: unit,
    }).format(value);
  const historicalCurrency = currency === "BRL" ? "USD" : currency;
  return (
    <section className="panel wealth-history wealth-comparison">
      <div className="comparison-heading">
        <div>
          <h2>Evolução patrimonial</h2>
          <p>Compare os saldos e seus aportes mês a mês.</p>
        </div>
        <SeriesPicker
          options={options}
          selected={selected}
          onChange={setSelected}
        />
      </div>
      <div className="comparison-toolbar">
        <div
          className="comparison-periods"
          role="group"
          aria-label="Período do gráfico"
        >
          {[
            [3, "3 meses"],
            [6, "6 meses"],
            [12, "1 ano"],
            [36, "3 anos"],
            [0, "Tudo"],
          ].map(([months, label]) => (
            <button
              key={months}
              type="button"
              aria-pressed={preset === months}
              onClick={() => period(Number(months))}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className="comparison-modes"
          role="group"
          aria-label="Escala do gráfico"
        >
          <button
            type="button"
            aria-pressed={!indexed}
            onClick={() => setIndexed(false)}
          >
            Valores
          </button>
          <button
            type="button"
            aria-pressed={indexed}
            onClick={() => setIndexed(true)}
          >
            Evolução %
          </button>
        </div>
      </div>
      <div className="comparison-date-range">
        <label>
          <span>De</span>
          <input
            type="date"
            aria-label="Histórico de"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPreset(null);
            }}
          />
        </label>
        <span aria-hidden="true">—</span>
        <label>
          <span>Até</span>
          <input
            type="date"
            aria-label="Histórico até"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPreset(null);
            }}
          />
        </label>
        <span className="comparison-frequency">Fechamento mensal</span>
      </div>
      {invalid ? (
        <p className="comparison-date-error" role="alert">
          A data inicial deve ser anterior à final.
        </p>
      ) : (
        <ComparisonChart
          key={currency + from + to + indexed + selected.join("|")}
          series={series}
          currency={currency}
          indexed={indexed}
        />
      )}
      <div className="comparison-footnotes">
        <details>
          <summary>Como ler o gráfico</summary>
          <p>
            Cada mês mostra o último snapshot disponível; aportes somam as
            compras e contribuições do período, sem descontar vendas. Ao
            comparar com o patrimônio, os aportes usam o eixo direito. Os demais
            saldos usam o eixo esquerdo.
          </p>
          <p>
            Em Evolução %, cada linha parte de 0% no seu primeiro valor positivo
            do período. Isso compara a variação dos valores registrados,
            incluindo aportes e reavaliações; não representa rentabilidade.
            Dados ausentes interrompem a linha, sem estimativas. Conversões
            preservam as referências históricas.
          </p>
        </details>
        <details>
          <summary>Consultar {history.length} registros de patrimônio</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Referência</th>
                  <th>BRL</th>
                  <th>{historicalCurrency} histórico</th>
                  <th>BRL por 1 {historicalCurrency}</th>
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
                      {snapshotValue(point, historicalCurrency) === undefined
                        ? "Não registrado"
                        : money(
                            snapshotValue(point, historicalCurrency)!,
                            historicalCurrency,
                          )}
                    </td>
                    <td>{snapshotRate(point, historicalCurrency) ?? "—"}</td>
                    <td>
                      {point.provenance
                        ? point.provenance.sheet + "!" + point.provenance.range
                        : point.origin === "export"
                          ? "Snapshot da exportação"
                          : "Registro histórico"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}
