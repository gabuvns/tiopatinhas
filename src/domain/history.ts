import {
  activeEvents,
  today,
  wealthHistory,
  type Currency,
  type LedgerEvent,
} from "./domain";
export interface ChartPoint {
  id: string;
  date: string;
  label: string;
  value: number | null;
  detail?: string;
}
export const historyViews = {
  total: "Patrimônio total",
  liquid: "Patrimônio líquido",
  illiquid: "Patrimônio ilíquido",
  contributions: "Aportes mensais",
};

export function historySeries(
  events: LedgerEvent[],
  view: string,
  currency: Currency,
  from = "",
  to = "",
  asOf = today(),
): ChartPoint[] {
  const end = to && to < asOf ? to : asOf;
  if (from && from > end) return [];
  if (view !== "contributions")
    return wealthHistory(events)
      .filter((point) => point.date >= from && point.date <= end)
      .map((point) => {
        const brl =
          view === "total"
            ? point.totalValue
            : view === "liquid"
              ? point.liquidValue
              : view === "illiquid"
                ? point.illiquidValue
                : point.byCategory?.[view];
        const value =
          currency === "BRL"
            ? brl
            : view === "total"
              ? point.usdValue
              : brl !== undefined && point.fxRate
                ? brl / point.fxRate
                : undefined;
        return {
          id: point.id,
          date: point.date,
          label:
            point.origin === "export"
              ? new Date(point.createdAt).toLocaleString("pt-BR")
              : point.date.split("-").reverse().join("/"),
          value: value ?? null,
        };
      });
  const records = activeEvents(
    events.filter((event) => event.date <= asOf),
  ).sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  const fx = records.filter(
    (event) =>
      (event.type === "quote" && event.assetId === "FX:USD/BRL") ||
      (event.type === "wealth_snapshot" && event.fxRate),
  );
  const rateAt = (date: string) => {
    const event = fx.filter((event) => event.date <= date).slice(-1)[0];
    return event?.type === "quote"
      ? event.price
      : event?.type === "wealth_snapshot"
        ? event.fxRate
        : undefined;
  };
  const groups = new Map<
    string,
    { amount: number; missing: number; count: number }
  >();
  for (const event of records.filter(
    (event) => event.date >= from && event.date <= end,
  )) {
    if (
      ![
        "income",
        "expense",
        "investment_contribution",
        "illiquid_contribution",
        "trade",
      ].includes(event.type)
    )
      continue;
    const month = event.date.slice(0, 7);
    const group = groups.get(month) ?? { amount: 0, missing: 0, count: 0 };
    let brl: number | undefined, usd: number | undefined;
    if (event.type === "trade" && event.side === "COMPRA") {
      const rate =
        event.currency === "USD"
          ? (event.fxRate ?? rateAt(event.date))
          : rateAt(event.date);
      const amount = event.quantity * event.unitPrice;
      brl =
        event.currency === "BRL" ? amount : rate ? amount * rate : undefined;
      usd =
        event.currency === "USD" ? amount : rate ? amount / rate : undefined;
    } else if (
      event.type === "investment_contribution" ||
      event.type === "illiquid_contribution"
    ) {
      brl = event.amount;
      const rate = rateAt(event.date);
      usd = rate ? brl / rate : undefined;
    }
    if (
      brl !== undefined ||
      usd !== undefined ||
      (event.type === "trade" && event.side === "COMPRA") ||
      event.type === "investment_contribution" ||
      event.type === "illiquid_contribution"
    ) {
      const amount = currency === "BRL" ? brl : usd;
      group.count++;
      if (amount === undefined) group.missing++;
      else group.amount += amount;
    }
    groups.set(month, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, group]) => ({
      id: month,
      date: month + "-01",
      label: month.split("-").reverse().join("/"),
      value: group.missing ? null : group.amount,
      detail: group.missing
        ? group.missing +
          " lançamento(s) sem câmbio histórico; total não estimado"
        : group.count + " lançamento(s) de aporte",
    }));
}
