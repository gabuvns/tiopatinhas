import { createContext, useContext } from "react";
import {
  displayCurrencies,
  type CurrencyRates,
  type DisplayCurrency,
} from "../domain/domain";
import { currencyLabels, moneyDisplay } from "../domain/money";

export const DisplayCurrencyContext = createContext(moneyDisplay("BRL", 0));
export const useDisplayCurrency = () => useContext(DisplayCurrencyContext);

export function CurrencySwitch({
  currency,
  usdBrl,
  rates = {},
  onChange,
}: {
  currency: DisplayCurrency;
  usdBrl: number;
  rates?: CurrencyRates;
  onChange: (currency: DisplayCurrency) => void;
}) {
  const available =
    currency === "BRL" || (currency === "USD" ? usdBrl : rates[currency]);
  return (
    <label
      className="currency-control"
      title="Moeda de exibição. Atualize as cotações ou informe o câmbio manualmente na carteira."
    >
      <span className="sr-only">Moeda de exibição</span>
      <select
        aria-label="Moeda de exibição"
        value={currency}
        onChange={(e) => onChange(e.target.value as DisplayCurrency)}
      >
        {displayCurrencies.map((code) => (
          <option key={code} value={code}>
            {code} · {currencyLabels[code]}
          </option>
        ))}
      </select>
      {!available && (
        <span role="status" className="currency-missing">
          Sem câmbio
        </span>
      )}
    </label>
  );
}
