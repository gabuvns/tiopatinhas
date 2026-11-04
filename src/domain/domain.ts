export type Currency = "BRL" | "USD";
export const displayCurrencies = ["BRL", "USD", "EUR", "GBP", "CHF"] as const;
export type DisplayCurrency = (typeof displayCurrencies)[number];
/** BRL per one unit of the currency. BRL is always 1. */
export type CurrencyRates = Partial<Record<DisplayCurrency, number>>;
export type Geography = "Brasil" | "Exterior" | "Cripto";
export type AssetClass =
  | "Ações"
  | "FIIs"
  | "Renda fixa"
  | "Stocks"
  | "REITs"
  | "ETFs"
  | "Fixed income"
  | "Bitcoin"
  | "Altcoins";
export type IlliquidClass =
  | "FGTS"
  | "Previdência"
  | "Imóveis"
  | "Empresas"
  | "Metais preciosos"
  | "Obras de arte"
  | "Veículos"
  | "Joias"
  | "Outro";

interface BaseEvent {
  id: string;
  date: string;
  createdAt: string;
  memo?: string;
  provenance?: {
    sheet: string;
    range: string;
    grain?: "month" | "snapshot" | "effective-date";
  };
}

/** Imported position, not a purchase. Its acquisition cost may be unknown. */
export interface OpeningPositionEvent extends BaseEvent {
  type: "opening_position";
  assetId: string;
  ticker: string;
  name: string;
  geography: Geography;
  assetClass: AssetClass;
  currency: Currency;
  quantity: number;
  marketPrice: number;
  averageCost: number | null;
  precision: number;
  balanceBased?: boolean;
  rebalanceEligible?: boolean;
}

/** Historical cash flow only; never changes the current position. */
export interface InvestmentContributionEvent extends BaseEvent {
  type: "investment_contribution";
  amount: number;
  liquidity: "liquid" | "illiquid";
  category: string;
}

export interface WealthSnapshotEvent extends BaseEvent {
  type: "wealth_snapshot";
  totalValue: number;
  usdValue?: number;
  fxRate?: number;
  currencyValues?: Partial<Record<DisplayCurrency, number>>;
  currencyRates?: CurrencyRates;
  byCategory?: Record<string, number>;
  origin?: "export";
  liquidValue?: number;
  illiquidValue?: number;
}

export interface IncomeEvent extends BaseEvent {
  type: "income";
  category: "Salário" | "Renda extra" | "Dividendos";
  amount: number;
}

export interface SalaryChangeEvent extends BaseEvent {
  type: "salary_change";
  monthlyAmount: number;
}

export interface ExpenseEvent extends BaseEvent {
  type: "expense";
  category: "Cartão" | "PIX" | "Mercado" | "Outro";
  amount: number;
  cardName?: string;
}

export interface TradeEvent extends BaseEvent {
  type: "trade";
  side: "COMPRA" | "VENDA";
  assetId: string;
  ticker: string;
  name: string;
  geography: Geography;
  assetClass: AssetClass;
  currency: Currency;
  quantity: number;
  unitPrice: number;
  precision: number;
  fxRate?: number;
}

export interface IlliquidContributionEvent extends BaseEvent {
  type: "illiquid_contribution";
  assetId: string;
  name: string;
  assetClass: IlliquidClass;
  amount: number;
}

export interface IlliquidValuationEvent extends BaseEvent {
  type: "illiquid_valuation";
  assetId: string;
  name: string;
  assetClass: IlliquidClass;
  amount: number;
}

export interface QuoteEvent extends BaseEvent {
  type: "quote";
  assetId: string;
  ticker: string;
  price: number;
  currency: Currency;
  source: string;
  fetchedAt: string;
}

export interface TargetEvent extends BaseEvent {
  type: "target";
  assetId: string;
  ticker: string;
  targetPercent: number;
  name?: string;
  geography?: Geography;
  assetClass?: AssetClass;
  currency?: Currency;
  precision?: number;
}

