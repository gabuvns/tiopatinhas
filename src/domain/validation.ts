import { activeEvents, type LedgerEvent } from "./domain";

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const nonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const liquidClasses = [
  "Ações",
  "FIIs",
  "Renda fixa",
  "Stocks",
  "REITs",
  "ETFs",
  "Fixed income",
  "Bitcoin",
  "Altcoins",
];
const illiquidClasses = [
  "FGTS",
  "Previdência",
  "Imóveis",
  "Empresas",
  "Metais preciosos",
  "Obras de arte",
  "Veículos",
  "Joias",
  "Outro",
];

export function validateEvents(values: unknown[]): LedgerEvent[] {
  const ids = new Set<string>();
  for (const value of values) {
    if (!value || typeof value !== "object")
      throw new Error("Evento inválido no histórico.");
    const e = value as Record<string, unknown>;
    if (!text(e.id) || ids.has(e.id))
      throw new Error(
        "O histórico contém identificadores vazios ou duplicados.",
      );
    ids.add(e.id);
    if (
      !text(e.date) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
      !Number.isFinite(Date.parse(e.date)) ||
      new Date(e.date).toISOString().slice(0, 10) !== e.date ||
      !text(e.createdAt) ||
      !Number.isFinite(Date.parse(e.createdAt))
    ) {
      throw new Error("Data inválida no evento " + e.id);
    }
    if (e.provenance !== undefined) {
      const source = e.provenance as Record<string, unknown>;
      if (!source || !text(source.sheet) || !text(source.range))
        throw new Error("Origem inválida no evento " + e.id);
    }
    const asset = () =>
      text(e.assetId) &&
      text(e.ticker) &&
      text(e.name) &&
      ["Brasil", "Exterior", "Cripto"].includes(String(e.geography)) &&
      liquidClasses.includes(String(e.assetClass)) &&
      ["BRL", "USD"].includes(String(e.currency)) &&
      Number.isInteger(e.precision) &&
      Number(e.precision) >= 0 &&
      Number(e.precision) <= 8;
    let valid = false;
    switch (e.type) {
      case "income":
        valid =
          positive(e.amount) &&
          ["Salário", "Renda extra", "Dividendos"].includes(String(e.category));
        break;
      case "expense":
        valid =
          positive(e.amount) &&
          ["Cartão", "PIX", "Mercado", "Outro"].includes(String(e.category));
        break;
      case "salary_change":
        valid = positive(e.monthlyAmount);
        break;
      case "trade":
        valid =
          asset() &&
          positive(e.quantity) &&
          positive(e.unitPrice) &&
          ["COMPRA", "VENDA"].includes(String(e.side)) &&
          (e.fxRate === undefined || positive(e.fxRate));
        break;
      case "opening_position":
        valid =
          asset() &&
          nonnegative(e.quantity) &&
          nonnegative(e.marketPrice) &&
          (e.averageCost === null || nonnegative(e.averageCost)) &&
          (e.balanceBased === undefined ||
            typeof e.balanceBased === "boolean") &&
          (e.rebalanceEligible === undefined ||
            typeof e.rebalanceEligible === "boolean");
        break;
      case "investment_contribution":
        valid =
          positive(e.amount) &&
          ["liquid", "illiquid"].includes(String(e.liquidity)) &&
          text(e.category);
        break;
      case "wealth_snapshot":
        valid =
          nonnegative(e.totalValue) &&
          (e.usdValue === undefined || nonnegative(e.usdValue)) &&
          (e.fxRate === undefined || positive(e.fxRate)) &&
          (e.usdValue === undefined ||
            (positive(e.fxRate) &&
              Math.abs(
                Number(e.usdValue) * Number(e.fxRate) - Number(e.totalValue),
              ) < 0.01)) &&
          (e.byCategory === undefined ||
            (typeof e.byCategory === "object" &&
              e.byCategory !== null &&
              Object.values(e.byCategory).every(nonnegative))) &&
          (e.origin === undefined || e.origin === "export") &&
          (e.liquidValue === undefined || nonnegative(e.liquidValue)) &&
          (e.illiquidValue === undefined || nonnegative(e.illiquidValue)) &&
          (e.liquidValue === undefined ||
            e.illiquidValue === undefined ||
            Math.abs(
              Number(e.liquidValue) + Number(e.illiquidValue) - e.totalValue,
            ) < 0.005);
        break;
      case "illiquid_contribution":
      case "illiquid_valuation":
        valid =
          text(e.assetId) &&
          text(e.name) &&
          illiquidClasses.includes(String(e.assetClass)) &&
          positive(e.amount);
        break;
      case "quote":
        valid =
          text(e.assetId) &&
          text(e.ticker) &&
          positive(e.price) &&
          ["BRL", "USD"].includes(String(e.currency)) &&
          text(e.source) &&
          text(e.fetchedAt) &&
          Number.isFinite(Date.parse(e.fetchedAt));
        break;
      case "target":
        valid =
          text(e.assetId) &&
          text(e.ticker) &&
          nonnegative(e.targetPercent) &&
          e.targetPercent <= 100;
        break;
      case "correction":
        valid = text(e.targetEventId) && typeof e.reason === "string";
        break;
      case "milestone":
        valid = positive(e.threshold);
        break;
      case "reserve_classification":
        valid = text(e.assetId) && typeof e.isEmergencyReserve === "boolean";
        break;
    }
    if (!valid)
      throw new Error(
        "Conteúdo inválido no evento " + e.id + " (" + String(e.type) + ").",
      );
  }
  const events = values as LedgerEvent[];
  for (const event of events) {
    if (
      event.type === "correction" &&
      (!ids.has(event.targetEventId) ||
        event.targetEventId === event.id ||
        events.find((item) => item.id === event.targetEventId)?.type ===
          "correction")
    ) {
      throw new Error("Estorno sem evento de origem válido.");
    }
  }
  const quantities = new Map<string, number>();
  for (const event of activeEvents(events).sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  )) {
    if (event.type === "opening_position")
      quantities.set(event.assetId, event.quantity);
    if (event.type === "trade") {
      const quantity = quantities.get(event.assetId) ?? 0;
      if (event.side === "VENDA" && event.quantity > quantity + 1e-9)
        throw new Error(
          "Venda sem posição suficiente: " + event.ticker + " em " + event.date,
        );
      quantities.set(
        event.assetId,
        quantity + (event.side === "COMPRA" ? event.quantity : -event.quantity),
      );
    }
  }
  return events;
}
