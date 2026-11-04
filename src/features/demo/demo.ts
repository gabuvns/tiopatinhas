import { emptyData, type AppData } from "../../infrastructure/store";
import {
  buildPortfolio,
  makeEvent,
  today,
  type CurrencyRates,
} from "../../domain/domain";
import {
  demoIlliquidAssets,
  demoLiquidAssets,
  type DemoLiquidAsset,
} from "./catalog";

const money = (value: number) => Math.round(value * 100) / 100;
const source = "Demonstração fictícia";

/** A reproducible fictional household, always limited to the reference date. */
export function demoData(asOf = today()): AppData {
  const data = emptyData();
  const now = new Date(asOf + "T12:00:00");
  let sequence = 0;
  const add = (value: Parameters<typeof makeEvent>[0]) => {
    const event = makeEvent(value);
    event.createdAt = new Date(
      Date.parse(value.date + "T12:00:00Z") + sequence++,
    ).toISOString();
    data.events.push(event);
  };
  const first = new Date(now.getFullYear(), now.getMonth() - 35, 1);
  const dateString = (date: Date) =>
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  const start = dateString(first);
  for (const asset of demoLiquidAssets) {
    const { price, ...position } = asset;
    add({
      ...position,
      type: "opening_position",
      date: start,
      marketPrice: price,
      averageCost: price * 0.92,
      rebalanceEligible: !asset.balanceBased,
      memo: "Marina Costa · dados fictícios; patrimônio anterior ao histórico de aportes",
    });
  }
  for (const { monthlyChange: _, ...asset } of demoIlliquidAssets)
    add({ ...asset, type: "illiquid_valuation", date: start, memo: source });
  add({
    type: "reserve_classification",
    date: start,
    assetId: "DEMO-RF",
    isEmergencyReserve: true,
  });

  const weights: Record<string, number> = {
    "DEMO-ETF": 25,
    "DEMO-EMERGENTES": 10,
    "DEMO-BOND": 10,
    "DEMO-BTC": 8,
    "DEMO-ETH": 4,
    "DEMO-SOL": 3,
  };
  for (const asset of demoLiquidAssets.filter((a) => !a.balanceBased))
    add({
      type: "target",
      date: start,
      assetId: asset.assetId,
      ticker: asset.ticker,
      targetPercent:
        weights[asset.assetId] ?? (asset.assetClass === "Ações" ? 4 : 3),
    });
  data.settings.milestones = [
    50000, 100000, 200000, 300000, 1000000, 3000000, 5000000, 7500000, 10000000,
  ];
  const reached = new Set<number>();
  const contributed = new Map<string, number>();

  for (let month = 0; month < 36; month++) {
    const date = new Date(first.getFullYear(), first.getMonth() + month, 1);
    const lastDay =
      month === 35
        ? now.getDate()
        : new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const on = (day: number) =>
      dateString(
        new Date(date.getFullYear(), date.getMonth(), Math.min(day, lastDay)),
      );
    const end = on(lastDay);
    const usd =
      Math.round((5 + 0.18 * Math.sin(month / 4) + month * 0.008) * 10000) /
      10000;
    const rates = {
      BRL: 1,
      USD: usd,
      EUR: money(usd * 1.1),
      GBP: money(usd * 1.29),
      CHF: money(usd * 1.14),
    };
    for (const code of ["USD", "EUR", "GBP", "CHF"] as const)
      add({
        type: "quote",
        date: on(1),
        assetId: `FX:${code}/BRL`,
        ticker: `${code}/BRL`,
        price: rates[code],
        currency: "BRL",
        source,
        fetchedAt: on(1) + "T12:00:00Z",
      });

    const salary = month < 12 ? 32000 : month < 24 ? 36000 : 42000;
    if (month % 12 === 0)
      add({
        type: "salary_change",
        date: on(1),
        monthlyAmount: salary,
        memo: "Remuneração fictícia de Marina",
      });
    add({
      type: "income",
      date: on(5),
      category: "Salário",
      amount: salary,
      memo: "Marina Costa · dados fictícios",
    });
    add({
      type: "income",
      date: on(12),
      category: "Dividendos",
      amount: 1800 + month * 35 + (month % 6) * 120,
      memo: "Dividendos e rendimentos fictícios da carteira",
    });
    if (month % 3 === 0)
      add({
        type: "income",
        date: on(18),
        category: "Renda extra",
        amount: 4500 + month * 35,
        memo: "Projeto de consultoria fictício",
      });
    add({
      type: "expense",
      date: on(8),
      category: "Cartão",
      cardName: "Cartão Aurora",
      amount: 4600 + (month % 5) * 250,
      memo: "Fatura mensal paga; sem duplicar compras",
    });
    add({
      type: "expense",
      date: on(15),
      category: "Cartão",
      cardName: "Cartão Horizonte",
      amount: 2800 + (month % 4) * 180,
      memo: "Fatura mensal paga",
    });
    add({
      type: "expense",
      date: on(10),
      category: "Mercado",
      amount: 2800 + month * 25 + (month % 3) * 170,
      memo: "Compras do mês",
    });
    add({
      type: "expense",
      date: on(20),
      category: "PIX",
      amount: 3200 + (month % 4) * 150,
      memo: "Serviços, saúde e manutenção",
    });
    add({
      type: "expense",
      date: on(22),
      category: "Outro",
      amount: 1200 + (month % 6) * 130,
      memo: "Lazer e viagens",
    });

    const priceAt = (asset: DemoLiquidAsset) =>
      money(
        asset.price *
          (1 +
            month *
              (asset.balanceBased
                ? 0.005
                : asset.geography === "Cripto"
                  ? 0.012
                  : 0.006) +
            (asset.balanceBased
              ? 0
              : Math.sin(month / 2 + demoLiquidAssets.indexOf(asset)) * 0.045)),
      );
    const trade = (
      asset: DemoLiquidAsset,
      quantity: number,
      side: "COMPRA" | "VENDA",
    ) =>
      add({
        type: "trade",
        date: on(side === "COMPRA" ? 16 : 25),
        side,
        assetId: asset.assetId,
        ticker: asset.ticker,
        name: asset.name,
        geography: asset.geography,
        assetClass: asset.assetClass,
        currency: asset.currency,
        precision: asset.precision,
        quantity,
        unitPrice: priceAt(asset),
        ...(asset.currency === "USD" ? { fxRate: usd } : {}),
        memo:
          side === "COMPRA"
            ? "Aporte mensal fictício"
            : "Venda histórica fictícia; não é sugestão de rebalanceamento",
      });
    for (const [id, quantity] of [
      ["DEMO-ETF", 4],
      ["DEMO-BTC", 0.008],
      ["DEMO-BOND", 3],
    ] as const)
      trade(
        demoLiquidAssets.find((a) => a.assetId === id)!,
        quantity,
        "COMPRA",
      );
    const rotating = demoLiquidAssets.filter(
      (a) =>
        !a.balanceBased &&
        !["DEMO-ETF", "DEMO-BTC", "DEMO-BOND"].includes(a.assetId),
    );
    for (const index of [
      month % rotating.length,
      (month + 7) % rotating.length,
    ]) {
      const asset = rotating[index];
      const units =
        1500 / (priceAt(asset) * (asset.currency === "USD" ? usd : 1));
      const quantity = asset.precision
        ? Math.floor(units * 1e8) / 1e8
        : Math.max(1, Math.floor(units));
      trade(asset, quantity, "COMPRA");
    }
    if (month % 3 === 2) {
      trade(
        demoLiquidAssets.find((a) => a.assetId === "DEMO-DIV")!,
        5,
        "VENDA",
      );
      trade(
        demoLiquidAssets.find((a) => a.assetId === "DEMO-FII-RENDA")!,
        10,
        "VENDA",
      );
    }
    for (const id of ["DEMO-FGTS", "DEMO-PGBL"]) {
      const asset = demoIlliquidAssets.find((a) => a.assetId === id)!;
      const amount = id === "DEMO-FGTS" ? 1800 + month * 20 : 3000;
      contributed.set(id, (contributed.get(id) ?? 0) + amount);
      add({
        type: "illiquid_contribution",
        date: on(24),
        assetId: id,
        name: asset.name,
        assetClass: asset.assetClass,
        amount,
        memo: "Aporte fictício, distinto das compras de ativos líquidos",
      });
    }
    if (month % 3 === 2)
      for (const asset of demoIlliquidAssets)
        add({
          type: "illiquid_valuation",
          date: end,
          assetId: asset.assetId,
          name: asset.name,
          assetClass: asset.assetClass,
          amount: money(
            asset.amount * Math.pow(1 + asset.monthlyChange, month + 1) +
              (contributed.get(asset.assetId) ?? 0),
          ),
          memo: "Reavaliação trimestral fictícia, já incluindo os aportes anteriores",
        });
    for (const asset of demoLiquidAssets)
      add({
        type: "quote",
        date: end,
        assetId: asset.assetId,
        ticker: asset.ticker,
        price: priceAt(asset),
        currency: asset.currency,
        source,
        fetchedAt: end + "T12:00:00Z",
      });

    const portfolio = buildPortfolio(data.events, usd);
    const byCategory: Record<string, number> = {};
    for (const asset of [...portfolio.positions, ...portfolio.illiquidAssets])
      byCategory[asset.assetClass] =
        (byCategory[asset.assetClass] ?? 0) + asset.value;
    const currencyValues: CurrencyRates = {};
    for (const code of ["BRL", "USD", "EUR", "GBP", "CHF"] as const)
      currencyValues[code] = portfolio.totalValue / rates[code];
    add({
      type: "wealth_snapshot",
      date: end,
      totalValue: portfolio.totalValue,
      liquidValue: portfolio.liquidValue,
      illiquidValue: portfolio.illiquidValue,
      usdValue: currencyValues.USD,
      fxRate: usd,
      currencyRates: rates,
      currencyValues,
      byCategory,
      memo: "Snapshot mensal calculado dos eventos fictícios de Marina",
    });
    for (const threshold of data.settings.milestones)
      if (portfolio.totalValue >= threshold && !reached.has(threshold)) {
        add({ type: "milestone", date: end, threshold });
        reached.add(threshold);
      }
  }
  data.settings.pockets = [
    {
      id: "fun-spending",
      name: "Banco do Tio Patinhas",
      target: 50000,
      allocations: [
        { assetId: "DEMO-CDB", amount: 30000 },
        { assetId: "DEMO-LCI", amount: 2000 },
      ],
    },
    {
      id: "viagens",
      name: "Viagem em família",
      target: 100000,
      allocations: [
        { assetId: "DEMO-CDB", amount: 40000 },
        { assetId: "DEMO-LCI", amount: 15000 },
      ],
    },
    {
      id: "reforma",
      name: "Reforma da casa",
      target: 200000,
      allocations: [
        { assetId: "DEMO-TESOURO", amount: 70000 },
        { assetId: "DEMO-LCI", amount: 20000 },
      ],
    },
    {
      id: "estudos",
      name: "Estudos e novos projetos",
      target: 45000,
      allocations: [{ assetId: "DEMO-CDB", amount: 18000 }],
    },
  ];
  return data;
}