export interface CorrectionEvent extends BaseEvent {
  type: "correction";
  targetEventId: string;
  reason: string;
}

export interface MilestoneEvent extends BaseEvent {
  type: "milestone";
  threshold: number;
}

export interface ReserveClassificationEvent extends BaseEvent {
  type: "reserve_classification";
  assetId: string;
  isEmergencyReserve: boolean;
}

export type LedgerEvent =
  | IncomeEvent
  | SalaryChangeEvent
  | ExpenseEvent
  | TradeEvent
  | IlliquidContributionEvent
  | IlliquidValuationEvent
  | QuoteEvent
  | TargetEvent
  | CorrectionEvent
  | MilestoneEvent
  | OpeningPositionEvent
  | InvestmentContributionEvent
  | WealthSnapshotEvent
  | ReserveClassificationEvent;

export interface Position {
  assetId: string;
  ticker: string;
  name: string;
  geography: Geography;
  assetClass: AssetClass;
  currency: Currency;
  quantity: number;
  averageCost: number | null;
  price: number;
  priceSource: string;
  priceDate: string;
  value: number;
  targetPercent: number;
  precision: number;
  isEmergencyReserve?: boolean;
  balanceBased?: boolean;
  rebalanceEligible?: boolean;
}

export interface IlliquidPosition {
  assetId: string;
  name: string;
  assetClass: IlliquidClass;
  value: number;
  lastUpdate: string;
}

export interface PortfolioSnapshot {
  positions: Position[];
  illiquidAssets: IlliquidPosition[];
  liquidValue: number;
  illiquidValue: number;
  totalValue: number;
}

export interface MonthSummary {
  income: number;
  expenses: number;
  invested: number;
  savingsRate: number;
  byIncome: Record<string, number>;
  byExpense: Record<string, number>;
}

export interface RebalanceAction {
  assetId: string;
  ticker: string;
  side: "COMPRAR" | "VENDER";
  amount: number;
  quantity: number;
  residual: number;
}

export const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
export const makeId = () => crypto.randomUUID();

export function activeEvents(events: LedgerEvent[]): LedgerEvent[] {
  const voided = new Set(
    events
      .filter((event): event is CorrectionEvent => event.type === "correction")
      .map((event) => event.targetEventId),
  );
  return events.filter(
    (event) => event.type !== "correction" && !voided.has(event.id),
  );
}

type NewLedgerEvent = LedgerEvent extends infer Event
  ? Event extends LedgerEvent
    ? Omit<Event, "id" | "createdAt">
    : never
  : never;
export function makeEvent(value: NewLedgerEvent): LedgerEvent {
  return {
    ...value,
    id: makeId(),
    createdAt: new Date().toISOString(),
  } as LedgerEvent;
}

export function summarizeMonth(
  events: LedgerEvent[],
  month: string,
  fxUsdBrl = 1,
): MonthSummary {
  const records = activeEvents(events).filter((event) =>
    event.date.startsWith(month),
  );
  const incomes = records.filter(
    (event): event is IncomeEvent => event.type === "income",
  );
  const expenses = records.filter(
    (event): event is ExpenseEvent => event.type === "expense",
  );
  const income = incomes.reduce((sum, event) => sum + event.amount, 0);
  const expenseTotal = expenses.reduce((sum, event) => sum + event.amount, 0);
  const invested =
    records
      .filter(
        (event): event is TradeEvent =>
          event.type === "trade" && event.side === "COMPRA",
      )
      .reduce(
        (sum, event) =>
          sum +
          event.quantity *
            event.unitPrice *
            (event.currency === "USD" ? event.fxRate || fxUsdBrl : 1),
        0,
      ) +
    records
      .filter(
        (event): event is IlliquidContributionEvent =>
          event.type === "illiquid_contribution",
      )
      .reduce((sum, event) => sum + event.amount, 0) +
    records
      .filter(
        (event): event is InvestmentContributionEvent =>
          event.type === "investment_contribution",
      )
      .reduce((sum, event) => sum + event.amount, 0);
  return {
    income,
    expenses: expenseTotal,
    invested,
    savingsRate: income > 0 ? (income - expenseTotal) / income : 0,
    byIncome: incomes.reduce<Record<string, number>>(
      (out, event) => ({
        ...out,
        [event.category]: (out[event.category] ?? 0) + event.amount,
      }),
      {},
    ),
    byExpense: expenses.reduce<Record<string, number>>(
      (out, event) => ({
        ...out,
        [event.category]: (out[event.category] ?? 0) + event.amount,
      }),
      {},
    ),
  };
}

