import { useId, useMemo, useState } from "react";
import type { DisplayCurrency } from "../../domain/domain";
import {
  chartGeometry,
  nearestChartIndex,
  useChartViewport,
} from "./chartViewport";
import {
  comparisonMonths,
  indexedMonths,
  type ComparisonSeries,
} from "../../domain/comparison";

export default function ComparisonChart({
  series,
  currency,
  indexed,
}: {
  series: ComparisonSeries[];
  currency: DisplayCurrency;
  indexed: boolean;
}) {
  const id = useId();
  const viewport = useChartViewport();
  const [touchSelection, setTouchSelection] = useState(false);
  const original = useMemo(() => comparisonMonths(series), [series]);
  const rows = useMemo(
    () =>
      indexed
        ? indexedMonths(
            original,
            series.map((item) => item.id),
          )
        : original,
    [original, series, indexed],
  );
  const [active, setActive] = useState<number | null>(null);
  const index = Math.max(
    0,
    Math.min(active ?? rows.length - 1, rows.length - 1),
  );
  const selected = rows[index],
    source = original[index];
  const mixed =
    !indexed &&
    series.some((item) => item.id === "contributions") &&
    series.some((item) => item.id !== "contributions");
  const rightAxis = (seriesId: string) => mixed && seriesId === "contributions";
  const geometry = chartGeometry(viewport.width, mixed);
  const format = (value: number) =>
    indexed
      ? new Intl.NumberFormat("pt-BR", {
          maximumFractionDigits: 1,
          signDisplay: "exceptZero",
        }).format(value) + "%"
      : new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(value);
  const compact = (value: number) =>
    indexed
      ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
          value,
        ) + "%"
      : new Intl.NumberFormat("pt-BR", {
          ...(geometry.compact ? {} : { style: "currency", currency }),
          notation: "compact",
          maximumFractionDigits: 0,
        }).format(value);
  const bounds = (right: boolean) => {
    const values = rows.flatMap((row) =>
      series
        .filter((item) => rightAxis(item.id) === right)
        .flatMap((item) =>
          row.values[item.id] === null ? [] : [row.values[item.id]!],
        ),
    );
    const min = Math.min(0, ...values),
      max = Math.max(1, ...values);
    return { min, max: max + (max - min) * 0.08 };
  };
  const left = bounds(false),
    right = bounds(true);
  const x = (i: number) =>
    rows.length === 1
      ? (geometry.start + geometry.end) / 2
      : geometry.start +
        (i / (rows.length - 1)) * (geometry.end - geometry.start);
  const y = (value: number, rightSide: boolean) => {
    const scale = rightSide ? right : left;
    return (
      geometry.bottom -
      ((value - scale.min) / (scale.max - scale.min)) *
        (geometry.bottom - geometry.top)
    );
  };
  const color = (item: ComparisonSeries) =>
    `var(--comparison-${item.colorIndex % 9})`;
  const dash = (item: ComparisonSeries) =>
    item.id === "contributions"
      ? "7 5"
      : ([undefined, "3 4", "10 4 2 4", "12 4 2 4 2 4"][
          Math.floor(item.colorIndex / 9)
        ] ??
        (item.colorIndex < 9
          ? undefined
          : `${4 + Math.floor(item.colorIndex / 9) * 2} 5`));
  const known = rows.some((row) =>
    series.some((item) => row.values[item.id] !== null),
  );
  const selectAt = (clientX: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect();
    setActive(nearestChartIndex(clientX, rect, geometry, rows.length));
  };
  return (
    <div className="comparison-chart" ref={viewport.ref}>
      {!rows.length ? (
        <p className="comparison-empty">
          Ainda não há registros neste período. Escolha outro intervalo ou
          registre suas movimentações.
        </p>
      ) : (
        <>
          <div className="comparison-readout">
            <div className="comparison-readout-heading">
              <strong>{selected?.label}</strong>
              <span>
                {active === null
                  ? "Toque no gráfico ou explore por mês"
                  : "Valores do mês selecionado"}
              </span>
            </div>
            <ul aria-label="Valores das linhas selecionadas">
              {series.map((item) => (
                <li key={item.id} style={{ color: color(item) }}>
                  <span className="comparison-series-name">
                    <svg
                      viewBox="0 0 24 8"
                      width="24"
                      height="8"
                      aria-hidden="true"
                    >
                      <line
                        x1="0"
                        x2="24"
                        y1="4"
                        y2="4"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={dash(item)}
                      />
                    </svg>
                    <span>{item.label}</span>
                  </span>
                  <strong title={source?.details[item.id]}>
                    {selected?.values[item.id] === null ||
                    selected?.values[item.id] === undefined
                      ? indexed &&
                        source?.values[item.id] !== null &&
                        source?.values[item.id] !== undefined
                        ? "Sem base positiva"
                        : "Não registrado"
                      : format(selected.values[item.id]!)}
                  </strong>
                  {indexed &&
                    source?.values[item.id] !== null &&
                    source?.values[item.id] !== undefined && (
                      <small>
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency,
                          maximumFractionDigits: 2,
                        }).format(source.values[item.id]!)}
                      </small>
                    )}
                </li>
              ))}
            </ul>
          </div>
          {!known ? (
            <p className="comparison-empty">
              {indexed &&
              original.some((row) =>
                series.some((item) => row.values[item.id] !== null),
              )
                ? "As linhas precisam de um primeiro valor positivo para comparar a evolução. Consulte os valores registrados na opção Valores."
                : "Não há valores conhecidos para estas linhas na moeda selecionada. Os dados originais foram preservados."}
            </p>
          ) : (
            <div className="comparison-plot-scroll">
              <svg
                className="comparison-plot"
                viewBox={`0 0 ${geometry.width} ${geometry.height}`}
                role="img"
                aria-labelledby={id + "-title " + id + "-desc"}
                onPointerLeave={(event) => {
                  if (event.pointerType === "mouse" && !touchSelection)
                    setActive(null);
                }}
                onPointerMove={(event) => {
                  if (event.pointerType === "mouse" || event.buttons)
                    selectAt(event.clientX, event.currentTarget);
                }}
                onPointerDown={(event) => {
                  setTouchSelection(event.pointerType !== "mouse");
                  selectAt(event.clientX, event.currentTarget);
                }}
              >
                <title id={id + "-title"}>
                  Patrimônio e aportes:{" "}
                  {series.map((item) => item.label).join(", ")}
                </title>
                <desc id={id + "-desc"}>
                  {indexed
                    ? "Variação percentual desde o primeiro valor positivo de cada linha."
                    : mixed
                      ? "Patrimônio no eixo esquerdo; aportes mensais no eixo direito, em " +
                        currency +
                        "."
                      : "Valores em " + currency + "."}{" "}
                  Meses ausentes interrompem as linhas. Use o controle Explorar
                  mês para consultar todos os valores pelo teclado.
                </desc>
                <text
                  className="comparison-axis-title"
                  x={geometry.compact ? 0 : geometry.start}
                  y="24"
                >
                  {indexed
                    ? geometry.compact
                      ? "Evolução (%)"
                      : "Variação desde o início (%)"
                    : (series.every((item) => item.id === "contributions")
                        ? "Aportes/mês"
                        : "Patrimônio") +
                      " · " +
                      currency}
                </text>
                {mixed && (
                  <text
                    className="comparison-axis-title"
                    x={geometry.compact ? geometry.width : geometry.end}
                    y="24"
                    textAnchor="end"
                  >
                    {geometry.compact ? "Aportes" : "Aportes/mês"} · {currency}
                    {geometry.compact ? "" : " (direita)"}
                  </text>
                )}
                {(geometry.compact ? [0, 2, 4] : [0, 1, 2, 3, 4]).map(
                  (tick) => {
                    const value = left.min + ((left.max - left.min) * tick) / 4;
                    return (
                      <g key={tick}>
                        <line
                          className="comparison-grid"
                          x1={geometry.start}
                          x2={geometry.end}
                          y1={y(value, false)}
                          y2={y(value, false)}
                        />
                        <text
                          x={geometry.start - 7}
                          y={y(value, false) + 4}
                          textAnchor="end"
                        >
                          {compact(value)}
                        </text>
                        {mixed && (
                          <text
                            x={
                              geometry.compact
                                ? geometry.width - 2
                                : geometry.end + 7
                            }
                            y={y(value, false) + 4}
                            textAnchor={geometry.compact ? "end" : "start"}
                          >
                            {compact(
                              right.min + ((right.max - right.min) * tick) / 4,
                            )}
                          </text>
                        )}
                      </g>
                    );
                  },
                )}
                {series.map((item) => {
                  const segments: number[][] = [[]];
                  rows.forEach((row, i) =>
                    row.values[item.id] === null
                      ? segments.push([])
                      : segments[segments.length - 1].push(i),
                  );
                  return (
                    <g key={item.id} style={{ color: color(item) }}>
                      {segments
                        .filter((segment) => segment.length)
                        .map((segment, i) => (
                          <g key={i}>
                            {segment.length > 1 && (
                              <polyline
                                className="comparison-line"
                                points={segment
                                  .map(
                                    (j) =>
                                      `${x(j)},${y(rows[j].values[item.id]!, rightAxis(item.id))}`,
                                  )
                                  .join(" ")}
                                strokeDasharray={dash(item)}
                              />
                            )}
                            {segment.map((j) => (
                              <circle
                                key={j}
                                className="comparison-point"
                                cx={x(j)}
                                cy={y(
                                  rows[j].values[item.id]!,
                                  rightAxis(item.id),
                                )}
                                r={
                                  active === j
                                    ? 4.5
                                    : rows.length > 20
                                      ? 1.8
                                      : 3
                                }
                              >
                                <title>
                                  {item.label +
                                    " · " +
                                    rows[j].label +
                                    " · " +
                                    format(rows[j].values[item.id]!)}
                                </title>
                              </circle>
                            ))}
                          </g>
                        ))}
                    </g>
                  );
                })}
                {active !== null && (
                  <line
                    className="comparison-crosshair"
                    x1={x(index)}
                    x2={x(index)}
                    y1={geometry.top - 6}
                    y2={geometry.bottom}
                  />
                )}
                {[
                  ...new Set([
                    0,
                    ...(geometry.compact
                      ? []
                      : [
                          Math.floor((rows.length - 1) / 3),
                          Math.floor(((rows.length - 1) * 2) / 3),
                        ]),
                    rows.length - 1,
                  ]),
                ].map((i) => (
                  <text
                    key={i}
                    x={x(i)}
                    y={geometry.bottom + 27}
                    textAnchor={
                      i === 0
                        ? "start"
                        : i === rows.length - 1
                          ? "end"
                          : "middle"
                    }
                  >
                    {rows[i].label}
                  </text>
                ))}
              </svg>
            </div>
          )}
          <label className="comparison-explorer">
            <span>
              Explorar mês <strong>{selected?.label}</strong>
            </span>
            <input
              type="range"
              aria-label="Explorar mês do gráfico"
              min="0"
              max={Math.max(0, rows.length - 1)}
              step="1"
              value={index}
              onChange={(event) => setActive(Number(event.target.value))}
              aria-valuetext={
                selected?.label +
                ": " +
                series
                  .map(
                    (item) =>
                      item.label +
                      " " +
                      (selected?.values[item.id] === null
                        ? "não registrado"
                        : format(selected?.values[item.id] ?? 0)),
                  )
                  .join("; ")
              }
            />
          </label>
        </>
      )}
    </div>
  );
}
