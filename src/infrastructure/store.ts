import {
  activeEvents,
  buildPortfolio,
  makeEvent,
  today,
  type LedgerEvent,
} from "../domain/domain";
import architecture from "../../docs/ARCHITECTURE.md?raw";
import { validateEvents } from "../domain/validation";

export interface Pocket {
  id: string;
  name: string;
  target: number;
  allocations: { assetId: string; amount: number }[];
}
export interface AppData {
  schemaVersion: 2;
  updatedAt: string;
  events: LedgerEvent[];
  documentation?: { architecture: string; version: number };
  settings: {
    pockets?: Pocket[];
    currency: "BRL";
    displayCurrency?: "BRL" | "USD";
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

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME + storageScope, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadData(): Promise<AppData> {
  await pendingSave.catch(() => undefined);
  const candidates: AppData[] = [];
  let foundStoredData = false;
  try {
    const db = await openDatabase();
    const value = await new Promise<AppData | undefined>((resolve, reject) => {
      const request = db
        .transaction(STORE, "readonly")
        .objectStore(STORE)
        .get(KEY);
      request.onsuccess = () => resolve(request.result as AppData | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (value) {
      foundStoredData = true;
      candidates.push(validateData(value));
    }
  } catch {
    /* restricted browsers use the JSON localStorage fallback */
  }
  try {
    const fallback = localStorage.getItem(fallbackKey + storageScope);
    if (fallback) {
      foundStoredData = true;
      candidates.push(validateData(JSON.parse(fallback)));
    }
  } catch {
    /* use a valid IndexedDB copy when the fallback is unavailable */
  }
  if (candidates.length)
    return candidates.sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    )[0];
  if (foundStoredData)
    throw new Error(
      "Os dados salvos não puderam ser lidos. Importe um backup válido para recuperá-los.",
    );
  return emptyData();
}

export function saveData(data: AppData): Promise<void> {
  const snapshot = structuredClone(data);
  const operation = pendingSave
    .catch(() => undefined)
    .then(() => writeData(snapshot));
  pendingSave = operation;
  return operation;
}

async function writeData(data: AppData): Promise<void> {
  const next = { ...data, updatedAt: new Date().toISOString() };
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(next, KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  } catch {
    localStorage.setItem(fallbackKey + storageScope, JSON.stringify(next));
  }
}

/** Acknowledge restoration only after the saved data has been read back. */
export async function restoreBackup(value: unknown): Promise<AppData> {
  const imported = validateData(value);
  await saveData(imported);
  const persisted = await loadData();
  if (
    JSON.stringify(persisted.events) !== JSON.stringify(imported.events) ||
    JSON.stringify(persisted.settings) !== JSON.stringify(imported.settings) ||
    JSON.stringify(persisted.importInfo) !== JSON.stringify(imported.importInfo)
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
    (settings.displayCurrency !== undefined &&
      !["BRL", "USD"].includes(settings.displayCurrency)) ||
    !Array.isArray(settings.milestones) ||
    !settings.milestones.every(
      (item) => typeof item === "number" && Number.isFinite(item) && item > 0,
    )
  ) {
    throw new Error(
      "Formato incompatível. Use um backup Finplan versão 1 ou 2.",
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
  const quotes = activeEvents(data.events)
    .filter(
      (event) =>
        event.type === "quote" &&
        event.assetId === "FX:USD/BRL" &&
        event.date <= date,
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  const fx = quotes[0]?.type === "quote" ? quotes[0].price : 0;
  const portfolio = buildPortfolio(data.events, fx);
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
    ...(fx > 0 ? { usdValue: portfolio.totalValue / fx, fxRate: fx } : {}),
    memo: "Patrimônio calculado no momento da exportação, usando as cotações e avaliações salvas.",
  });
  return {
    ...data,
    documentation: { architecture, version: 1 },
    updatedAt: snapshot.createdAt,
    events: [...data.events, snapshot],
  };
}

export async function saveExportSnapshot(data: AppData): Promise<AppData> {
  const exported = createExportSnapshot(data);
  await saveData(exported);
  return exported;
}

export async function exportBackup(data: AppData): Promise<AppData> {
  const exported = await saveExportSnapshot(data);
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
