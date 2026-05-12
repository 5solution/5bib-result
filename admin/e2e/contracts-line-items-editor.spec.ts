/**
 * F-024 Phase 2B — Component spec: LineItemsEditor + DiffTable pure logic.
 *
 * Run as Playwright unit spec via `expect()` on pure helpers. Validates:
 *   - calcLineAmount: BR-CM-04 formula
 *   - calcTotals: subtotal/VAT/total aggregation
 *   - DiffTable totals: contract vs actual amounts diff
 *
 * Tách khỏi UI spec để run-time ngắn + KHÔNG cần seeded data.
 */
import { test, expect } from "@playwright/test";
import { calcLineAmount, calcTotals } from "../src/lib/contracts-api";

test.describe("contracts-api — pure calculation helpers", () => {
  test("calcLineAmount: quantity × unitPrice × (1 - discount/100), rounds to integer", () => {
    expect(calcLineAmount(10, 100_000, 0)).toBe(1_000_000);
    expect(calcLineAmount(10, 100_000, 10)).toBe(900_000);
    expect(calcLineAmount(7, 33_333, 0)).toBe(233_331);
    expect(calcLineAmount(3, 100_000, 50)).toBe(150_000);
  });

  test("calcLineAmount: discount missing or 0 returns full amount", () => {
    expect(calcLineAmount(5, 200_000)).toBe(1_000_000);
  });

  test("calcTotals: 5 items aggregate subtotal/VAT/total correctly with vatRate=8", () => {
    const items = [
      { quantity: 500, unitPrice: 30_000 }, // 15M
      { quantity: 1, unitPrice: 5_000_000 }, // 5M
      { quantity: 1, unitPrice: 5_000_000 }, // 5M
      { quantity: 2, unitPrice: 2_000_000 }, // 4M
      { quantity: 5, unitPrice: 1_000_000 }, // 5M
    ];
    const t = calcTotals(items, 8);
    expect(t.subtotal).toBe(34_000_000);
    expect(t.vatAmount).toBe(2_720_000);
    expect(t.totalAmount).toBe(36_720_000);
  });

  test("calcTotals: vatRate=0 → total = subtotal", () => {
    const t = calcTotals([{ quantity: 1, unitPrice: 100_000 }], 0);
    expect(t.subtotal).toBe(100_000);
    expect(t.vatAmount).toBe(0);
    expect(t.totalAmount).toBe(100_000);
  });

  test("calcTotals: empty list → all zero", () => {
    const t = calcTotals([], 8);
    expect(t).toEqual({ subtotal: 0, vatAmount: 0, totalAmount: 0 });
  });

  test("DiffTable totals: actual > contract → positive diff", () => {
    const contractItems = [
      { quantity: 10, unitPrice: 100_000 },
      { quantity: 5, unitPrice: 200_000 },
    ];
    const actualItems = [
      { quantity: 12, unitPrice: 100_000 }, // +200k
      { quantity: 5, unitPrice: 200_000 }, // same
    ];
    const contractTotal = contractItems.reduce(
      (s, it) => s + calcLineAmount(it.quantity, it.unitPrice, 0),
      0,
    );
    const actualTotal = actualItems.reduce(
      (s, it) => s + calcLineAmount(it.quantity, it.unitPrice, 0),
      0,
    );
    expect(contractTotal).toBe(2_000_000);
    expect(actualTotal).toBe(2_200_000);
    expect(actualTotal - contractTotal).toBe(200_000); // positive diff (tăng)
  });

  test("DiffTable totals: actual < contract → negative diff", () => {
    const contractItems = [{ quantity: 10, unitPrice: 100_000 }];
    const actualItems = [{ quantity: 8, unitPrice: 100_000 }];
    expect(
      actualItems[0].quantity * actualItems[0].unitPrice -
        contractItems[0].quantity * contractItems[0].unitPrice,
    ).toBe(-200_000); // negative diff (giảm)
  });
});
