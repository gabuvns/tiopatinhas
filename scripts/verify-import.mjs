import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
process.on("uncaughtException", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

// Run with private JSON and independent source controls outside the repository.
const [file, controls] = process.argv.slice(2);
if (!file || !controls)
  throw new Error(
    "Usage: node scripts/verify-import.mjs backup.json source-controls.json",
  );
async function load(entry) {
  const result = await build({
    loader: { ".md": "text" },
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    banner: {
      js:
        'import {createRequire as testRequire} from "node:module"; const require = testRequire(' +
        JSON.stringify(import.meta.url) +
        ");",
    },
    plugins: [
      {
        name: "shared-react",
        setup(builder) {
          builder.onResolve({ filter: /^react(\/.*)?$/ }, (args) => {
            const resolved = createRequire(import.meta.url).resolve(args.path);
            return {
              path:
                args.kind === "require-call"
                  ? resolved
                  : pathToFileURL(resolved).href,
              external: true,
            };
          });
        },
      },
    ],
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].text).toString("base64")
  );
}
const { validateData } = await load("src/infrastructure/store.ts");
const { buildPortfolio, summarizeMonth, calculateRebalance, wealthHistory } =
  await load("src/domain/domain.ts");
const data = validateData(JSON.parse(await fs.readFile(file, "utf8")));
const expected = JSON.parse(await fs.readFile(controls, "utf8"));
const near = (actual, expected, label) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    label + ": " + actual + " != " + expected,
  );
const fx = data.events.find(
  (e) => e.type === "quote" && e.assetId === "FX:USD/BRL",
).price;
const portfolio = buildPortfolio(data.events, fx);
const history = wealthHistory(data.events);
const { default: WealthHistory } = await load(
  "src/features/history/WealthHistory.tsx",
);
const html = renderToStaticMarkup(
  createElement(WealthHistory, { events: data.events }),
);
assert.equal(
  (html.match(/<circle /g) || []).length,
  expected.wealthHistory.length,
  "Chart renders one point per source observation",
);
assert.ok(
  html.includes("Macro Alocação!AA35"),
  "History table retains the final source cell",
);
const finalReference = expected.wealthHistory[
  expected.wealthHistory.length - 1
].date
  .split("-")
  .reverse()
  .join("/");
