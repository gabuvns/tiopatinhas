import assert from "node:assert/strict";
import { build } from "esbuild";

const built = await build({
  stdin: {
    contents:
      "export * from './src/domain/comparison'; export * from './src/domain/history';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { comparisonMonths, indexedMonths, searchableLabel, historySeries } =
  await import(
    "data:text/javascript;base64," +
      Buffer.from(built.outputFiles[0].text).toString("base64")
  );
const point = (id, date, value) => ({ id, date, value, label: date });
const input = [
  {
    id: "total",
    label: "Patrimônio",
    colorIndex: 0,
    points: [
      point("one", "2026-01-10", 1000),
      point("two", "2026-01-31", 1200),
      point("march", "2026-03-31", null),
      point("april", "2026-04-15", 900),
    ],
  },
  {
    id: "contributions",
    label: "Aportes",
    colorIndex: 3,
    points: [
      point("jan", "2026-01-01", 100),
      point("march", "2026-03-01", 0),
      point("april", "2026-04-01", 200),
    ],
  },
  {
    id: "FGTS",
    label: "FGTS",
    colorIndex: 8,
    points: [
      point("march-fgts", "2026-03-15", 400),
      point("april-fgts", "2026-04-15", 500),
    ],
  },
];
const original = JSON.stringify(input);
const rows = comparisonMonths(input);
assert.deepEqual(
  rows.map((row) => row.month),
  ["2026-01", "2026-02", "2026-03", "2026-04"],
);
assert.equal(
  rows[0].values.total,
  1200,
  "Take last snapshot in each month, not sum or first",
);
assert.equal(
  rows[0].values.contributions,
  100,
  "Align month-start contribution to month-end snapshot",
);
assert.deepEqual(
  rows[1].values,
  { total: null, contributions: null, FGTS: null },
  "Missing month never turns into zero or a carried value",
);
assert.equal(
  rows[2].values.total,
  null,
  "Latest unknown snapshot stays unknown",
);
assert.equal(
  rows[2].values.contributions,
  0,
  "A known zero contribution remains a real point",
);
assert.equal(
  rows[0].values.FGTS,
  null,
  "Never fill prior categories from future observations",
);
const indexed = indexedMonths(
  rows,
  input.map((item) => item.id),
);
assert.equal(indexed[0].values.total, 0);
assert.equal(indexed[1].values.total, null);
assert.equal(indexed[3].values.total, -25);
assert.equal(
  indexed[2].values.FGTS,
  0,
  "Each series starts with its own first positive observation",
);
assert.equal(indexed[3].values.FGTS, 25);
assert.equal(
  indexed[2].values.contributions,
  -100,
  "Zero after a known positive base is a genuine -100% change",
);
assert.equal(indexed[3].values.contributions, 100);
assert.equal(
  indexedMonths(
    [{ month: "2026-01", label: "01/2026", values: { zero: 0 }, details: {} }],
    ["zero"],
  )[0].values.zero,
  null,
  "An all-zero series cannot be indexed",
);
assert.equal(
  JSON.stringify(input),
  original,
  "Comparisons preserve source history",
);
assert.deepEqual(comparisonMonths([]), []);
assert.equal(searchableLabel("Ações"), "acoes");
assert.ok(
  searchableLabel("Patrimônio ilíquido").includes(
    searchableLabel("PATRIMONIO"),
  ),
);

const snapshot = (id, date, total, rate) => ({
  id,
  date,
  createdAt: date + "T12:00:00Z",
  type: "wealth_snapshot",
  totalValue: total,
  fxRate: rate,
  usdValue: total / rate,
  byCategory: { FGTS: total / 2 },
});
const legacy = [
  snapshot("jan", "2026-01-15", 1000, 5),
  snapshot("jan-latest", "2026-01-31", 1200, 6),
  snapshot("feb", "2026-02-28", 1300, 6.5),
];
const usd = comparisonMonths([
  {
    id: "total",
    label: "Total",
    colorIndex: 0,
    points: historySeries(legacy, "total", "USD", "", "", "2026-03-01"),
  },
]);
assert.deepEqual(
  usd.map((row) => row.values.total),
  [200, 200],
  "Use each snapshot's frozen USD, including latest monthly snapshot",
);
const eur = comparisonMonths([
  {
    id: "FGTS",
    label: "FGTS",
    colorIndex: 0,
    points: historySeries(legacy, "FGTS", "EUR", "", "", "2026-03-01"),
  },
]);
assert.ok(
  eur.every((row) => row.values.FGTS === null),
  "Legacy missing exchange rates are not fabricated",
);
console.log(
  "Comparison checks passed: latest monthly observations, date alignment, gaps, zeroes, frozen currencies, indexed changes and accent-insensitive search.",
);