export function currentSalary(events: LedgerEvent[]): number {
  return (
    activeEvents(events)
      .filter(
        (event): event is SalaryChangeEvent => event.type === "salary_change",
      )
      .filter((event) => event.date <= today())
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.monthlyAmount ?? 0
  );
}

/** Declared historical totals; never reconstructed from today's holdings. */
export function wealthHistory(events: LedgerEvent[]): WealthSnapshotEvent[] {
  return activeEvents(events)
    .filter(
      (event): event is WealthSnapshotEvent =>
        event.type === "wealth_snapshot" && event.date <= today(),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );
}

export function buildPortfolio(
  events: LedgerEvent[],
  fxUsdBrl = 1,
): PortfolioSnapshot {
  const records = activeEvents(events)
    .filter((event) => event.date <= today())
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );
  const quotes = new Map<string, QuoteEvent>();
  const targets = new Map<string, TargetEvent>();
  const reserves = new Map<string, boolean>();
  for (const event of records) {
    if (event.type === "quote") {
      const prior = quotes.get(event.assetId);
      if (
        !prior ||
        event.date > prior.date ||
        (event.date === prior.date && event.fetchedAt > prior.fetchedAt)
      )
        quotes.set(event.assetId, event);
    }
    if (event.type === "target") targets.set(event.assetId, event);
    if (event.type === "reserve_classification")
      reserves.set(event.assetId, event.isEmergencyReserve);
  }
  type MutablePosition = Omit<
    Position,
    "price" | "priceSource" | "priceDate" | "value" | "targetPercent"
  >;
  const positions = new Map<string, MutablePosition>();
  const openingPrices = new Map<string, OpeningPositionEvent>();
  for (const event of records) {
    if (event.type === "opening_position") {
      positions.set(event.assetId, {
        assetId: event.assetId,
        ticker: event.ticker,
        name: event.name,
        geography: event.geography,
        assetClass: event.assetClass,
        currency: event.currency,
        quantity: event.quantity,
        averageCost: event.averageCost,
        precision: event.precision,
        balanceBased: event.balanceBased,
        rebalanceEligible: event.rebalanceEligible,
      });
      openingPrices.set(event.assetId, event);
      continue;
    }
    if (event.type !== "trade") continue;
    const previous = positions.get(event.assetId) ?? {
      assetId: event.assetId,
      ticker: event.ticker,
      name: event.name,
      geography: event.geography,
      assetClass: event.assetClass,
      currency: event.currency,
      quantity: 0,
      averageCost: 0,
      precision: event.precision,
    };
    if (event.side === "COMPRA") {
      const nextQuantity = previous.quantity + event.quantity;
      previous.averageCost =
        previous.quantity > 0 && previous.averageCost === null
          ? null
          : nextQuantity > 0
            ? (previous.quantity * (previous.averageCost ?? 0) +
                event.quantity * event.unitPrice) /
              nextQuantity
            : event.unitPrice;
      previous.quantity = nextQuantity;
    } else if (event.quantity <= previous.quantity + 1e-9) {
      previous.quantity = Math.max(0, previous.quantity - event.quantity);
    }
    positions.set(event.assetId, previous);
  }
  for (const event of records) {
    if (
      event.type !== "target" ||
      positions.has(event.assetId) ||
      !event.geography ||
      !event.assetClass ||
      !event.currency
    )
      continue;
    positions.set(event.assetId, {
      assetId: event.assetId,
      ticker: event.ticker,
      name: event.name ?? event.ticker,
      geography: event.geography,
      assetClass: event.assetClass,
      currency: event.currency,
      quantity: 0,
      averageCost: 0,
      precision: event.precision ?? 0,
    });
  }
  const completed = [...positions.values()]
    .filter(
      (position) =>
        position.quantity > 1e-9 ||
        (targets.get(position.assetId)?.targetPercent ?? 0) > 0,
    )
    .map((position): Position => {
      const quote = quotes.get(position.assetId);
      const opening = openingPrices.get(position.assetId);
      const useQuote = quote && (!opening || quote.date >= opening.date);
      const price = useQuote
        ? quote.price
        : (opening?.marketPrice ?? position.averageCost ?? 0);
      return {
        ...position,
        price,
        priceSource: useQuote
          ? quote.source
          : opening
            ? "Posição importada"
            : "Preço médio (sem cotação)",
        priceDate: useQuote ? quote.date : (opening?.date ?? ""),
        value:
          position.quantity *
          price *
          (position.currency === "USD" ? fxUsdBrl : 1),
        targetPercent: targets.get(position.assetId)?.targetPercent ?? 0,
        isEmergencyReserve: reserves.get(position.assetId) ?? false,
      };
    });
  const assetMeta = new Map<
    string,
    { name: string; assetClass: IlliquidClass }
  >();
  const contributions = new Map<string, number>();
  const valuations = new Map<string, IlliquidValuationEvent>();
  for (const event of records) {
    if (event.type === "illiquid_contribution") {
      assetMeta.set(event.assetId, {
        name: event.name,
        assetClass: event.assetClass,
      });
      contributions.set(
        event.assetId,
        (contributions.get(event.assetId) ?? 0) + event.amount,
      );
    }
    if (event.type === "illiquid_valuation") {
      assetMeta.set(event.assetId, {
        name: event.name,
        assetClass: event.assetClass,
      });
      const prior = valuations.get(event.assetId);
      if (
        !prior ||
        event.date > prior.date ||
        (event.date === prior.date && event.createdAt > prior.createdAt)
      )
        valuations.set(event.assetId, event);
    }
  }
  const illiquidAssets = [...assetMeta.entries()]
    .map(([assetId, metadata]): IlliquidPosition => {
      const valuation = valuations.get(assetId);
      const laterContributions = records
        .filter(
          (event): event is IlliquidContributionEvent =>
            event.type === "illiquid_contribution" &&
            event.assetId === assetId &&
            (!valuation ||
              event.date > valuation.date ||
              (event.date === valuation.date &&
                event.createdAt > valuation.createdAt)),
        )
        .reduce((sum, event) => sum + event.amount, 0);
      const contributionsForAsset = records.filter(
        (event): event is IlliquidContributionEvent =>
          event.type === "illiquid_contribution" && event.assetId === assetId,
      );
      return {
        assetId,
        ...metadata,
        value: valuation
          ? valuation.amount + laterContributions
          : (contributions.get(assetId) ?? 0),
        lastUpdate:
          valuation?.date ??
          contributionsForAsset[contributionsForAsset.length - 1]?.date ??
          "",
      };
    })
    .filter((asset) => asset.value > 0);
  const liquidValue = completed.reduce(
    (sum, position) => sum + position.value,
    0,
  );
  const illiquidValue = illiquidAssets.reduce(
    (sum, asset) => sum + asset.value,
    0,
  );
  return {
    positions: completed,
    illiquidAssets,
    liquidValue,
    illiquidValue,
    totalValue: liquidValue + illiquidValue,
  };
}

