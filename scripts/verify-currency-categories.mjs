import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
process.on('uncaughtException', (error) => { console.error(error.message); process.exitCode = 1; });
const compiled = await build({
  stdin: { contents: [
    "export * from './src/money';", "export * from './src/portfolioGroups';",
    "export * from './src/DisplayCurrency';", "export * from './src/PortfolioAssets';",
    "export {validateData,createExportSnapshot,saveData,loadData} from './src/store';",
  ].join('\n'), resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'esm',
  banner: { js: 'import {createRequire as testRequire} from "node:module"; const require = testRequire(' + JSON.stringify(import.meta.url) + ');' },
  plugins: [{ name: 'shared-react', setup(builder) {
    builder.onResolve({ filter: /^react(\/.*)?$/ }, (args) => {
      const resolved = require.resolve(args.path);
      return { path: args.kind === 'require-call' ? resolved : pathToFileURL(resolved).href, external: true };
    });
  } }],
});
const { convertCurrency, moneyDisplay, groupAssets, DisplayCurrencyContext, LiquidAssetGroups, validateData, createExportSnapshot, saveData, loadData } =
  await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
assert.equal(convertCurrency(100, 'BRL', 'USD', 5), 20);
assert.equal(convertCurrency(20, 'USD', 'BRL', 5), 100);
assert.equal(convertCurrency(20, 'USD', 'USD', 0), 20);
assert.equal(convertCurrency(-100, 'BRL', 'USD', 5), -20);
assert.equal(convertCurrency(0, 'BRL', 'USD', 5), 0);
for (const rate of [0, -1, NaN, Infinity]) assert.equal(convertCurrency(100, 'BRL', 'USD', rate), null);
assert.equal(moneyDisplay('USD', 0).formatMoney(100), 'Sem câmbio');
assert.equal(moneyDisplay('USD', 5).number(1234.5), '246,90');
assert.equal(moneyDisplay('USD', 5).formatMoney(100, 'USD'), new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(100));
const positions = [
  { assetId: 'STOCK1', ticker: 'STOCK1', name: 'Ação 1', geography: 'Brasil', assetClass: 'Ações', currency: 'BRL', quantity: 10, price: 20, averageCost: 15, value: 200, priceSource: 'Manual', priceDate: '2020-01-01', targetPercent: 20, precision: 0 },
  { assetId: 'STOCK2', ticker: 'STOCK2', name: 'Ação 2', geography: 'Brasil', assetClass: 'Ações', currency: 'BRL', quantity: 10, price: 30, averageCost: null, value: 300, priceSource: 'Manual', priceDate: '2020-01-01', targetPercent: 30, precision: 0 },
  { assetId: 'ETF', ticker: 'ETF', name: 'Fundo global', geography: 'Exterior', assetClass: 'ETFs', currency: 'USD', quantity: 10, price: 10, averageCost: 8, value: 500, priceSource: 'Manual', priceDate: '2020-01-01', targetPercent: 50, precision: 0 },
];
const original = JSON.stringify(positions);
const groups = groupAssets(positions, 1250);
assert.equal(groups.length, 2);
assert.equal(groups[0].category, 'Ações');
assert.equal(groups[0].assets.length, 2);
assert.equal(groups[0].total, 500);
assert.equal(groups[0].percent, 40, 'Group shares use total wealth including illiquid assets');
assert.equal(groups.reduce((sum, group) => sum + group.total, 0), 1000);
assert.deepEqual(groupAssets([], 0), []);
assert.equal(groupAssets([{ assetClass: 'Bitcoin', value: 0 }], 0)[0].percent, 0);
for (const currency of ['BRL', 'USD']) {
  const display = moneyDisplay(currency, 5);
  const html = renderToStaticMarkup(createElement(DisplayCurrencyContext.Provider, { value: display },
    createElement(LiquidAssetGroups, { positions, portfolioTotal: 1250, onTarget() {}, onAdd() {}, onQuote() {} })));
  assert.equal((html.match(/<details /g) ?? []).length, 2);
  assert.ok(html.includes('VALOR EM ' + currency));
  assert.ok(html.includes('Não informado'));
  assert.ok(html.includes(display.formatMoney(500)), 'Category subtotal converts with display currency');
  assert.ok(html.includes(display.formatMoney(10, 'USD')), 'Native USD prices are converted once');
}
assert.equal(JSON.stringify(positions), original, 'Display and grouping do not mutate positions');
const data = { schemaVersion: 2, updatedAt: '2020-01-01T00:00:00Z', settings: { currency: 'BRL', milestones: [50000], displayCurrency: 'USD' }, events: [] };
assert.equal(validateData(JSON.parse(JSON.stringify(data))).settings.displayCurrency, 'USD');
assert.equal(validateData({ ...data, settings: { currency: 'BRL', milestones: [] } }).settings.displayCurrency, undefined, 'Older backups retain their default BRL view');
assert.throws(() => validateData({ ...data, settings: { ...data.settings, displayCurrency: 'EUR' } }));
const memory = new Map();
globalThis.indexedDB = { open() { throw new Error('unavailable'); } };
globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
await saveData(data);
assert.equal((await loadData()).settings.displayCurrency, 'USD');
globalThis.crypto = (await import('node:crypto')).webcrypto;
const exported = createExportSnapshot(data);
assert.equal(exported.settings.currency, 'BRL');
assert.equal(exported.settings.displayCurrency, 'USD');
assert.equal(exported.events[0].totalValue, 0);
console.log('Currency/category checks passed: conversions, missing FX, native prices, category totals, rendering, preference persistence and backup compatibility.');
