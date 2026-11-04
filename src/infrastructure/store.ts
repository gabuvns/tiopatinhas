import {
  buildPortfolio,
  displayCurrencies,
  makeEvent,
  today,
  type LedgerEvent,
  type DisplayCurrency,
  type CurrencyRates,
} from "../domain/domain";
import { exchangeRates } from "../domain/money";
import architecture from "../../docs/ARCHITECTURE.md?raw";
import { validateEvents } from "../domain/validation";
import { createDefaultPockets, type Pocket } from "../domain/pockets";
export type { Pocket } from "../domain/pockets";
export interface AppData {
  schemaVersion: 2;
  updatedAt: string;
  events: LedgerEvent[];
  documentation?: { architecture: string; version: number };
  settings: {
    pockets?: Pocket[];
    currency: "BRL";
    displayCurrency?: DisplayCurrency;
    theme?: "system" | "light" | "dark";
    milestones: number[];
  };
  importInfo?: {
    sourceFile: string;
    referenceDate: string;
    excludedSheets: string[];
    warnings: string[];
    notes: string[];
    reconciliations: {
      month: string;
      metric: string;
      detail: number;
      summary: number;
      difference: number;
    }[];
  };
}

const DB_NAME = "finplan-local";
const STORE = "app";
const KEY = "state";
const fallbackKey = "finplan-state";
let storageScope = "";
export function setStorageScope(demo: boolean) {
  storageScope = demo ? "-demo" : "";
}
let pendingSave: Promise<void> = Promise.resolve();
export const emptyData = (): AppData => ({
  schemaVersion: 2,
  updatedAt: new Date().toISOString(),
  events: [],
  settings: { currency: "BRL", milestones: [50000, 100000, 200000, 300000] },
});

function openDatabase(scope: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME + scope, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadData(scope = storageScope): Promise<AppData> {
  await pendingSave.catch(() => undefined);
  const candidates: AppData[] = [];
  let foundStoredData = false;
  let readFailed = false;
  let database: IDBDatabase | undefined;
  try {
    const db = (database = await openDatabase(scope));
    const value = await new Promise<AppData | undefined>((resolve, reject) => {
      const request = db
        .transaction(STORE, "readonly")
        .objectStore(STORE)
        .get(KEY);
      request.onsuccess = () => resolve(request.result as AppData | undefined);
      request.onerror = () => reject(request.error);
    });
    if (value) {
      foundStoredData = true;
      candidates.push(validateData(value));
    }
  } catch {
    readFailed = true;
  } finally {
    database?.close();
  }
  try {
    const fallback = localStorage.getItem(fallbackKey + scope);
    if (fallback) {
      foundStoredData = true;
      candidates.push(validateData(JSON.parse(fallback)));
    }
  } catch {
    readFailed = true;
  }
  if (candidates.length)
    return candidates.sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    )[0];
  if (foundStoredData || readFailed)
    throw new Error(
      "Os dados salvos não puderam ser lidos. Importe um backup válido para recuperá-los.",
    );
  return emptyData();
}

export function saveData(data: AppData, scope = storageScope): Promise<void> {
  const snapshot = structuredClone(data);
  const operation = pendingSave
    .catch(() => undefined)
    .then(() => writeData(snapshot, scope));
  pendingSave = operation;
  return operation;
}

