import type { ChartPoint } from "./history";

export interface ComparisonSeries {
  id: string;
  label: string;
  points: ChartPoint[];
  colorIndex: number;
}
export interface ComparisonMonth {
  month: string;
  label: string;
  values: Record<string, number | null>;
  details: Record<string, string | undefined>;
}

/** One observation per month: last snapshot, or the already consolidated contribution total.
 * Missing months are gaps, never zeroes or estimates from future observations. */
export function comparisonMonths(
  series: ComparisonSeries[],
): ComparisonMonth[] {
  const monthly = series.map((item) => {
    const points = new Map<string, ChartPoint>();
    for (const point of [...item.points].sort((a, b) =>
      a.date.localeCompare(b.date),
    ))
      points.set(point.date.slice(0, 7), point);
    return { id: item.id, points };
  });
  const months = [
    ...new Set(monthly.flatMap((item) => [...item.points.keys()])),
  ].sort();
  if (!months.length) return [];
  const first = months[0].split("-").map(Number),
    last = months[months.length - 1];
  const rows: ComparisonMonth[] = [];
  let year = first[0],
    month = first[1];
  while (true) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > last) break;
    const values: ComparisonMonth["values"] = {},
      details: ComparisonMonth["details"] = {};
    for (const item of monthly) {
      const point = item.points.get(key);
      values[item.id] = point?.value ?? null;
      details[item.id] = point?.detail;
    }
    rows.push({
      month: key,
      label: `${String(month).padStart(2, "0")}/${year}`,
      values,
      details,
    });
    month++;
    if (month > 12) {
      year++;
      month = 1;
    }
  }
  return rows;
}

/** Each line starts at 0% on its first positive observation; earlier/missing data remain gaps. */
export function indexedMonths(
  rows: ComparisonMonth[],
  ids: string[],
): ComparisonMonth[] {
  const bases = new Map(
    ids.map((id) => [
      id,
      rows.findIndex((row) => row.values[id] !== null && row.values[id] > 0),
    ]),
  );
  return rows.map((row, index) => ({
    ...row,
    values: Object.fromEntries(
      ids.map((id) => {
        const start = bases.get(id) ?? -1,
          value = row.values[id];
        return [
          id,
          start < 0 || index < start || value === null
            ? null
            : (value / rows[start].values[id]! - 1) * 100,
        ];
      }),
    ),
  }));
}

export function searchableLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}