export function calculateRebalance(
  positions: Position[],
  fxUsdBrl = 1,
): RebalanceAction[] {
  positions = positions.filter(
    (position) =>
      position.rebalanceEligible !== false && !position.isEmergencyReserve,
  );
  const targetTotal = positions.reduce(
    (sum, position) => sum + position.targetPercent,
    0,
  );
  if (targetTotal <= 0) return [];
  const total = positions.reduce((sum, position) => sum + position.value, 0);
  return positions.flatMap((position) => {
    const gap = (total * position.targetPercent) / targetTotal - position.value;
    const priceInBrl =
      position.price * (position.currency === "USD" ? fxUsdBrl : 1);
    if (Math.abs(gap) < 0.01 || priceInBrl <= 0) return [];
    const exactQuantity = Math.abs(gap) / priceInBrl;
    const factor = 10 ** Math.max(0, Math.min(position.precision, 8));
    const quantity = Math.floor(exactQuantity * factor + 1e-9) / factor;
    if (quantity <= 0) return [];
    const amount = quantity * priceInBrl;
    return [
      {
        assetId: position.assetId,
        ticker: position.ticker,
        side: gap > 0 ? ("COMPRAR" as const) : ("VENDER" as const),
        amount,
        quantity,
        residual: Math.abs(gap) - amount,
      },
    ];
  });
}

