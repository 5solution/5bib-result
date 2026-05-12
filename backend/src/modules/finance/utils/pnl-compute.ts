/**
 * F-028 BR-PNL-06 + BR-PNL-07 — Pure function P&L compute.
 *
 * KHÔNG side effect. Unit testable không cần mock.
 *
 *   profit = revenue - totalCost
 *   margin = revenue > 0 ? (profit / revenue) * 100 : null
 *
 * Margin được round 1 chữ số thập phân (PRD BR-PNL-07).
 */

export type RevenueSource = 'ESTIMATED' | 'ACTUAL';

export interface PnLInput {
  revenue: number;
  totalCost: number;
  /** Estimated khi revenue dựa contract.totalAmount / fallback. Actual khi BBNT FINALIZED hoặc TICKET_SALES order paid. */
  revenueSource: RevenueSource;
}

export interface PnLOutput {
  revenue: number;
  totalCost: number;
  profit: number;
  /** null khi revenue=0 (BR-PNL-07 divide-by-zero guard). */
  margin: number | null;
  revenueSource: RevenueSource;
  /** UI hint: "loss" | "thin" | "healthy" | "neutral" — BR-PNL-20. */
  marginTier: 'loss' | 'thin' | 'healthy' | 'neutral';
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function classifyMargin(margin: number | null): PnLOutput['marginTier'] {
  if (margin === null) return 'neutral';
  if (margin < 0) return 'loss';
  if (margin <= 10) return 'thin';
  return 'healthy';
}

export function computePnL(input: PnLInput): PnLOutput {
  const revenue = Number(input.revenue) || 0;
  const totalCost = Number(input.totalCost) || 0;
  const profit = revenue - totalCost;
  const margin = revenue === 0 ? null : round1((profit / revenue) * 100);

  return {
    revenue,
    totalCost,
    profit,
    margin,
    revenueSource: input.revenueSource,
    marginTier: classifyMargin(margin),
  };
}

/**
 * Aggregate cost amounts per category cho donut chart breakdown (Screen 3).
 */
export interface CategoryBreakdownInput {
  category: string;
  amount: number;
}

export function aggregateByCategory(
  items: CategoryBreakdownInput[],
): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const it of items) {
    acc[it.category] = (acc[it.category] ?? 0) + (Number(it.amount) || 0);
  }
  return acc;
}
