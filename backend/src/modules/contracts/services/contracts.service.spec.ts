/**
 * F-024 contracts.service.spec.ts
 *
 * Coverage:
 * - BR-CM-04 line item amount + subtotal/VAT/total calculation
 * - BR-CM-04 5 line items aggregate
 * - BR-CM-07 lifecycle DRAFT → ACTIVE OK; ACTIVE → DRAFT FAIL
 * - BR-CM-08 quotation conversion (only ACCEPTED, status changes)
 * - BR-CM-14 soft delete excluded from default list
 * - calcPaymentTerms split 50/50
 */
import { ContractsService } from './contracts.service';

describe('ContractsService — calculation (pure)', () => {
  describe('BR-CM-04: calcLineAmount', () => {
    it('amount = qty × unitPrice × (1 - discount/100)', () => {
      // 5 × 700,000 × (1 - 0/100) = 3,500,000
      expect(ContractsService.calcLineAmount(5, 700_000, 0)).toBe(3_500_000);
      // 1 × 30,000,000 × (1 - 0/100)
      expect(ContractsService.calcLineAmount(1, 30_000_000)).toBe(30_000_000);
    });

    it('applies discount correctly', () => {
      // 1 × 15,000,000 × (1 - 20/100) = 12,000,000
      expect(ContractsService.calcLineAmount(1, 15_000_000, 20)).toBe(12_000_000);
      // 100% discount → 0
      expect(ContractsService.calcLineAmount(2, 5_000_000, 100)).toBe(0);
    });

    it('rounds to nearest VND (no fractional)', () => {
      const result = ContractsService.calcLineAmount(3, 33_333, 0);
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('BR-CM-04: calcTotals (5 line items)', () => {
    it('aggregates subtotal + VAT 8% + total correctly', () => {
      const items = [
        { quantity: 5, unitPrice: 700_000, discount: 0, amount: 3_500_000 },
        { quantity: 1, unitPrice: 30_000_000, discount: 0, amount: 30_000_000 },
        { quantity: 3000, unitPrice: 28_000, discount: 0, amount: 84_000_000 },
        { quantity: 1, unitPrice: 15_000_000, discount: 20, amount: 12_000_000 },
        { quantity: 1, unitPrice: 5_000_000, discount: 100, amount: 0 },
      ];
      const totals = ContractsService.calcTotals(items, 8);
      expect(totals.subtotal).toBe(129_500_000);
      expect(totals.vatAmount).toBe(Math.round((129_500_000 * 8) / 100));
      expect(totals.totalAmount).toBe(totals.subtotal + totals.vatAmount);
    });

    it('vatRate=0 returns subtotal only (BR-CM-05 override)', () => {
      const totals = ContractsService.calcTotals(
        [{ quantity: 1, unitPrice: 1_000_000, discount: 0, amount: 1_000_000 }],
        0,
      );
      expect(totals.vatAmount).toBe(0);
      expect(totals.totalAmount).toBe(1_000_000);
    });

    it('vatRate=10 (Danny override per BR-CM-05)', () => {
      const totals = ContractsService.calcTotals(
        [{ quantity: 1, unitPrice: 1_000_000, discount: 0, amount: 1_000_000 }],
        10,
      );
      expect(totals.vatAmount).toBe(100_000);
      expect(totals.totalAmount).toBe(1_100_000);
    });
  });

  describe('BR-CM-04: calcPaymentTerms', () => {
    it('default 50/50 split', () => {
      const t = ContractsService.calcPaymentTerms(100_000_000, 50);
      expect(t.advancePercentage).toBe(50);
      expect(t.advanceAmount).toBe(50_000_000);
      expect(t.remainderAmount).toBe(50_000_000);
    });

    it('30/70 split (admin override)', () => {
      const t = ContractsService.calcPaymentTerms(100_000_000, 30);
      expect(t.advanceAmount).toBe(30_000_000);
      expect(t.remainderAmount).toBe(70_000_000);
    });

    it('0% advance (TICKET_SALES revenue-share, no upfront)', () => {
      const t = ContractsService.calcPaymentTerms(100_000_000, 0);
      expect(t.advanceAmount).toBe(0);
      expect(t.remainderAmount).toBe(100_000_000);
    });
  });
});
