import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { build } from "esbuild";
process.on("uncaughtException", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
const compiled = await build({
  stdin: {
    contents:
      "export * from './src/domain/history'; export * from './src/domain/pockets'; export {validateData} from './src/infrastructure/store';",
    resolveDir: process.cwd(),
  },
  loader: { ".md": "text" },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { historySeries, validatePocket, validateData } = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputFiles[0].text).toString("base64")
);
let id = 0;
const event = (data) => ({
  id: String(++id),
  createdAt: "2026-01-01T00:00:00Z",
  ...data,
});
const fx = event({
  type: "quote",
  assetId: "FX:USD/BRL",
  ticker: "USD/BRL",
  date: "2026-01-01",
  price: 5,
  currency: "BRL",
  source: "Teste",
  fetchedAt: "2026-01-01T00:00:00Z",
});
const contribution = event({
  type: "investment_contribution",
  date: "2026-01-15",
  amount: 25,
  liquidity: "liquid",
  category: "ETF",
});
const events = [
  fx,
  contribution,
  event({
    type: "illiquid_contribution",
    date: "2026-01-20",
    assetId: "pension",
    name: "Previdência",
    assetClass: "Previdência",
    amount: 75,
  }),
  event({
    type: "trade",
    side: "COMPRA",
    assetId: "ETF",
    ticker: "ETF",
    name: "ETF",
    geography: "Exterior",
    assetClass: "ETFs",
    currency: "USD",
    quantity: 2,
    unitPrice: 10,
    precision: 0,
    date: "2026-01-25",
    fxRate: 5,
  }),
  event({
    type: "income",
    date: "2026-02-01",
    category: "Salário",
    amount: 500,
  }),
  event({
    type: "quote",
    assetId: "FX:USD/BRL",
    ticker: "USD/BRL",
    date: "2026-03-01",
    price: 10,
    currency: "BRL",
    source: "Teste",
    fetchedAt: "2026-03-01T00:00:00Z",
  }),
  event({
    type: "wealth_snapshot",
    date: "2026-01-31",
    totalValue: 100,
    usdValue: 20,
    fxRate: 5,
    liquidValue: 70,
    illiquidValue: 30,
    byCategory: { ETFs: 70, Previdência: 30 },
  }),
];
assert.equal(
  historySeries(events, "contributions", "BRL", "", "", "2026-02-28")[0].value,
  200,
);
assert.equal(
  historySeries(events, "contributions", "USD", "", "", "2026-02-28")[0].value,
  40,
);
assert.equal(
  historySeries(events, "contributions", "BRL", "", "", "2026-02-28")[1].value,
  0,
);
assert.equal(
  historySeries(events, "ETFs", "USD", "", "", "2026-02-28")[0].value,
  14,
);
assert.equal(
  historySeries(events, "total", "USD", "", "", "2026-03-31")[0].value,
  20,
  "Later FX never changes historical USD",
);
assert.equal(
  historySeries([contribution], "contributions", "USD", "", "", "2026-02-28")[0]
    .value,
  null,
);
assert.deepEqual(
  historySeries(events, "total", "BRL", "2026-02-01", "2026-01-01"),
  [],
);
assert.equal(
  historySeries(
    [event({ type: "wealth_snapshot", date: "2026-01-01", totalValue: 100 })],
    "total",
    "USD",
    "",
    "",
    "2026-02-28",
  )[0].value,
  null,
);
const correction = event({
  type: "correction",
  date: "2026-02-15",
  targetEventId: contribution.id,
  reason: "Teste",
});
assert.equal(
  historySeries(
    [...events, correction],
    "contributions",
    "BRL",
    "",
    "",
    "2026-01-31",
  )[0].value,
  200,
  "Future corrections do not alter an earlier reporting date",
);
assert.equal(
  historySeries(
    [...events, correction],
    "contributions",
    "BRL",
    "",
    "",
    "2026-02-28",
  )[0].value,
  175,
);
assert.throws(
  () =>
    validatePocket(
      {
        id: "p",
        name: "Férias",
        target: 100,
        allocations: [{ assetId: "A", amount: 101 }],
      },
      [],
      [{ assetId: "A", value: 500 }],
    ),
  /meta/,
);
for (const theme of ["dark", "light", "system"])
  assert.equal(
    validateData({
      schemaVersion: 2,
      events: [],
      settings: { currency: "BRL", milestones: [], theme },
    }).settings.theme,
    theme,
  );
assert.throws(() =>
  validateData({
    schemaVersion: 2,
    events: [],
    settings: { currency: "BRL", milestones: [], theme: "invalid" },
  }),
);
const css = await fs.readFile("src/styles/accessibility.css", "utf8");
const luminance = (hex) => {
  const rgb = hex
    .match(/[a-f0-9]{2}/gi)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
};
for (const block of [
  css.slice(0, css.indexOf(':root[data-theme="dark"]')),
  css.slice(
    css.indexOf(':root[data-theme="dark"]'),
    css.indexOf(':root[data-theme="light"]'),
  ),
]) {
  const colors = Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*(#[a-f0-9]{6})/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  for (const foreground of ["text", "secondary", "accent"])
    for (const background of ["page", "panel", "subtle"])
      assert.ok(
        contrast(colors[foreground], colors[background]) >= 4.5,
        foreground + " on " + background + " must meet WCAG AA",
      );
  assert.ok(contrast(colors["on-action"], colors.action) >= 4.5);
  assert.ok(contrast(colors.edge, colors.panel) >= 3);
  assert.ok(contrast(colors.focus, colors.panel) >= 3);
}
console.log(
  "Experience checks passed: historical categories, monthly contributions, missing FX, periods, corrections, pocket caps, theme persistence and WCAG token contrast.",
);
