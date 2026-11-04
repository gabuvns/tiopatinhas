import { formatMoney, type Currency } from './domain';

export function convertCurrency(value: number, source: Currency, target: Currency, usdBrl: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (source === target) return value;
  if (!Number.isFinite(usdBrl) || usdBrl <= 0) return null;
  return source === 'BRL' ? value / usdBrl : value * usdBrl;
}

/** Display conversion only. Ledger amounts, snapshots and calculations remain in BRL. */
export function moneyDisplay(currency: Currency, usdBrl: number) {
  const convert = (value: number, source: Currency = 'BRL') => convertCurrency(value, source, currency, usdBrl);
  return {
    currency, symbol: currency === 'USD' ? 'US$' : 'R$', usdBrl, convert,
    formatMoney(value: number, source: Currency = 'BRL'): string {
      const amount = convert(value, source);
      return amount === null ? 'Sem câmbio' : formatMoney(amount, currency);
    },
    number(value: number): string {
      const amount = convert(value);
      return amount === null ? '—' : amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    compact(value: number): string {
      const amount = convert(value);
      return amount === null ? '—' : new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency, notation: 'compact', maximumFractionDigits: 0,
      }).format(amount);
    },
  };
}
