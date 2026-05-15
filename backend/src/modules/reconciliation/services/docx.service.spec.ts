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
  /**
   * Default mock: MerchantConfig findOne returns null → docx falls back to
   * tenant_metadata (legacy F-030 behavior). Specific test cases override
   * to assert MerchantConfig priority (BUG-FIX 2026-05-14).
   */
  const mockModel: any = {
    findOne: jest.fn().mockReturnValue({
      lean: () => Promise.resolve(null),
    }),
  };
  const docxSvc = new DocxService(mockModel);

  beforeEach(() => {
    mockModel.findOne.mockClear();
    mockModel.findOne.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
  });

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

  /* ──────────────────────────────────────────────────────────────────────────
   * BUG-FIX 2026-05-14 — Merchant info priority (MerchantConfig > tenant_metadata)
   *
   * Danny report screenshot: DOCX cho Zaha #46 dùng platform sync info
   * thay vì "Công ty đối tác" admin đã nhập riêng → DOCX sai 8 field.
   * Fix: priority MerchantConfig admin-entered > tenant_metadata > tenant_name.
   * ────────────────────────────────────────────────────────────────────────── */

  it('TC-MC-01: MerchantConfig admin-entered legal_name + tax_code thắng tenant_metadata + rec.tenant_name', async () => {
    mockModel.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          tenantId: 1,
          legal_name: 'CÔNG TY CỔ PHẦN VIỆT NAM TÔI ĐÓ',
          tax_code: '0193762555',
          business_address: 'Hà Nội Admin Entered Address',
          representative_name: 'Trần Quang Hùng',
          representative_title: 'Chủ Tịch HĐQT',
          bank_account: '999888777',
          bank_name: 'Vietcombank Hà Nội',
        }),
    });

    const recWithMeta = {
      ...rec,
      tenant_metadata: {
        companyName: 'PLATFORM SYNC NAME WRONG',
        vat: '0193762OLD',
        address: 'Platform Address Wrong',
        name: 'Platform Rep Wrong',
        bankAccount: '111222333',
        bankName: 'Platform Bank Wrong',
      },
    };
    const buf = await docxSvc.generate(recWithMeta);
    const text = await extractDocText(buf);

    // Admin-entered values WIN
    expect(text).toContain('CÔNG TY CỔ PHẦN VIỆT NAM TÔI ĐÓ');
    expect(text).toContain('0193762555');
    expect(text).toContain('Hà Nội Admin Entered Address');
    expect(text).toContain('Trần Quang Hùng');
    expect(text).toContain('Chủ Tịch HĐQT');
    expect(text).toContain('999888777');
    expect(text).toContain('Vietcombank Hà Nội');

    // Platform sync values KHÔNG còn hiện
    expect(text).not.toContain('PLATFORM SYNC NAME WRONG');
    expect(text).not.toContain('0193762OLD');
    expect(text).not.toContain('Platform Address Wrong');
    expect(text).not.toContain('Platform Rep Wrong');
    expect(text).not.toContain('111222333');
    expect(text).not.toContain('Platform Bank Wrong');
  });

  it('TC-MC-02: MerchantConfig KHÔNG tồn tại → fallback tenant_metadata (backward compat F-030)', async () => {
    // Default mock returns null — no admin override
    const recWithMeta = {
      ...rec,
      tenant_metadata: {
        companyName: 'PLATFORM SYNC NAME',
        vat: '01122334',
        bankAccount: '123456789',
      },
    };
    const buf = await docxSvc.generate(recWithMeta);
    const text = await extractDocText(buf);

    expect(text).toContain('PLATFORM SYNC NAME');
    expect(text).toContain('01122334');
    expect(text).toContain('123456789');
  });

  it('TC-MC-03: MerchantConfig partial fields (chỉ legal_name) → các field khác fallback tenant_metadata', async () => {
    mockModel.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          tenantId: 1,
          legal_name: 'ADMIN ENTERED COMPANY ONLY',
          // tax_code, address, etc null
        }),
    });

    const recWithMeta = {
      ...rec,
      tenant_metadata: {
        companyName: 'PLATFORM NAME WRONG',
        vat: '0199000111',
        address: 'Platform Address Fallback',
        name: 'Platform Rep Fallback',
        bankAccount: '888777666',
        bankName: 'Platform Bank Fallback',
      },
    };
    const buf = await docxSvc.generate(recWithMeta);
    const text = await extractDocText(buf);

    // Admin-entered legal_name WINS
    expect(text).toContain('ADMIN ENTERED COMPANY ONLY');
    expect(text).not.toContain('PLATFORM NAME WRONG');

    // Other fields fallback to tenant_metadata
    expect(text).toContain('0199000111');
    expect(text).toContain('Platform Address Fallback');
    expect(text).toContain('Platform Rep Fallback');
    expect(text).toContain('888777666');
    expect(text).toContain('Platform Bank Fallback');
  });

  it('TC-MC-04: MerchantConfig fetch query uses correct tenantId', async () => {
    await docxSvc.generate(rec);
    expect(mockModel.findOne).toHaveBeenCalledWith({ tenantId: rec.tenant_id });
  });

  /* ────────────────────────────────────────────────────────────────────────
   * FEATURE-037 — colspan cell explicit width (Danny 2026-05-15 bug report)
   *
   * Bug: DOCX preview Google Drive viewer / LibreOffice / Mac Preview render
   * colspan cells thiếu width → text dài như "Hoàn trả merchant (4) = (1) -
   * (2) - (3)" wrap mỗi ký tự thành 1 dòng vertical. MS Word auto-fit
   * KHÔNG bị → người nhận bằng client khác complain.
   *
   * Fix: thêm explicit `<w:tcW w:w="N" w:type="dxa"/>` per colspan cell.
   * ──────────────────────────────────────────────────────────────────────── */

  it('TC-DOCX-COL-01: Tất cả colspan cells trong reconciliation table có explicit tcW (width DXA)', async () => {
    const buf = await docxSvc.generate(rec);
    const text = await extractDocText(buf);

    // Verify cells "Phí bán vé" + "Thuế GTGT" + "Hoàn trả merchant" — mỗi
    // text dài này PHẢI render cùng tcW preceding nó (= 5620 = sum colWidths[0..4])
    // Pattern check: trong XML, mỗi tcW="5620" appearance phải >= 3 (3 colspan-5 rows)
    const tcWMatches5620 = text.match(/w:w="5620"/g) ?? [];
    expect(tcWMatches5620.length).toBeGreaterThanOrEqual(3);

    // Verify cell "Tổng cộng (1)" colspan=3 → tcW="3930" (2300+750+880)
    const tcWMatches3930 = text.match(/w:w="3930"/g) ?? [];
    expect(tcWMatches3930.length).toBeGreaterThanOrEqual(1);

    // Verify text "Hoàn trả merchant" KHÔNG đứng cạnh cell missing width
    // (tức: text này phải xuất hiện sau tcW="5620" definition)
    expect(text).toContain('Hoàn trả merchant (4) = (1) - (2) - (3)');
    expect(text).toContain('Thuế GTGT');
    expect(text).toContain('Phí bán vé');
  });

  it('TC-DOCX-COL-02: Sub-header BÊN A/B colspan=6 có tcW="9000" (full table width)', async () => {
    const buf = await docxSvc.generate(rec);
    const text = await extractDocText(buf);

    // BÊN A "Bên sử dụng dịch vụ" + BÊN B "Bên cung cấp dịch vụ" + "Và" separator
    // = 3 cells colspan=6 với width=9000
    const tcWMatches9000 = text.match(/w:w="9000"/g) ?? [];
    expect(tcWMatches9000.length).toBeGreaterThanOrEqual(3);

    // Verify text "Sau đây gọi tắt là" KHÔNG bị wrap (presence check)
    expect(text).toContain('Bên sử dụng dịch vụ');
    expect(text).toContain('Bên cung cấp dịch vụ');
  });

  it('TC-DOCX-COL-03: addOnRow "Vật phẩm bổ sung" colspan=5 có tcW="5620"', async () => {
    // rec đã có line_items[0].add_on_price = 299_000 → addOnRow render
    const buf = await docxSvc.generate(rec);
    const text = await extractDocText(buf);

    expect(text).toContain('Vật phẩm bổ sung');
    // 4 colspan-5 cells total (addOn + Phí + Thuế + Hoàn trả)
    const tcWMatches5620 = text.match(/w:w="5620"/g) ?? [];
    expect(tcWMatches5620.length).toBeGreaterThanOrEqual(4);
  });

  it('TC-MC-05: MerchantConfig fetch error → fail-soft fallback tenant_metadata (KHÔNG crash)', async () => {
    mockModel.findOne.mockReturnValue({
      lean: () => Promise.reject(new Error('mongo down')),
    });

    const recWithMeta = {
      ...rec,
      tenant_metadata: {
        companyName: 'FALLBACK PLATFORM',
      },
    };
    const buf = await docxSvc.generate(recWithMeta);
    expect(buf.length).toBeGreaterThan(1000);
    const text = await extractDocText(buf);
    expect(text).toContain('FALLBACK PLATFORM');
  });
});