assert.ok(
  html.includes(finalReference),
  "Final historical reference matches the source date",
);
assert.equal(history.length, expected.wealthHistory.length);
for (let index = 0; index < history.length; index++) {
  const actual = history[index],
    source = expected.wealthHistory[index];
  assert.equal(
    actual.date,
    source.date,
    "Historical dates come from Macro column L",
  );
  assert.equal(actual.provenance.sheet, "Macro Alocação");
  assert.equal(actual.provenance.range, source.range);
  near(
    actual.totalValue,
    source.totalValue,
    "Every historical total matches Macro column AA",
  );
}
assert.ok(
  history.some(
    (point, index) =>
      index > 0 && point.totalValue < history[index - 1].totalValue,
  ),
  "Preserve declines",
);
const correctedHistory = wealthHistory([
  ...data.events,
  {
    id: "void-first-history",
    type: "correction",
    date: "2026-11-03",
    createdAt: new Date().toISOString(),
    targetEventId: history[0].id,
    reason: "test",
  },
]);
assert.equal(
  correctedHistory.length,
  history.length - 1,
  "Historical corrections respected",
);
const revised = {
  ...history[0],
  id: "revised-history",
  createdAt: "2099-01-01T00:00:00Z",
  totalValue: 123,
};
const sameDay = wealthHistory([...data.events, revised]).filter(
  (point) => point.date === revised.date,
);
assert.equal(sameDay.length, 2, "Preserve each snapshot on the same day");
assert.equal(
  sameDay[sameDay.length - 1].totalValue,
  123,
  "Latest same-day snapshot is ordered last without summing",
);
assert.equal(
  wealthHistory([
    ...data.events,
    { ...revised, id: "future-history", date: "2099-01-01" },
  ]).length,
  history.length,
  "Future projections excluded",
);
near(
  portfolio.liquidValue,
  expected.liquidValue,
  "Liquid wealth reconciles to XLSX",
);
near(
  portfolio.illiquidValue,
  expected.illiquidValue,
  "Illiquid wealth reconciles to XLSX",
);
for (const [month, source] of Object.entries(expected.months)) {
  const result = summarizeMonth(data.events, month, fx);
  for (const metric of ["income", "expenses", "invested"])
    near(result[metric], source[metric], month + " " + metric);
  near(
    result.savingsRate,
    (source.income - source.expenses) / source.income,
    month + " savings",
  );
}
assert.equal(portfolio.positions.filter((p) => p.quantity > 0).length, 40);
assert.ok(
  portfolio.positions
    .filter((p) => p.quantity > 0)
    .every((p) => p.averageCost === null),
);
const withoutHistory = buildPortfolio(
  data.events.filter(
    (e) => !["investment_contribution", "wealth_snapshot"].includes(e.type),
  ),
  fx,
);
near(
  withoutHistory.totalValue,
  portfolio.totalValue,
  "Historical flows and wealth snapshots do not duplicate positions",
);
near(
  summarizeMonth(data.events, "2026-11", fx).invested,
  0,
  "Opening positions are not new contributions",
);
assert.deepEqual(
  data.events
    .filter((e) => e.type === "target")
    .map((e) => [e.ticker, e.targetPercent])
    .sort(),
  [
    ["B5P211", 20],
    ["BTC", 20],
    ["VWRA", 60],
  ],
);
assert.equal(portfolio.positions.find((p) => p.ticker === "VWRA").quantity, 0);
assert.equal(portfolio.positions.find((p) => p.ticker === "VWRA").price, 0);
assert.ok(
  calculateRebalance(portfolio.positions, fx).every(
    (action) => !action.assetId.startsWith("RF:"),
  ),
);
assert.equal(
  portfolio.positions.find((p) => p.ticker === "VWRA11").targetPercent,
  0,
);
assert.deepEqual(
  validateData(JSON.parse(JSON.stringify(data))),
  data,
  "JSON export/import preserves metadata",
);
assert.equal(
  validateData({ schemaVersion: 1, events: [], settings: data.settings })
    .schemaVersion,
  2,
  "v1 migration",
);
const opening = data.events.find(
  (e) => e.type === "opening_position" && e.ticker === "KLBN4",
);
const trade = (id, side, quantity, step) => ({
  id,
  type: "trade",
  date: opening.date,
  createdAt: new Date(
    Date.parse(opening.createdAt) + step * 1000,
  ).toISOString(),
  assetId: opening.assetId,
  ticker: opening.ticker,
  name: opening.name,
  geography: opening.geography,
  assetClass: opening.assetClass,
  currency: opening.currency,
  precision: opening.precision,
  side,
  quantity,
  unitPrice: 4,
});
const buy = trade("buy", "COMPRA", 10, 1);
assert.equal(
  buildPortfolio([opening, buy], fx).positions[0].averageCost,
  null,
  "Do not invent a cost basis after a new purchase",
);
const sold = trade("sell", "VENDA", opening.quantity, 1);
assert.equal(
  buildPortfolio([opening, sold, trade("reopen", "COMPRA", 10, 2)], fx)
    .positions[0].averageCost,
  4,
  "Cost basis becomes known after closing the unknown lot",
);
assert.throws(
  () =>
    validateData({
      ...data,
      events: [
        ...data.events,
        trade("oversell", "VENDA", opening.quantity + 1, 1),
      ],
    }),
  /posição suficiente/,
);
assert.throws(
  () => validateData({ ...data, events: [...data.events, data.events[0]] }),
  /duplicados/,
);
assert.throws(
  () => validateData({ ...data, events: [{ ...opening, date: "2026-02-30" }] }),
  /Data inválida/,
);
assert.throws(
  () => validateData({ ...data, events: [{ ...opening, quantity: -1 }] }),
  /Conteúdo inválido/,
);
assert.throws(
  () =>
    validateData({ ...data, events: [{ ...opening, averageCost: "unknown" }] }),
  /Conteúdo inválido/,
);
assert.throws(
  () =>
    validateData({
      ...data,
      events: [{ ...opening, type: "execute_instructions" }],
    }),
  /Conteúdo inválido/,
);
console.log(
  JSON.stringify(
    {
      status: "passed",
      events: data.events.length,
      monthsChecked: Object.keys(expected.months).length,
      wealthSnapshotsChecked: history.length,
      liquidValue: portfolio.liquidValue,
      illiquidValue: portfolio.illiquidValue,
      totalValue: portfolio.totalValue,
      unknownCostPositions: 40,
      reconciliations: data.importInfo.reconciliations.length,
    },
    null,
    2,
  ),
);
