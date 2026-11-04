import { useId, useState } from "react";
import { useDisplayCurrency } from "../DisplayCurrency";
import {
  chartGeometry,
  nearestChartIndex,
  useChartViewport,
} from "./chartViewport";
import "./projection-touch.css";

interface Point {
  year: number;
  value: number;
  deposits: number;
}
export default function ProjectionChart({ rows }: { rows: Point[] }) {
  const { currency, formatMoney, compact, convert } = useDisplayCurrency();
  const viewport = useChartViewport();
  const geometry = chartGeometry(viewport.width);
  const [selected, setSelected] = useState<number | null>(null);
  const [touchSelection, setTouchSelection] = useState(false);
  const gradient = useId().replace(/:/g, "");
  const maximum = Math.max(
    1,
    ...rows.flatMap((row) => [row.value, row.deposits]),
  );
  const x = (index: number) =>
    rows.length === 1
      ? (geometry.start + geometry.end) / 2
      : geometry.start +
        (index / (rows.length - 1)) * (geometry.end - geometry.start);
  const y = (value: number) =>
    geometry.bottom - (value / maximum) * (geometry.bottom - geometry.top);
  const points = rows
    .map((row, index) => `${x(index)},${y(row.value)}`)
    .join(" ");
  const deposits = rows
    .map((row, index) => `${x(index)},${y(row.deposits)}`)
    .join(" ");
  const selectedIndex = Math.max(
    0,
    Math.min(selected ?? rows.length - 1, rows.length - 1),
  );
  const selectedRow = rows[selectedIndex];
  const atPointer = (clientX: number, element: SVGSVGElement) =>
    setSelected(
      nearestChartIndex(
        clientX,
        element.getBoundingClientRect(),
        geometry,
        rows.length,
      ),
    );
  const ticks = (value: number) => {
    if (!geometry.compact) return compact(value);
    const amount = convert(value);
    return amount === null
      ? "—"
      : new Intl.NumberFormat("pt-BR", {
          notation: "compact",
          maximumFractionDigits: 0,
        }).format(amount);
  };
  return (
    <div className="projection-chart-wrap" ref={viewport.ref}>
      <div className="projection-chart-key">
        <span>
          <i />
          Patrimônio projetado
        </span>
        <span>
          <i className="deposits-key" />
          Inicial + aportes
        </span>
      </div>
      {!selectedRow ? (
        <p>Sem valores para projetar neste período.</p>
      ) : (
        <>
          <div className="projection-chart-scroll">
            <svg
              viewBox={`0 0 ${geometry.width} ${geometry.height}`}
              className="projection-chart"
              role="img"
              aria-label={`Projeção de patrimônio em ${currency}, comparada ao patrimônio inicial mais aportes. Toque ou use o controle de ano para explorar.`}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse" && !touchSelection)
                  setSelected(null);
              }}
              onPointerMove={(event) => {
                if (event.pointerType === "mouse" || event.buttons)
                  atPointer(event.clientX, event.currentTarget);
              }}
              onPointerDown={(event) => {
                setTouchSelection(event.pointerType !== "mouse");
                atPointer(event.clientX, event.currentTarget);
              }}
            >
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--chart-a)"
                    stopOpacity=".12"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--chart-a)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              <text x={geometry.compact ? 0 : geometry.start} y="24">
                Patrimônio · {currency}
              </text>
              {[0, 0.5, 1].map((fraction) => (
                <g key={fraction}>
                  <line
                    x1={geometry.start}
                    x2={geometry.end}
                    y1={y(maximum * fraction)}
                    y2={y(maximum * fraction)}
                    className="wealth-grid"
                  />
                  <text
                    x={geometry.start - 7}
                    y={y(maximum * fraction) + 4}
                    textAnchor="end"
                  >
                    {ticks(maximum * fraction)}
                  </text>
                </g>
              ))}
              <polygon
                points={`${x(0)},${geometry.bottom} ${points} ${x(rows.length - 1)},${geometry.bottom}`}
                fill={`url(#${gradient})`}
              />
              <polyline
                points={deposits}
                className="projection-deposits-line"
              />
              <polyline points={points} className="wealth-line" />
              {rows.map((row, index) => (
                <circle
                  key={row.year}
                  cx={x(index)}
                  cy={y(row.value)}
                  r={selected === index ? 4.5 : rows.length > 20 ? 1.8 : 3}
                  className="wealth-point"
                >
                  <title>{`Ano ${row.year}: ${formatMoney(row.value)}`}</title>
                </circle>
              ))}
              {selected !== null && (
                <line
                  x1={x(selectedIndex)}
                  x2={x(selectedIndex)}
                  y1={geometry.top}
                  y2={geometry.bottom}
                  className="comparison-crosshair"
                />
              )}
              {[
                ...new Set(
                  geometry.compact
                    ? [0, Math.floor((rows.length - 1) / 2), rows.length - 1]
                    : [
                        0,
                        Math.floor((rows.length - 1) / 3),
                        Math.floor(((rows.length - 1) * 2) / 3),
                        rows.length - 1,
                      ],
                ),
              ].map((index) => (
                <text
                  key={index}
                  x={x(index)}
                  y={geometry.bottom + 27}
                  textAnchor={
                    index === 0
                      ? "start"
                      : index === rows.length - 1
                        ? "end"
                        : "middle"
                  }
                >
                  {rows[index].year === 0 ? "Hoje" : rows[index].year + "a"}
                </text>
              ))}
            </svg>
          </div>
          <div className="projection-chart-detail" aria-live="polite">
            <span>
              {selectedRow.year === 0 ? "Hoje" : "Ano " + selectedRow.year}
            </span>
            <div>
              <span>Patrimônio projetado</span>
              <strong>{formatMoney(selectedRow.value)}</strong>
            </div>
            <div>
              <span>Inicial + aportes</span>
              <strong>{formatMoney(selectedRow.deposits)}</strong>
            </div>
          </div>
          <label className="projection-year-explorer">
            <span>
              Explorar ano <strong>{selectedRow.year}</strong>
            </span>
            <input
              type="range"
              aria-label="Explorar ano da projeção"
              min="0"
              max={Math.max(0, rows.length - 1)}
              step="1"
              value={selectedIndex}
              onChange={(event) => setSelected(Number(event.target.value))}
              aria-valuetext={`Ano ${selectedRow.year}: ${formatMoney(selectedRow.value)} de patrimônio; ${formatMoney(selectedRow.deposits)} de valor inicial e aportes.`}
            />
          </label>
        </>
      )}
    </div>
  );
}
