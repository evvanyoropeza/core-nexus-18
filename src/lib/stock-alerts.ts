type StockLevels = {
  type: string;
  stock_current: number | string;
  stock_min: number | string;
  is_active: boolean;
};

export function getStockAlert(product: StockLevels) {
  const current = Number(product.stock_current);
  const minimum = Number(product.stock_min);
  if (product.type !== "product" || !product.is_active || minimum <= 0 ||
      !Number.isFinite(current) || !Number.isFinite(minimum) || current > minimum) return null;
  return {
    status: current < minimum ? "below_minimum" as const : "at_minimum" as const,
    current,
    minimum,
    replenishment: Math.round(Math.max(0, minimum - current) * 10000) / 10000,
  };
}