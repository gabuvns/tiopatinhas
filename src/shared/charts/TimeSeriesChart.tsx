import { useState } from "react";
import type { DisplayCurrency } from "../../domain/domain";
import type { ChartPoint } from "../../domain/history";
export default function TimeSeriesChart({
  title,
  points,
  currency,
  bars = false,
  area = true,
}: {
  title: string;
  points: ChartPoint[];
  currency: DisplayCurrency;
  bars?: boolean;
  area?: boolean;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const activeIndex = Math.min(index ?? points.length - 1, points.length - 1);
  const selected = points[activeIndex];
  const money = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  const compact = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 0,
    }).format(value);
  const max = Math.max(1, ...points.map((point) => point.value ?? 0)) * 1.08;
  const start = Date.parse(points[0]?.date ?? "2000-01-01"),
    end = Date.parse(points[points.length - 1]?.date ?? "2000-01-01");
  const x = (i: number) =>
    bars || end === start
      ? points.length === 1
        ? 365
        : 90 + (i / Math.max(1, points.length - 1)) * 550
      : 90 + ((Date.parse(points[i].date) - start) / (end - start)) * 550;
  const y = (value: number) => 210 - (value / max) * 175;
  const segments: number[][] = [[]];
  points.forEach((point, i) =>
    point.value === null
      ? segments.push([])
      : segments[segments.length - 1].push(i),
  );
  const previous = selected
    ? points
        .slice(0, activeIndex)
        .filter((point) => point.value !== null)
        .slice(-1)[0]
    : undefined;
  return (
    <article className="history-chart-card" aria-label={title}>
      <h3>{title}</h3>
      {!points.length ? (
        <p className="chart-empty">Sem registros no período selecionado.</p>
      ) : (
        <>
          <div className="chart-readout" aria-live="polite">
            <span>{selected?.label}</span>
            <strong>
              {selected?.value === null
                ? "Não registrado"
                : money(selected?.value ?? 0)}
            </strong>
            <small>
              {selected?.detail ??
                (previous?.value !== null &&
                previous?.value !== undefined &&
                selected?.value !== null &&
                selected?.value !== undefined
                  ? "Variação desde o ponto anterior: " +
                    money(selected.value - previous.value)
                  : "Explore os pontos com o mouse, toque ou teclado")}
            </small>
          </div>
          {!points.some((point) => point.value !== null) ? (
            <p className="chart-empty">
              Sem valores conhecidos nesta moeda e categoria. Os dados originais
              foram preservados.
            </p>
          ) : (
            <div className="wealth-chart-scroll">
              <svg
                className="wealth-chart interactive-chart"
                viewBox="0 0 700 250"
                role="img"
                aria-label={title + " em " + currency}
                onPointerLeave={() => setIndex(null)}
                onPointerMove={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect(),
                    pointer =
                      ((event.clientX - bounds.left) / bounds.width) * 700;
                  let nearest = 0;
                  points.forEach((_, i) => {
                    if (
                      Math.abs(x(i) - pointer) < Math.abs(x(nearest) - pointer)
                    )
                      nearest = i;
                  });
                  setIndex(nearest);
                }}
              >
                <title>{title + " · " + currency}</title>
                {[0, 0.5, 1].map((fraction) => (
                  <g key={fraction}>
                    <line
                      className="wealth-grid"
                      x1="90"
                      x2="640"
                      y1={y(max * fraction)}
                      y2={y(max * fraction)}
                    />
                    <text x="78" y={y(max * fraction) + 5} textAnchor="end">
                      {compact(max * fraction)}
                    </text>
                  </g>
                ))}
                {bars
                  ? points.map((point, i) =>
                      point.value === null ? null : (
                        <rect
                          key={point.id}
                          className="contribution-bar"
                          x={x(i) - Math.min(18, 240 / points.length)}
                          y={y(point.value)}
                          width={Math.min(36, 480 / points.length)}
                          height={210 - y(point.value)}
                        >
                          <title>
                            {point.label + " · " + money(point.value)}
                          </title>
                        </rect>
                      ),
                    )
                  : segments
                      .filter((segment) => segment.length)
                      .map((segment, i) => (
                        <g key={i}>
                          {area && segment.length > 1 && (
                            <polygon
                              className="wealth-fill"
                              points={
                                x(segment[0]) +
                                ",210 " +
                                segment
                                  .map((j) => x(j) + "," + y(points[j].value!))
                                  .join(" ") +
                                " " +
                                x(segment[segment.length - 1]) +
                                ",210"
                              }
                            />
                          )}
                          <polyline
                            className="wealth-line"
                            points={segment
                              .map((j) => x(j) + "," + y(points[j].value!))
                              .join(" ")}
                          />
                        </g>
                      ))}
                {!bars &&
                  points.map((point, i) =>
                    point.value === null ? null : (
                      <circle
                        key={point.id}
                        className="wealth-point"
                        cx={x(i)}
                        cy={y(point.value)}
                        r={index === i ? 6 : 4}
                      >
                        <title>
                          {point.label + " · " + money(point.value)}
                        </title>
                      </circle>
                    ),
                  )}
                {index !== null && (
                  <line
                    className="chart-crosshair"
                    x1={x(activeIndex)}
                    x2={x(activeIndex)}
                    y1="25"
                    y2="210"
                  />
                )}
                <text x="90" y="241">
                  {points[0].label}
                </text>
                <text x="640" y="241" textAnchor="end">
                  {points.length > 1 ? points[points.length - 1].label : ""}
                </text>
              </svg>
            </div>
          )}
          <label className="chart-explorer">
            <span>Explorar {title.toLocaleLowerCase("pt-BR")}</span>
            <input
              type="range"
              aria-label={"Explorar " + title}
              min="0"
              max={Math.max(0, points.length - 1)}
              step="1"
              value={index ?? points.length - 1}
              onChange={(event) => setIndex(Number(event.target.value))}
              aria-valuetext={
                selected?.label +
                " · " +
                (selected?.value === null
                  ? "Não registrado"
                  : money(selected?.value ?? 0))
              }
            />
          </label>
        </>
      )}
    </article>
  );
}
