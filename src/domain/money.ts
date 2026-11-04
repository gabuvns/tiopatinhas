import {
  activeEvents,
  displayCurrencies,
  formatMoney,
  today,
  type CurrencyRates,
  type DisplayCurrency,
  type LedgerEvent,
  type WealthSnapshotEvent,
} from "./domain";

export const currencyLabels: Record<DisplayCurrency, string> = {
  BRL: "Real brasileiro",
  USD: "Dólar americano",
  EUR: "Euro",
  GBP: "Libra esterlina",
  CHF: "Franco suíço",
};

/** Only references known by the requested date; never backfill history with future rates. */
export function exchangeRates(
  events: LedgerEvent[],
  asOf = today(),
): CurrencyRates {
  const rates: CurrencyRates = { BRL: 1 };
  for (const event of activeEvents(events)
    .filter((e) => e.date <= asOf)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    )) {
    if (event.type === "quote" && event.currency === "BRL" && event.price > 0) {
      for (const currency of displayCurrencies.filter((c) => c !== "BRL"))
        if (event.assetId === `FX:${currency}/BRL`)
          rates[currency] = event.price;
    }
  }
  return rates;
}

export function snapshotRate(
  point: WealthSnapshotEvent,
  currency: DisplayCurrency,
) {
  return currency === "BRL"
    ? 1
    : (point.currencyRates?.[currency] ??
        (currency === "USD" ? point.fxRate : undefined));
}

export function snapshotValue(
  point: WealthSnapshotEvent,
  currency: DisplayCurrency,
) {
  if (currency === "BRL") return point.totalValue;
  const saved =
    point.currencyValues?.[currency] ??
    (currency === "USD" ? point.usdValue : undefined);
  const rate = snapshotRate(point, currency);
  return saved ?? (rate ? point.totalValue / rate : undefined);
}

export function convertCurrency(
  value: number,
  source: DisplayCurrency,
  target: DisplayCurrency,
  usdBrl: number,
  rates: CurrencyRates = {},
): number | null {
  if (!Number.isFinite(value)) return null;
  if (source === target) return value;
  const references: CurrencyRates = { ...rates, USD: usdBrl, BRL: 1 };
  const from = references[source],
    to = references[target];
  if (
    !from ||
    !to ||
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from <= 0 ||
    to <= 0
  )
    return null;
  return (value * from) / to;
}

/** Conversion for display; ledger amounts and calculation base remain BRL. */
export function moneyDisplay(
  currency: DisplayCurrency,
  usdBrl: number,
  rates: CurrencyRates = {},
) {
  const convert = (value: number, source: DisplayCurrency = "BRL") =>
    convertCurrency(value, source, currency, usdBrl, rates);
  return {
    currency,
    symbol: { BRL: "R$", USD: "US$", EUR: "€", GBP: "£", CHF: "CHF" }[currency],
    usdBrl,
    convert,
    formatMoney(value: number, source: DisplayCurrency = "BRL"): string {
      const amount = convert(value, source);
      return amount === null ? "Sem câmbio" : formatMoney(amount, currency);
    },
    number(value: number): string {
      const amount = convert(value);
      return amount === null
        ? "—"
        : amount.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
    },
    compact(value: number): string {
      const amount = convert(value);
      return amount === null
        ? "—"
        : new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency,
            notation: "compact",
            maximumFractionDigits: 0,
          }).format(amount);
    },
  };
}
