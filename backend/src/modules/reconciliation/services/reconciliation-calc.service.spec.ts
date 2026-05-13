/**
 * FEATURE-030 — unit tests for ReconciliationCalcService.buildLineItems()
 *
 * Cover sub-bug discovered during F-030 trace:
 * `total_add_on_price` (order-level field từ MySQL) bị aggregate per-row →
 * over-count nếu 1 order có ≥2 line items. Fix: dedup by order_id Set giống
 * pattern `discount_amount`.
 *
 * Test cases mandatory per Manager Plan F-030:
 * - TC-AO-01: dedup add_on_price khi 1 order có multi line items
 * - TC-AO-02: Zaha fixture pattern (9 line items + add-on 299K) — gross total match
 * - TC-AO-03: order KHÔNG có add-on → add_on_price = 0
 * - TC-AO-04: multi orders mix có/không add-on → aggregate đúng
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationCalcService } from './reconciliation-calc.service';

describe('ReconciliationCalcService.buildLineItems — FEATURE-030 add-on dedup', () => {
  let service: ReconciliationCalcService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReconciliationCalcService],
    }).compile();
    service = module.get<ReconciliationCalcService>(ReconciliationCalcService);
  });

  // Helper: build a "line item row" mock matching MySQL JOIN shape
  function row(opts: {
    order_id: number;
    order_category?: string;
    type_name?: string;
    distance?: string;
    line_price?: number;
    origin_price?: number;
    qty?: number;
    total_discounts?: number;
    total_add_on_price?: number;
    subtotal_price?: number;
  }) {
    return {
      order_id: opts.order_id,
      order_category: opts.order_category ?? 'ORDINARY',
      type_name: opts.type_name ?? 'Regular',
      distance: opts.distance ?? '10KM',
      line_price: opts.line_price ?? 500000,
      origin_price: opts.origin_price ?? 500000,
      qty: opts.qty ?? 1,
      total_discounts: opts.total_discounts ?? 0,
      total_add_on_price: opts.total_add_on_price ?? 0,
      subtotal_price: opts.subtotal_price ?? 500000,
    };
  }

  it('TC-AO-01: dedup add_on_price khi 1 order có 3 line items (CRITICAL bug fix)', () => {
    // 1 order có 3 line items khác BIB (vd: 1 person mua 3 vé team).
    // `total_add_on_price` là order-level = 100,000 (1 áo cho cả order).
    // Mọi 3 rows đều mang giá trị 100,000 (replicated qua JOIN).
    // Pre-F-030 bug: cộng 3 lần = 300,000.
    // Post-fix: dedup by order_id → 100,000 đúng.
    const rows = [
      row({ order_id: 1, line_price: 500000, qty: 1, total_add_on_price: 100000, subtotal_price: 1600000 }),
      row({ order_id: 1, line_price: 500000, qty: 1, total_add_on_price: 100000, subtotal_price: 1600000 }),
      row({ order_id: 1, line_price: 500000, qty: 1, total_add_on_price: 100000, subtotal_price: 1600000 }),
    ];

    const lineItems = service.buildLineItems(rows);

    expect(lineItems).toHaveLength(1); // gộp cùng ticket_type|distance
    expect(lineItems[0].quantity).toBe(3); // per-row aggregate qty
    expect(lineItems[0].subtotal).toBe(1500000); // 3 × (500K × 1) — line items only
    expect(lineItems[0].add_on_price).toBe(100000); // ✅ DEDUP — KHÔNG 300K
    expect(lineItems[0].discount_amount).toBe(0);
  });

  it('TC-AO-02: Zaha fixture pattern — 9 line items + 1 add-on 299K', () => {
    // Mô phỏng case PROD Zaha tháng 4: 9 distinct ticket type rows, 34 BIB total,
    // 1 order có add-on 299K. Verify aggregate đúng + line items breakdown match.
    const rows = [
      // 21KM Ưu đãi (1 BIB) — order 100 có add-on 299K
      row({ order_id: 100, distance: '21KM', type_name: 'Ưu đãi Chào tháng 4', line_price: 533200, qty: 1, total_add_on_price: 299000, subtotal_price: 832200 }),
      // 10KM Ưu đãi (1 BIB) — order 101
      row({ order_id: 101, distance: '10KM', type_name: 'Ưu đãi Chào tháng 4', line_price: 430000, qty: 1, subtotal_price: 430000 }),
      // 10KM Regular (8 BIB) — order 102 multi-line
      row({ order_id: 102, distance: '10KM', type_name: 'Regular', line_price: 500000, qty: 8, subtotal_price: 4000000 }),
      // 42KM Regular (3 BIB) — order 103
      row({ order_id: 103, distance: '42KM', type_name: 'Regular', line_price: 660000, qty: 3, subtotal_price: 1980000 }),
      // 5KM Regular (8 BIB) — order 104
      row({ order_id: 104, distance: '5KM', type_name: 'Regular', line_price: 450000, qty: 8, subtotal_price: 3600000 }),
      // 21KM Regular (3 BIB) — order 105
      row({ order_id: 105, distance: '21KM', type_name: 'Regular', line_price: 620000, qty: 3, subtotal_price: 1860000 }),
      // 5KM Late (1 BIB) — order 106
      row({ order_id: 106, distance: '5KM', type_name: 'Late', line_price: 600000, qty: 1, subtotal_price: 600000 }),
      // 21KM Late (1 BIB) — order 107
      row({ order_id: 107, distance: '21KM', type_name: 'Late', line_price: 800000, qty: 1, subtotal_price: 800000 }),
      // 5KM FLASH SALES (8 BIB) — order 108
      row({ order_id: 108, distance: '5KM', type_name: 'FLASH SALES 30/04', line_price: 540000, qty: 8, subtotal_price: 4320000 }),
    ];

    const lineItems = service.buildLineItems(rows);

    expect(lineItems).toHaveLength(9);

    const totalAddOn = lineItems.reduce((s, li) => s + li.add_on_price, 0);
    const totalSubtotal = lineItems.reduce((s, li) => s + li.subtotal, 0);
    const totalQty = lineItems.reduce((s, li) => s + li.quantity, 0);

    expect(totalAddOn).toBe(299000); // ✅ 1 add-on duy nhất
    expect(totalSubtotal).toBe(18123200); // line items only — match XLSX Section 3 Tổng cũ
    expect(totalQty).toBe(34); // 1+1+8+3+8+3+1+1+8 = 34 BIB
    // Section 1 gross_revenue (= sum subtotal_price unique orders) sẽ là
    // 832200+430000+4000000+1980000+3600000+1860000+600000+800000+4320000 = 18,422,200
    // → totalSubtotal + totalAddOn = 18,123,200 + 299,000 = 18,422,200 ✓ match gross
    expect(totalSubtotal + totalAddOn).toBe(18422200);
  });

  it('TC-AO-03: order KHÔNG có add-on → add_on_price = 0', () => {
    const rows = [
      row({ order_id: 200, line_price: 500000, qty: 1, total_add_on_price: 0, subtotal_price: 500000 }),
      row({ order_id: 201, line_price: 500000, qty: 2, total_add_on_price: 0, subtotal_price: 1000000 }),
    ];

    const lineItems = service.buildLineItems(rows);

    expect(lineItems).toHaveLength(1); // cùng ticket_type|distance
    expect(lineItems[0].quantity).toBe(3);
    expect(lineItems[0].subtotal).toBe(1500000);
    expect(lineItems[0].add_on_price).toBe(0);
  });

  it('TC-AO-04: multi orders mix có/không add-on → aggregate đúng', () => {
    // Order 300 có add-on 50K (2 line items — should NOT double-count)
    // Order 301 không add-on
    // Order 302 có add-on 75K (single line item)
    const rows = [
      // Order 300 — 2 line items, add-on 50K
      row({ order_id: 300, line_price: 500000, qty: 1, total_add_on_price: 50000, subtotal_price: 1050000 }),
      row({ order_id: 300, line_price: 500000, qty: 1, total_add_on_price: 50000, subtotal_price: 1050000 }),
      // Order 301 — 1 line item, no add-on
      row({ order_id: 301, line_price: 500000, qty: 1, total_add_on_price: 0, subtotal_price: 500000 }),
      // Order 302 — 1 line item, add-on 75K
      row({ order_id: 302, line_price: 500000, qty: 1, total_add_on_price: 75000, subtotal_price: 575000 }),
    ];

    const lineItems = service.buildLineItems(rows);

    // Tất cả gộp cùng ticket_type|distance (key 'Regular|10KM')
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0].quantity).toBe(4); // 1+1+1+1
    expect(lineItems[0].subtotal).toBe(2000000); // 4 × 500K
    expect(lineItems[0].add_on_price).toBe(125000); // 50K (order 300 dedup) + 75K (order 302), NOT 175K
  });

  it('TC-AO-05: CHANGE_COURSE category preserves dedup pattern cho add_on (defensive)', () => {
    // CHANGE_COURSE đã dedup subtotal + discount theo order_id (line 111-115 cũ).
    // F-030 cũng phải dedup add_on_price cho CHANGE_COURSE branch.
    const rows = [
      row({
        order_id: 400,
        order_category: 'CHANGE_COURSE',
        distance: '21KM',
        type_name: 'Regular',
        line_price: 620000,
        subtotal_price: 100000, // phí đổi cự ly
        total_add_on_price: 30000,
      }),
      // Same order 400, second line item (CHANGE_COURSE thường 1 line nhưng JOIN có thể replicate)
      row({
        order_id: 400,
        order_category: 'CHANGE_COURSE',
        distance: '21KM',
        type_name: 'Regular',
        line_price: 620000,
        subtotal_price: 100000,
        total_add_on_price: 30000,
      }),
    ];

    const lineItems = service.buildLineItems(rows);

    // CHANGE_COURSE key bao gồm subtotal_price → cùng key
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0].order_category).toBe('CHANGE_COURSE');
    expect(lineItems[0].subtotal).toBe(100000); // dedup (chỉ 1 subtotal_price)
    expect(lineItems[0].add_on_price).toBe(30000); // ✅ DEDUP — KHÔNG 60K
  });
});
