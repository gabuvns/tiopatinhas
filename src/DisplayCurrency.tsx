import { createContext, useContext } from 'react';
import { type Currency } from './domain';
import { moneyDisplay } from './money';

export const DisplayCurrencyContext = createContext(moneyDisplay('BRL', 0));
export const useDisplayCurrency = () => useContext(DisplayCurrencyContext);

export function CurrencySwitch({ currency, usdBrl, onChange }: {
  currency: Currency; usdBrl: number; onChange: (currency: Currency) => void;
}) {
  const unavailable = currency === 'BRL' && !(usdBrl > 0);
  return <div className="currency-control" title={unavailable ? 'Atualize as cotações ou informe USD/BRL para ver valores em dólar.' : 'Alternar a moeda de exibição. Conversão pelo câmbio de referência atual.'}>
    <button type="button" className="currency-switch" role="switch" aria-label="Exibir valores em dólar" aria-checked={currency === 'USD'} disabled={unavailable}
      onClick={() => onChange(currency === 'USD' ? 'BRL' : 'USD')}>
      <span className={currency === 'BRL' ? 'currency-active' : ''}>BRL</span><span className="currency-toggle" aria-hidden="true"><i /></span><span className={currency === 'USD' ? 'currency-active' : ''}>USD</span>
    </button>
  </div>;
}