let lastWrite = 0;
async function writeData(data: AppData, scope: string): Promise<void> {
  lastWrite = Math.max(Date.now(), lastWrite + 1);
  const next = { ...data, updatedAt: new Date(lastWrite).toISOString() };
  let database: IDBDatabase | undefined;
  try {
    const db = (database = await openDatabase(scope));
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(next, KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    localStorage.setItem(fallbackKey + scope, JSON.stringify(next));
  } finally {
    database?.close();
  }
}

/** Acknowledge restoration only after the saved data has been read back. */
export async function restoreBackup(
  value: unknown,
  scope = storageScope,
): Promise<AppData> {
  const imported = validateData(value);
  await saveData(imported, scope);
  const persisted = await loadData(scope);
  if (
    JSON.stringify(persisted.events) !== JSON.stringify(imported.events) ||
    JSON.stringify(persisted.settings) !== JSON.stringify(imported.settings) ||
    JSON.stringify(persisted.importInfo) !==
      JSON.stringify(imported.importInfo) ||
    JSON.stringify(persisted.documentation) !==
      JSON.stringify(imported.documentation)
  ) {
    throw new Error(
      "A gravação não foi confirmada. O backup não foi aplicado ao painel; tente novamente.",
    );
  }
  return persisted;
}

export function validateData(value: unknown): AppData {
  if (!value || typeof value !== "object")
    throw new Error("O arquivo não contém um objeto JSON válido.");
  const data = value as Record<string, unknown>;
  const settings = data.settings as AppData["settings"] | undefined;
  if (
    (data.schemaVersion !== 1 && data.schemaVersion !== 2) ||
    !Array.isArray(data.events) ||
    !settings ||
    settings.currency !== "BRL" ||
    (settings.theme !== undefined &&
      !["system", "light", "dark"].includes(settings.theme)) ||
    (settings.displayCurrency !== undefined &&
      !displayCurrencies.includes(settings.displayCurrency)) ||
    !Array.isArray(settings.milestones) ||
    !settings.milestones.every(
      (item) => typeof item === "number" && Number.isFinite(item) && item > 0,
    )
  ) {
    throw new Error(
      "Formato incompatível. Use um backup TioPatinhas versão 1 ou 2 (compatível com Finplan).",
    );
  }
  if (settings.pockets !== undefined) {
    if (
      !Array.isArray(settings.pockets) ||
      new Set(settings.pockets.map((p) => p.id)).size !==
        settings.pockets.length ||
      settings.pockets.some(
        (p) =>
          !p ||
          typeof p.id !== "string" ||
          typeof p.name !== "string" ||
          !p.name.trim() ||
          !Number.isFinite(p.target) ||
          p.target < 0 ||
          !Array.isArray(p.allocations) ||
          new Set(p.allocations.map((a) => a.assetId)).size !==
            p.allocations.length ||
          p.allocations.some(
            (a) =>
              !a ||
              typeof a.assetId !== "string" ||
              !Number.isFinite(a.amount) ||
              a.amount < 0,
          ),
      )
    )
      throw new Error("Cofrinhos inválidos no backup.");
  }
  const events = validateEvents(data.events);
  let importInfo: AppData["importInfo"];
  if (data.importInfo !== undefined) {
    const info = data.importInfo as AppData["importInfo"];
    if (
      !info ||
      typeof info.sourceFile !== "string" ||
      typeof info.referenceDate !== "string" ||
      !Array.isArray(info.warnings) ||
      !info.warnings.every((item) => typeof item === "string") ||
      !Array.isArray(info.excludedSheets) ||
      !info.excludedSheets.every((item) => typeof item === "string") ||
      !Array.isArray(info.notes) ||
      !info.notes.every((item) => typeof item === "string") ||
      !Array.isArray(info.reconciliations) ||
      !info.reconciliations.every(
        (item) =>
          item &&
          typeof item.month === "string" &&
          typeof item.metric === "string" &&
          [item.detail, item.summary, item.difference].every(
            (n) => typeof n === "number" && Number.isFinite(n),
          ),
      )
    ) {
      throw new Error("Metadados da importação inválidos.");
    }
    importInfo = info;
  }
  return {
    schemaVersion: 2,
    updatedAt:
      typeof data.updatedAt === "string"
        ? data.updatedAt
        : new Date().toISOString(),
    events,
    settings,
    ...(data.documentation &&
    typeof (data.documentation as { architecture?: unknown }).architecture ===
      "string"
      ? { documentation: data.documentation as AppData["documentation"] }
      : {}),
    ...(importInfo ? { importInfo } : {}),
  };
}

export function createExportSnapshot(data: AppData): AppData {
  const date = today();
  const currencyRates = exchangeRates(data.events, date);
  const fx = currencyRates.USD ?? 0;
  const portfolio = buildPortfolio(data.events, fx);
  const currencyValues: CurrencyRates = {};
  for (const currency of displayCurrencies) {
    const rate = currencyRates[currency];
    if (rate) currencyValues[currency] = portfolio.totalValue / rate;
  }
  const byCategory: Record<string, number> = {};
  [...portfolio.positions, ...portfolio.illiquidAssets].forEach((p) => {
    byCategory[p.assetClass] = (byCategory[p.assetClass] ?? 0) + p.value;
  });
  const snapshot = makeEvent({
    type: "wealth_snapshot",
    date,
    origin: "export",
    totalValue: portfolio.totalValue,
    liquidValue: portfolio.liquidValue,
    illiquidValue: portfolio.illiquidValue,
    byCategory,
    currencyValues,
    currencyRates,
    ...(fx > 0 ? { usdValue: portfolio.totalValue / fx, fxRate: fx } : {}),
    memo: "Patrimônio calculado no momento da exportação, usando as cotações e avaliações salvas.",
  });
  return {
    ...data,
    settings: {
      ...data.settings,
      pockets: data.settings.pockets ?? createDefaultPockets(),
    },
    documentation: { architecture, version: 1 },
    updatedAt: snapshot.createdAt,
    events: [...data.events, snapshot],
  };
}

export async function saveExportSnapshot(
  data: AppData,
  scope = storageScope,
): Promise<AppData> {
  const exported = createExportSnapshot(data);
  await saveData(exported, scope);
  return exported;
}

export async function exportBackup(
  data: AppData,
  scope = storageScope,
): Promise<AppData> {
  const exported = await saveExportSnapshot(data, scope);
  downloadBackup(exported);
  return exported;
}

function downloadBackup(data: AppData): void {
  const blob = new Blob(
    [
      JSON.stringify(
        { ...data, exportedAt: new Date().toISOString() },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const date = new Date();
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  anchor.download = `tiopatinhas-backup-${localDate}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
