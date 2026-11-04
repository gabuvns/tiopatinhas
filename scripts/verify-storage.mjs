import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({
  loader: { ".md": "text" },
  entryPoints: ["src/infrastructure/store.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { saveData, loadData, restoreBackup, emptyData } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
const memory = new Map();
globalThis.indexedDB = {
  open() {
    throw new Error("IndexedDB unavailable");
  },
};
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};
const makeData = (id, amount) => ({
  ...emptyData(),
  events: [
    {
      id,
      type: "income",
      category: "Salário",
      amount,
      date: "2026-10-31",
      createdAt: "2026-11-03T10:00:00Z",
    },
  ],
});
const old = makeData("old", 100),
  imported = makeData("imported", 500);
await Promise.all([saveData(old), saveData(imported)]);
assert.deepEqual(
  (await loadData()).events,
  imported.events,
  "Queued saves preserve newest state",
);
const restored = await restoreBackup(imported);
assert.deepEqual(
  restored.events,
  imported.events,
  "Restore verifies persisted records",
);
globalThis.localStorage.setItem = () => {
  throw new Error("Storage full");
};
await assert.rejects(
  restoreBackup(old),
  /Storage full/,
  "Do not acknowledge failed writes",
);
globalThis.localStorage.setItem = (key, value) => memory.set(key, value);
await saveData(imported);
assert.deepEqual(
  (await loadData()).events,
  imported.events,
  "A failed save does not block recovery",
);
globalThis.localStorage.setItem = () => {};
await assert.rejects(
  restoreBackup(old),
  /gravação não foi confirmada/,
  "Detect silently ignored writes",
);
globalThis.localStorage.setItem = (key, value) => memory.set(key, value);
// Simulate a stale IndexedDB copy after a more recent fallback write.
globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        close() {},
        transaction() {
          return {
            objectStore() {
              return {
                get() {
                  const read = {
                    result: { ...old, updatedAt: "2000-01-01T00:00:00Z" },
                  };
                  queueMicrotask(() => read.onsuccess());
                  return read;
                },
              };
            },
          };
        },
      };
      request.onsuccess();
    });
    return request;
  },
};
assert.deepEqual(
  (await loadData()).events,
  imported.events,
  "Newest fallback beats a stale IndexedDB copy",
);
console.log(
  "Storage checks passed: queued saves, read-back, write failure, recovery and stale fallback.",
);
