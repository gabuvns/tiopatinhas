import { emptyData, type AppData } from "../../infrastructure/store";
import { makeEvent, today } from "../../domain/domain";
export function demoData(): AppData {
  const data = emptyData();
  const currencyRates = { BRL: 1, USD: 5, EUR: 6, GBP: 7.5, CHF: 6.25 };
  const now = new Date();
  for (let m = 23; m >= 0; m--) {
    const date = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const day = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      "01",
    ].join("-");
    const total = 30000 + (23 - m) * 2200;
    data.events.push(
      makeEvent({
        type: "investment_contribution",
        date: day,
        amount: 2200,
        liquidity: "liquid",
        category: "Aporte fictício mensal",
      }),
      makeEvent({
        type: "income",
        date: day,
        category: "Salário",
        amount: 8000,
        memo: "Marina Costa · dados fictícios",
      }),
      makeEvent({
        type: "expense",
        date: day,
        category: "Mercado",
        amount: 1600,
      }),
      makeEvent({
        type: "expense",
        date: day,
        category: "Cartão",
        cardName: "Cartão demonstração",
        amount: 3100,
      }),
      makeEvent({
        type: "wealth_snapshot",
        date: day,
        totalValue: total,
        usdValue: total / 5,
        fxRate: 5,
        liquidValue: total,
        illiquidValue: 0,
        currencyRates: { ...currencyRates },
        currencyValues: Object.fromEntries(
          Object.entries(currencyRates).map(([code, rate]) => [
            code,
            total / rate,
          ]),
        ),
        byCategory: { "Renda fixa": total * 0.6, ETFs: total * 0.4 },
      }),
    );
  }
  data.events.push(
    makeEvent({
      type: "opening_position",
      date: today(),
      assetId: "DEMO-RF",
      ticker: "DEMO-RF",
      name: "Reserva fictícia de Marina",
      geography: "Brasil",
      assetClass: "Renda fixa",
      currency: "BRL",
      quantity: 1,
      marketPrice: 48000,
      averageCost: null,
      precision: 0,
      balanceBased: true,
    }),
    makeEvent({
      type: "opening_position",
      date: today(),
      assetId: "DEMO-ETF",
      ticker: "DEMO-ETF",
      name: "Fundo global fictício",
      geography: "Exterior",
      assetClass: "ETFs",
      currency: "USD",
      quantity: 60,
      marketPrice: 100,
      averageCost: 80,
      precision: 0,
    }),
    ...(["USD", "EUR", "GBP", "CHF"] as const).map((code) =>
      makeEvent({
        type: "quote",
        date: today(),
        assetId: `FX:${code}/BRL`,
        ticker: `${code}/BRL`,
        price: currencyRates[code],
        currency: "BRL",
        source: "Demonstração fictícia",
        fetchedAt: new Date().toISOString(),
      }),
    ),
  );
  data.settings.pockets = [
    {
      id: "fun-spending",
      name: "Banco do Tio Patinhas",
      target: 5000,
      allocations: [{ assetId: "DEMO-RF", amount: 2000 }],
    },
  ];
  return data;
}
