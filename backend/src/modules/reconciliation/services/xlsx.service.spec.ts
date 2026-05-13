/**
 * FEATURE-030 — Smoke test XLSX render for add-on visual fix.
 *
 * Verify col 6 "Thành tiền áo" renders `li.add_on_price` (not hardcoded 0)
 * and bottom Tổng row col 8 grandTotal includes add-on.
 *
 * Stub `src/config` env loader giống pattern reconciliation.service.spec.ts.
 */
jest.mock(
  'src/config',
  () => ({
    env: {
      s3: { bucket: 'test', region: 'ap-southeast-1' },
      provider: {
        companyName: 'CÔNG TY CỔ PHẦN 5BIB',
        address: 'TEST ADDRESS',
        taxCode: '0110398986',
        phone: '0373398986',
        representativeName: 'Nguyễn Bình Minh',
        representativeTitle: 'Giám Đốc',
        bankAccount: '110398986',
        bankName: 'MB',
      },
    },
  }),
  { virtual: true },
);

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
}));

import { XlsxService } from './xlsx.service';
import * as ExcelJS from 'exceljs';

describe('XlsxService — FEATURE-030 add-on visual render', () => {
  const xlsxSvc = new XlsxService();

  // Zaha fixture (simplified) — 1 line item có add-on 299K
  const rec: any = {
    tenant_id: 1,
    tenant_name: 'CÔNG TY CỔ PHẦN ZAHA VIỆT NAM',
    race_title: 'Hai Phong Legacy Marathon 2026',
    period_start: '2026-04-01',
    period_end: '2026-04-30',
    fee_rate_applied: 5.5,
    fee_vat_rate: 0,
    manual_fee_per_ticket: 5000,
    gross_revenue: 18422200,
    total_discount: 0,
    net_revenue: 18422200,
    fee_amount: 1013221,
    fee_vat_amount: 0,
    manual_ticket_count: 0,
    manual_gross_revenue: 0,
    manual_fee_amount: 0,
    payout_amount: 17408979,
    manual_adjustment: 0,
    adjustment_note: null,
    status: 'ready',
    flags: [],
    created_source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
    signed_at: null,
    raw_5bib_orders: [],
    raw_manual_orders: [],
    manual_orders: [],
    line_items: [
      // Row có add-on
      { order_category: 'ORDINARY', ticket_type_name: 'Ưu đãi', distance_name: '21KM', unit_price: 533200, quantity: 1, discount_amount: 0, subtotal: 533200, add_on_price: 299000 },
      // Row KHÔNG có add-on
      { order_category: 'ORDINARY', ticket_type_name: 'Regular', distance_name: '10KM', unit_price: 500000, quantity: 8, discount_amount: 0, subtotal: 4000000, add_on_price: 0 },
    ],
  };

  it('TC-AO-06: XLSX Section 3 renders li.add_on_price in col 6 + grandTotal includes add-on', async () => {
    const buf = await xlsxSvc.generate(rec);
    expect(buf.length).toBeGreaterThan(1000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];

    // Find row containing 'Tổng' label in col 1 (Section 3 bottom Tổng row)
    let totalsRow = -1;
    for (let r = 1; r <= 100; r++) {
      if (ws.getCell(r, 1).value === 'Tổng') {
        totalsRow = r;
        break;
      }
    }
    expect(totalsRow).toBeGreaterThan(0);

    // Col 6 (Thành tiền áo) bottom row = sum of add_on_price = 299000
    const totalAddOn = ws.getCell(totalsRow, 6).value;
    expect(totalAddOn).toBe(299000);

    // Col 8 (Tổng cộng) bottom row = sum(li.subtotal + li.add_on_price)
    // = (533200 + 299000) + (4000000 + 0) = 4832200
    const grandTotal = ws.getCell(totalsRow, 8).value;
    expect(grandTotal).toBe(4832200);

    // Per-line check: first data row (Ưu đãi 21KM) col 6 = 299000
    // Header rows: section title + blank + col headers + sub-labels = ~4 rows before data
    let firstDataRow = -1;
    for (let r = 1; r < totalsRow; r++) {
      if (ws.getCell(r, 1).value === '21KM') {
        firstDataRow = r;
        break;
      }
    }
    expect(firstDataRow).toBeGreaterThan(0);
    expect(ws.getCell(firstDataRow, 6).value).toBe(299000);
    // Col 4/5 should be '—' (string) for row có add-on, since qty/unit unknown
    expect(ws.getCell(firstDataRow, 4).value).toBe('—');
    expect(ws.getCell(firstDataRow, 5).value).toBe('—');
    // Col 8 Tổng cộng per-line = subtotal + add_on = 533200 + 299000 = 832200
    expect(ws.getCell(firstDataRow, 8).value).toBe(832200);

    // Second row (10KM Regular, no add-on)
    let secondDataRow = -1;
    for (let r = 1; r < totalsRow; r++) {
      if (ws.getCell(r, 1).value === '10KM') {
        secondDataRow = r;
        break;
      }
    }
    expect(secondDataRow).toBeGreaterThan(0);
    expect(ws.getCell(secondDataRow, 6).value).toBe(0);
    expect(ws.getCell(secondDataRow, 4).value).toBe(0); // no add-on → 0 (not '—')
  });
});
