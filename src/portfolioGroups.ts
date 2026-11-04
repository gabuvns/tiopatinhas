const categoryOrder = ['Renda fixa', 'Ações', 'FIIs', 'ETFs', 'Stocks', 'REITs', 'Fixed income', 'Bitcoin', 'Altcoins',
  'FGTS', 'Previdência', 'Imóveis', 'Empresas', 'Metais preciosos', 'Obras de arte', 'Veículos', 'Joias', 'Outro'];

export function groupAssets<T extends { assetClass: string; value: number }>(assets: T[], portfolioTotal: number) {
  const groups = new Map<string, T[]>();
  for (const asset of assets) groups.set(asset.assetClass, [...(groups.get(asset.assetClass) ?? []), asset]);
  return [...groups.entries()].map(([category, items]) => {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    return { category, assets: items, total, percent: portfolioTotal > 0 ? total / portfolioTotal * 100 : 0 };
  }).sort((a, b) => {
    const rank = (category: string) => categoryOrder.includes(category) ? categoryOrder.indexOf(category) : categoryOrder.length;
    return rank(a.category) - rank(b.category) || a.category.localeCompare(b.category, 'pt-BR');
  });
}
