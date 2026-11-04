import assert from "node:assert/strict";
import { build } from "esbuild";
process.on("uncaughtException", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
const compiled = await build({
  stdin: {
    contents:
      "export * from './src/domain/monthlyGoal'; export {validateData,createExportSnapshot,saveData,loadData} from './src/infrastructure/store';",
    resolveDir: process.cwd(),
  },
  loader: { ".md": "text" },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const {
  resolveMonthlyGoal,
  monthlyInvestmentProgress,
  validateData,
  createExportSnapshot,
  saveData,
  loadData,
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputFiles[0].text).toString("base64")
);
const data = {
  schemaVersion: 2,
  updatedAt: "2026-01-01T00:00:00Z",
  settings: { currency: "BRL", milestones: [] },
  events: [],
};
assert.equal(resolveMonthlyGoal(data.settings, "2026-01").percent, 20);
const settings = {
  ...data.settings,
  savingsGoalPercent: 35,
  monthlySavingsGoals: { "2026-01": 0, "2026-02": 100, "2026-03": 42.5 },
};
assert.deepEqual(resolveMonthlyGoal(settings, "2026-01"), {
  percent: 0,
  defaultPercent: 35,
  hasOverride: true,
});
assert.equal(resolveMonthlyGoal(settings, "2026-02").percent, 100);
assert.equal(resolveMonthlyGoal(settings, "2026-03").percent, 42.5);
assert.equal(resolveMonthlyGoal(settings, "2026-04").percent, 35);
assert.deepEqual(monthlyInvestmentProgress(10000, 2000, 35), {
  targetAmount: 3500,
  progress: (2000 / 3500) * 100,
  remaining: 1500,
});
assert.equal(monthlyInvestmentProgress(10000, 5000, 35).progress, 100);
assert.equal(monthlyInvestmentProgress(0, 1000, 35).progress, 0);
assert.equal(monthlyInvestmentProgress(10000, 1000, 0).targetAmount, 0);
assert.equal(monthlyInvestmentProgress(10000, -1000, 20).progress, 0);
assert.deepEqual(
  validateData(JSON.parse(JSON.stringify({ ...data, settings }))).settings,
  settings,
);
for (const invalid of [-1, 100.1, NaN, Infinity, null, "25"])
  assert.throws(() =>
    validateData({
      ...data,
      settings: { ...data.settings, savingsGoalPercent: invalid },
    }),
  );
for (const monthlySavingsGoals of [
  null,
  [],
  { "2026-00": 20 },
  { "2026-13": 20 },
  { "0000-01": 20 },
  { "2026-1": 20 },
  { "2026-01-01": 20 },
  { "2026-02": -1 },
  { "2026-02": 101 },
  { "2026-02": "20" },
  { "2026-02": Infinity },
])
  assert.throws(() =>
    validateData({
      ...data,
      settings: { ...data.settings, monthlySavingsGoals },
    }),
  );
assert.equal(
  validateData({ ...data, schemaVersion: 1 }).settings.savingsGoalPercent,
  undefined,
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
await saveData({ ...data, settings });
assert.deepEqual((await loadData()).settings, settings);
if (!globalThis.crypto)
  Object.defineProperty(globalThis, "crypto", {
    value: (await import("node:crypto")).webcrypto,
  });
assert.deepEqual(
  createExportSnapshot({ ...data, settings }).settings.monthlySavingsGoals,
  settings.monthlySavingsGoals,
);
assert.equal(
  resolveMonthlyGoal(
    validateData(JSON.parse(JSON.stringify({ ...data, settings }))).settings,
    "2026-01",
  ).percent,
  0,
);
console.log(
  "Monthly goal checks passed: default, per-month overrides, zero and 100%, progress, legacy backups, validation, persistence and snapshot round-trip.",
);
