import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { build } from "esbuild";
if (!globalThis.crypto)
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
const bundle = await build({
  stdin: {
    contents:
      "export * from './src/infrastructure/store'; export * from './src/domain/domain'; export * from './src/domain/money'; export * from './src/domain/pockets'; export * from './src/features/demo/demo';",
    resolveDir: process.cwd(),
  },
  loader: { ".md": "text" },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const {
  demoData,
  validateData,
  createExportSnapshot,
  buildPortfolio,
  exchangeRates,
  planContribution,
  saveData,
  loadData,
  setStorageScope,
  pocketBalances,
  availableForPocket,
  validatePocket,
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
const data = validateData(demoData());
assert.ok(data.events.some((e) => e.memo?.includes("fictícios")));
assert.ok(data.events.filter((e) => e.type === "wealth_snapshot").length >= 24);
const fx = exchangeRates(data.events).USD;
const portfolio = buildPortfolio(data.events, fx);
assert.ok(
  portfolio.totalValue > 5000000,
  "Demo illustrates a substantial household portfolio",
);
assert.equal(portfolio.positions.length, 22);
assert.equal(portfolio.illiquidAssets.length, 9);
assert.equal(new Set(portfolio.positions.map((p) => p.assetClass)).size, 9);
assert.equal(new Set(portfolio.positions.map((p) => p.geography)).size, 3);
assert.equal(portfolio.positions.filter((p) => p.isEmergencyReserve).length, 1);
assert.equal(
  data.events.filter((e) => e.type === "trade" && e.side === "COMPRA").length,
  180,
);
assert.equal(
  data.events.filter((e) => e.type === "trade" && e.side === "VENDA").length,
  24,
);
assert.equal(
  new Set(
    data.events
      .filter((e) => e.type === "expense" && e.category === "Cartão")
      .map((e) => e.cardName),
  ).size,
  2,
);
assert.equal(
  new Set(data.events.filter((e) => e.type === "income").map((e) => e.category))
    .size,
  3,
);
assert.equal(data.events.filter((e) => e.type === "salary_change").length, 3);
assert.equal(
  data.events.filter((e) => e.type === "investment_contribution").length,
  0,
  "Do not duplicate purchases as aggregate contributions",
);
assert.ok(
  Math.abs(
    portfolio.positions.reduce((sum, p) => sum + p.targetPercent, 0) - 100,
  ) < 1e-8,
);
for (const pocket of data.settings.pockets)
  validatePocket(pocket, data.settings.pockets, portfolio.positions);
assert.ok(
  pocketBalances(data.settings.pockets, portfolio.positions).every(
    (p) => p.shortfall === 0,
  ),
);
const monthlySnapshots = data.events.filter(
  (e) => e.type === "wealth_snapshot",
);
assert.equal(monthlySnapshots.length, 36);
for (const snapshot of monthlySnapshots) {
  const atDate = buildPortfolio(
    data.events.filter((e) => e.date <= snapshot.date),
    snapshot.fxRate,
  );
  assert.ok(
    Math.abs(atDate.totalValue - snapshot.totalValue) < 0.005,
    "Historical snapshot reconciles to historical positions",
  );
  assert.ok(
    Math.abs(
      snapshot.liquidValue + snapshot.illiquidValue - snapshot.totalValue,
    ) < 0.005,
  );
  assert.ok(snapshot.liquidValue > 0 && snapshot.illiquidValue > 0);
  for (const code of ["BRL", "USD", "EUR", "GBP", "CHF"])
    assert.ok(
      Math.abs(
        snapshot.currencyValues[code] * snapshot.currencyRates[code] -
          snapshot.totalValue,
      ) < 0.005,
    );
}
for (const asOf of ["2026-01-01", "2024-02-29"]) {
  const boundary = validateData(demoData(asOf));
  assert.ok(
    boundary.events.every((e) => e.date <= asOf),
    "No future demo transactions, including on the first day of a month",
  );
  assert.equal(
    boundary.events.filter((e) => e.type === "wealth_snapshot").length,
    36,
  );
}
for (const budget of [0, 1, 1000, 10000]) {
  const actions = planContribution(portfolio.positions, budget, fx);
  assert.ok(actions.every((a) => a.side === "COMPRAR"));
  assert.ok(actions.reduce((sum, a) => sum + a.amount, 0) <= budget + 1e-8);
  assert.ok(
    actions.every(
      (a) =>
        !portfolio.positions.find((p) => p.assetId === a.assetId)
          .isEmergencyReserve,
    ),
  );
}
const original = JSON.stringify(data.events);
const exported = createExportSnapshot({
  ...data,
  settings: { currency: "BRL", milestones: [] },
});
assert.ok(
  exported.settings.pockets.some((p) => p.name === "Banco do Tio Patinhas"),
);
assert.ok(exported.documentation.architecture.includes("arquitetura"));
const snapshot = exported.events.at(-1);
assert.ok(snapshot.fxRate > 0);
assert.equal(snapshot.usdValue, snapshot.totalValue / snapshot.fxRate);
assert.equal(JSON.stringify(data.events), original);
assert.ok(
  Math.abs(
    Object.values(snapshot.byCategory).reduce((a, b) => a + b, 0) -
      snapshot.totalValue,
  ) < 0.005,
);
const changed = createExportSnapshot({
  ...exported,
  events: [
    ...exported.events,
    {
      id: "new-fx",
      date: snapshot.date,
      createdAt: new Date(Date.now() + 1000).toISOString(),
      type: "quote",
      assetId: "FX:USD/BRL",
      ticker: "USD/BRL",
      currency: "BRL",
      price: 10,
      fetchedAt: new Date().toISOString(),
      source: "Teste",
    },
  ],
});
assert.equal(
  changed.events.find((e) => e.id === snapshot.id).usdValue,
  snapshot.usdValue,
);
assert.equal(changed.events.at(-1).fxRate, 10);
assert.throws(() =>
  validateData({
    ...data,
    settings: {
      ...data.settings,
      pockets: [{ id: "bad", name: "Inválido", target: -1, allocations: [] }],
    },
  }),
);
const memory = new Map();
globalThis.indexedDB = {
  open() {
    throw new Error("Unavailable");
  },
};
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};
await saveData(data);
setStorageScope(true);
await saveData(exported);
assert.deepEqual(
  (await loadData()).settings.pockets,
  exported.settings.pockets,
);
setStorageScope(false);
assert.deepEqual((await loadData()).events, data.events);
assert.deepEqual(validateData(JSON.parse(JSON.stringify(exported))), exported);
const pockets = [
  {
    id: "one",
    name: "One",
    target: 1,
    allocations: [{ assetId: "CASH", amount: 0.1 }],
  },
  {
    id: "two",
    name: "Two",
    target: 1,
    allocations: [{ assetId: "CASH", amount: 0.2 }],
  },
];
const assets = [{ assetId: "CASH", value: 1 }];
const near = (a, b) =>
  assert.ok(Math.abs(a - b) < 1e-8, a + " differs from " + b);
near(pocketBalances(pockets, assets)[0].total, 0.1);
near(pocketBalances(pockets, assets)[1].total, 0.2);
const reduced = pocketBalances(pockets, [{ assetId: "CASH", value: 0.15 }]);
near(reduced[0].total, 0.05);
near(reduced[1].total, 0.1);
near(
  reduced.reduce((sum, p) => sum + p.total, 0),
  0.15,
);
assert.ok(reduced.every((p) => p.shortfall > 0));
assert.equal(pocketBalances(pockets, [])[0].total, 0);
assert.equal(
  pocketBalances(pockets, [
    { assetId: "CASH", value: 1, isEmergencyReserve: true },
  ])[0].total,
  0,
);
near(availableForPocket(assets[0], pockets, "one"), 0.8);
assert.throws(() =>
  validatePocket(
    { ...pockets[0], allocations: [{ assetId: "CASH", amount: 1 }] },
    pockets,
    assets,
  ),
);
assert.throws(() =>
  validatePocket(
    { ...pockets[0], allocations: [{ assetId: "CASH", amount: NaN }] },
    pockets,
    assets,
  ),
);
assert.throws(() =>
  validatePocket(pockets[0], pockets, [
    { ...assets[0], isEmergencyReserve: true },
  ]),
);
const sample = portfolio.positions[0];
const mix = [
  {
    ...sample,
    assetId: "A",
    ticker: "A",
    currency: "BRL",
    price: 60,
    value: 0,
    targetPercent: 50,
    precision: 0,
    isEmergencyReserve: false,
    rebalanceEligible: true,
  },
  {
    ...sample,
    assetId: "B",
    ticker: "B",
    currency: "BRL",
    price: 30,
    value: 0,
    targetPercent: 50,
    precision: 0,
    isEmergencyReserve: false,
    rebalanceEligible: true,
  },
  {
    ...sample,
    assetId: "C",
    ticker: "C",
    currency: "BRL",
    price: 10,
    value: 150,
    targetPercent: 0,
    precision: 0,
    isEmergencyReserve: false,
    rebalanceEligible: true,
  },
];
const rounded = planContribution(mix, 100, 5);
assert.equal(
  rounded.reduce((sum, a) => sum + a.amount, 0),
  90,
  "Redistribute rounding leftovers below targets",
);
assert.ok(rounded.every((a) => a.side === "COMPRAR"));
assert.deepEqual(planContribution(mix, Infinity, 5), []);
console.log(
  "Platform checks passed: isolated demo, frozen USD, pockets, price falls, allocation limits and purchase-only rounding.",
);