export function projectWealth(
  principal: number,
  contribution: number,
  annualRatePercent: number,
  months: number,
): number {
  const monthlyRate = Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1;
  if (monthlyRate === 0) return principal + contribution * months;
  return (
    principal * Math.pow(1 + monthlyRate, months) +
    (contribution * (Math.pow(1 + monthlyRate, months) - 1)) / monthlyRate
  );
}

export function formatMoney(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}
export function formatNumber(value: number, digits = 4): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(value || 0);
}
export function formatDate(date: string): string {
  return date
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeZone: "UTC",
      }).format(new Date(date))
    : "—";
}

/** Purchase-only allocation of a new contribution. Never finances purchases with sales. */
export function planContribution(
  positions: Position[],
  budget: number,
  fx = 1,
): RebalanceAction[] {
  const eligible = positions.filter(
    (p) => p.rebalanceEligible !== false && !p.isEmergencyReserve,
  );
  const weight = eligible.reduce((sum, p) => sum + p.targetPercent, 0);
  if (!Number.isFinite(budget) || !(budget > 0) || !weight) return [];
  const total = eligible.reduce((sum, p) => sum + p.value, 0) + budget;
  const gaps = eligible.map((p) => ({
    p,
    gap: Math.max(0, (total * p.targetPercent) / weight - p.value),
  }));
  const sum = gaps.reduce((s, g) => s + g.gap, 0);
  const proposals = gaps.map(({ p, gap }) => {
    const price = p.price * (p.currency === "USD" ? fx : 1);
    const allocated = sum > 0 ? (budget * gap) / sum : 0,
      factor = 10 ** p.precision;
    const quantity =
      gap > 0 && Number.isFinite(price) && price > 0
        ? Math.floor((allocated / price) * factor) / factor
        : 0;
    return { p, gap, price, factor, quantity, allocated };
  });
  let remaining =
    budget -
    proposals.reduce(
      (s, item) =>
        s +
        item.quantity *
          (Number.isFinite(item.price) && item.price > 0 ? item.price : 0),
      0,
    );
  // Use rounding leftovers while staying below each asset's target value.
  const priority = [...proposals].sort(
    (a, b) =>
      b.gap - b.quantity * b.price - (a.gap - a.quantity * a.price) ||
      a.p.assetId.localeCompare(b.p.assetId),
  );
  for (const item of priority) {
    if (!Number.isFinite(item.price) || item.price <= 0) continue;
    const quantumCost = item.price / item.factor;
    const room = Math.max(0, item.gap - item.quantity * item.price);
    const units = Math.floor(Math.min(remaining, room) / quantumCost);
    if (units > 0) {
      item.quantity += units / item.factor;
      remaining = Math.max(0, remaining - units * quantumCost);
    }
  }
  return proposals
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      assetId: item.p.assetId,
      ticker: item.p.ticker,
      side: "COMPRAR" as const,
      quantity: item.quantity,
      amount: item.quantity * item.price,
      residual: Math.max(0, item.allocated - item.quantity * item.price),
    }));
}
