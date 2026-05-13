/**
 * FEATURE-030 — Smoke test DOCX render for:
 * - 5BIB provider info đọc từ env config (replace hardcoded legacy strings)
 * - Bottom "Vật phẩm bổ sung" row hiển thị khi có add-on
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
        address: 'Tầng 9, Tòa nhà Hồ Gươm Plaza (tòa văn phòng), Số 102 Phố Trần Phú, Phường Hà Đông, TP Hà Nội, Việt Nam',
        taxCode: '0110398986',
        phone: '0373398986',
        representativeName: 'Nguyễn Bình Minh',
        representativeTitle: 'Giám Đốc',
        bankAccount: '110398986',
        bankName: 'Ngân hàng Quân Đội MB',
      },
    },
  }),
  { virtual: true },
);

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
}));

import { DocxService } from './docx.service';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('DocxService — FEATURE-030 provider info from env + add-on row', () => {
  const docxSvc = new DocxService();

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
      { order_category: 'ORDINARY', ticket_type_name: 'Ưu đãi', distance_name: '21KM', unit_price: 533200, quantity: 1, discount_amount: 0, subtotal: 533200, add_on_price: 299000 },
      { order_category: 'ORDINARY', ticket_type_name: 'Regular', distance_name: '10KM', unit_price: 500000, quantity: 8, discount_amount: 0, subtotal: 4000000, add_on_price: 0 },
    ],
  };

  async function extractDocText(buf: Buffer): Promise<string> {
    // Use shell `unzip -p` to extract word/document.xml — avoid adding new dep
    const tmp = path.join(os.tmpdir(), `docx-spec-${Date.now()}-${Math.random()}.docx`);
    fs.writeFileSync(tmp, buf);
    try {
      const xml = execSync(`unzip -p "${tmp}" word/document.xml`, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });
      return xml;
    } finally {
      fs.unlinkSync(tmp);
    }
  }

  it('TC-AO-07: DOCX BÊN B info đọc từ env.provider.* (NOT hardcoded legacy)', async () => {
    const buf = await docxSvc.generate(rec);
    expect(buf.length).toBeGreaterThan(1000);
    const text = await extractDocText(buf);

    // Verify env.provider.* values hiện trong document
    expect(text).toContain('Hồ Gươm Plaza');
    expect(text).toContain('Hà Đông');
    expect(text).toContain('0110398986'); // tax code
    expect(text).toContain('0373398986'); // phone
    expect(text).toContain('Nguyễn Bình Minh');
    expect(text).toContain('110398986'); // bank account (substring of tax also — both present)
    expect(text).toContain('Ngân hàng Quân Đội MB');

    // Verify hardcoded LEGACY strings KHÔNG còn xuất hiện
    expect(text).not.toContain('Tôn Thất Thuyết');
    expect(text).not.toContain('Mỹ Đình 2');
    expect(text).not.toContain('Nam Từ Liêm');
    expect(text).not.toContain('1900 636 997');
    expect(text).not.toContain('34110001234567');
    expect(text).not.toContain('BIDV');
  });

  it('TC-AO-08: DOCX Section 3 thêm row "Vật phẩm bổ sung" khi có add-on', async () => {
    const buf = await docxSvc.generate(rec);
    const text = await extractDocText(buf);

    // Bottom row label hiện
    expect(text).toContain('Vật phẩm bổ sung');
  });

  it('TC-AO-09: DOCX KHÔNG hiển thị "Vật phẩm bổ sung" row khi tất cả line items không có add-on', async () => {
    const recNoAddon = {
      ...rec,
      line_items: rec.line_items.map((li: any) => ({ ...li, add_on_price: 0 })),
    };
    const buf = await docxSvc.generate(recNoAddon);
    const text = await extractDocText(buf);

    // Bottom row label KHÔNG hiện (clean render cho recon không có add-on)
    expect(text).not.toContain('Vật phẩm bổ sung');
    // 5BIB info vẫn hiển thị (regression check)
    expect(text).toContain('Hồ Gươm Plaza');
  });

  it('TC-AO-10: DOCX signature block hiển thị representative name uppercase', async () => {
    const buf = await docxSvc.generate(rec);
    const text = await extractDocText(buf);
    // representativeName.toUpperCase() = 'NGUYỄN BÌNH MINH'
    expect(text).toContain('NGUYỄN BÌNH MINH');
  });
});
