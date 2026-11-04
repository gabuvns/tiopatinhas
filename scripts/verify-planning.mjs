import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { build } from "esbuild";
if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });
async function load(entry) {
  const result = await build({
    loader: { ".md": "text" },
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].text).toString("base64")
  );
}
const { savingsBaseline, validateMilestones } = await load(
  "src/domain/planning.ts",
);
const { buildPortfolio, calculateRebalance, projectWealth, today } = await load(
  "src/domain/domain.ts",
);
const { validateData, saveData, loadData } = await load(
  "src/infrastructure/store.ts",
);
let id = 0;
const event = (fields) => ({
  id: "test-" + ++id,
  createdAt: "2020-01-01T00:00:00Z",
  ...fields,
});
const events = [];
for (let index = 0; index < 13; index++) {
  const date = new Date(Date.UTC(2024, index, 1)).toISOString().slice(0, 10);
  events.push(
    event({
      type: "income",
      date,
      category: "Salário",
      amount: 1000 + index * 100,
    }),
  );
  events.push(
    event({ type: "expense", date, category: "Cartão", amount: 400 }),
  );
}
events.push(
  event({
    type: "income",
    date: "2027-01-01",
    category: "Renda extra",
    amount: 999999,
  }),
);
events.push(
  event({ type: "salary_change", date: "2025-01-01", monthlyAmount: 99999 }),
);
events.push(
  event({
    type: "investment_contribution",
    date: "2025-01-01",
    amount: 500,
    liquidity: "liquid",
    category: "Teste",
  }),
);
const baseline = savingsBaseline(events, "2025-01-31");
assert.equal(baseline.months.length, 12);
assert.equal(baseline.months[0], "2024-02");
assert.equal(baseline.months[11], "2025-01");
assert.equal(baseline.averageIncome, 1650);
assert.equal(baseline.averageExpenses, 400);
assert.equal(
  baseline.monthlyContribution,
  1250,
  "Savings are not reduced by investment contributions or inflated by salary settings",
);
assert.equal(baseline.savingsRate, 15000 / 19800);
const short = savingsBaseline(
  [
    event({
      type: "income",
      date: "2024-01-01",
      category: "Salário",
      amount: 1000,
    }),
    event({
      type: "expense",
      date: "2024-03-01",
      category: "PIX",
      amount: 200,
    }),
  ],
  "2024-03-31",
);
assert.equal(
  short.months.length,
  2,
  "Use only available months, including expense-only months",
);
assert.equal(short.monthlyContribution, 400);
assert.equal(savingsBaseline([], "2024-03-31").monthlyContribution, 0);
const deficit = savingsBaseline(
  [
    event({
      type: "expense",
      date: "2024-01-01",
      category: "PIX",
      amount: 200,
    }),
  ],
  "2024-03-31",
);
assert.equal(deficit.averageSurplus, -200);
assert.equal(deficit.monthlyContribution, 0);
assert.equal(projectWealth(1000, 100, 0, 120), 13000);
const annual = projectWealth(1000, 0, 7, 120);
assert.ok(
  Math.abs(annual - 1000 * 1.07 ** 10) < 0.0001,
  "Annual return uses monthly equivalent",
);

const position = (ticker) =>
  event({
    type: "opening_position",
    date: "2020-01-01",
    assetId: ticker,
    ticker,
    name: ticker,
    geography: "Brasil",
    assetClass: "Renda fixa",
    currency: "BRL",
    quantity: 10,
    marketPrice: 10,
    averageCost: null,
    precision: 0,
  });
const positions = [position("RESERVE"), position("RISK")];
positions.push(
  event({
    type: "target",
    date: "2020-01-01",
    assetId: "RISK",
    ticker: "RISK",
    targetPercent: 100,
  }),
);
positions.push(
  event({
    type: "reserve_classification",
    date: "2020-02-01",
    assetId: "RESERVE",
    isEmergencyReserve: true,
  }),
);
const portfolio = buildPortfolio(positions);
assert.equal(
  portfolio.totalValue,
  200,
  "Classifying reserve preserves total wealth",
);
assert.equal(
  portfolio.positions.find((p) => p.assetId === "RESERVE").isEmergencyReserve,
  true,
);
assert.deepEqual(
  calculateRebalance(portfolio.positions),
  [],
  "Reserve is neither sold nor included in the target base",
);
const unmark = event({
  type: "reserve_classification",
  date: "2020-03-01",
  assetId: "RESERVE",
  isEmergencyReserve: false,
});
assert.equal(
  buildPortfolio([unmark, ...positions]).positions.find(
    (p) => p.assetId === "RESERVE",
  ).isEmergencyReserve,
  false,
  "Classification follows chronological history",
);
const correction = event({
  type: "correction",
  date: today(),
  targetEventId: unmark.id,
  reason: "Teste",
});
assert.equal(
  buildPortfolio([...positions, unmark, correction]).positions.find(
    (p) => p.assetId === "RESERVE",
  ).isEmergencyReserve,
  true,
  "Reversing classification restores the prior selection",
);
const income = events[2];
const corrected = savingsBaseline(
  [
    income,
    event({
      type: "correction",
      date: "2024-02-02",
      targetEventId: income.id,
      reason: "",
    }),
  ],
  "2024-02-28",
);
assert.equal(corrected.months.length, 0);
assert.deepEqual(
  validateMilestones([300000, 50000, 150000]),
  [50000, 150000, 300000],
);
assert.deepEqual(validateMilestones([]), []);
assert.throws(() => validateMilestones([50000, 50000]));
assert.throws(() => validateMilestones([0]));
assert.throws(() => validateMilestones([NaN]));
const data = validateData({
  schemaVersion: 2,
  updatedAt: new Date().toISOString(),
  events: positions,
  settings: { currency: "BRL", milestones: [150000, 500000] },
});
assert.throws(() =>
  validateData({
    ...data,
    events: [...positions, { ...unmark, isEmergencyReserve: "yes" }],
  }),
);
const memory = new Map();
globalThis.indexedDB = {
  open() {
    throw new Error("unavailable");
  },
};
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};
await saveData(data);
assert.deepEqual((await loadData()).settings, data.settings);
assert.deepEqual((await loadData()).events, data.events);
assert.deepEqual(
  validateData(JSON.parse(JSON.stringify(data))),
  data,
  "Goals and reserve history survive JSON round-trip",
);
console.log(
  "Planning checks passed: 12-month average, partial history, corrections, projection, reserve exclusion, goals and persistence.",
);
