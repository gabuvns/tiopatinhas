export interface Pocket {
  id: string;
  name: string;
  target: number;
  allocations: { assetId: string; amount: number }[];
}

interface PocketAsset {
  assetId: string;
  value: number;
  isEmergencyReserve?: boolean;
}

export function createDefaultPockets(): Pocket[] {
  return [
    {
      id: "fun-spending",
      name: "Banco do Tio Patinhas",
      target: 5000,
      allocations: [],
    },
  ];
}

export function pocketBalances(pockets: Pocket[], positions: PocketAsset[]) {
  const requestedByAsset = new Map<string, number>();
  for (const pocket of pockets)
    for (const allocation of pocket.allocations) {
      requestedByAsset.set(
        allocation.assetId,
        (requestedByAsset.get(allocation.assetId) ?? 0) + allocation.amount,
      );
    }
  const assets = new Map(positions.map((asset) => [asset.assetId, asset]));
  return pockets.map((pocket) => {
    const requested = pocket.allocations.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const total = pocket.allocations.reduce((sum, item) => {
      const asset = assets.get(item.assetId);
      const available =
        asset && !asset.isEmergencyReserve ? Math.max(0, asset.value) : 0;
      const allRequests = requestedByAsset.get(item.assetId) ?? 0;
      return (
        sum +
        (allRequests > 0
          ? (item.amount / allRequests) * Math.min(available, allRequests)
          : 0)
      );
    }, 0);
    return {
      id: pocket.id,
      total,
      requested,
      shortfall: Math.max(0, requested - total),
    };
  });
}

export function availableForPocket(
  asset: PocketAsset,
  pockets: Pocket[],
  editingId: string,
): number {
  if (asset.isEmergencyReserve) return 0;
  const reservedElsewhere = pockets
    .filter((pocket) => pocket.id !== editingId)
    .flatMap((pocket) => pocket.allocations)
    .filter((item) => item.assetId === asset.assetId)
    .reduce((sum, item) => sum + item.amount, 0);
  return Math.max(0, asset.value - reservedElsewhere);
}

export function validatePocket(
  pocket: Pocket,
  pockets: Pocket[],
  assets: PocketAsset[],
): void {
  if (
    !pocket.name.trim() ||
    !Number.isFinite(pocket.target) ||
    pocket.target < 0
  )
    throw new Error("Revise o nome e a meta.");
  const ids = new Set<string>();
  for (const item of pocket.allocations) {
    const asset = assets.find((asset) => asset.assetId === item.assetId);
    if (
      ids.has(item.assetId) ||
      !Number.isFinite(item.amount) ||
      item.amount < 0
    )
      throw new Error("Revise os valores destinados aos ativos.");
    ids.add(item.assetId);
    if (
      !asset ||
      asset.isEmergencyReserve ||
      item.amount > availableForPocket(asset, pockets, pocket.id) + 0.005
    ) {
      throw new Error(
        "A destinação de " +
          item.assetId +
          " ultrapassa o valor disponível fora da reserva.",
      );
    }
  }
}
