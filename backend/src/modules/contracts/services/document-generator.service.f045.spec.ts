/**
 * F-045 — DOCX render multi-provider verification spec.
 *
 * Validates:
 *   - TC-45-01..07: Provider data (bankAccount/bankName/entityName/taxId)
 *     renders correctly across 5 templates × 2 provider variants
 *   - Multi-provider OVERRIDE scenarios (TC-45-03/04) — critical for non-default
 *     provider assignment (admin override per F-024 BR-CM-01).
 *   - Service label fix (BR-45-09/10) for acceptance-operations + acceptance-racekit
 *   - F-042+F-044 regression (TC-45-09/10): număr/chữ + filename HYBRID + Adjustment #1 typo
 */
jest.mock('@aws-sdk/client-s3', () => {
  const sendMock = jest.fn().mockResolvedValue({});
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: jest.fn().mockImplementation((p) => p),
    GetObjectCommand: jest.fn().mockImplementation((p) => p),
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example.com/foo'),
}));
jest.mock('libreoffice-convert', () => ({
  convert: jest.fn((_buf, _ext, _filter, cb) =>
    cb(null, Buffer.from('fake-pdf-bytes')),
  ),
}));
process.env.AWS_REGION = process.env.AWS_REGION ?? 'ap-southeast-1';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? 'test';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY ?? 'test';
process.env.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET ?? 'test';

import { DocumentGeneratorService } from './document-generator.service';
import {
  extractDocxText,
  assertDocxContains,
  assertDocxNotContains,
} from '../../../../test/helpers/docx-text-extract';
import { vndAmountInWords } from '../utils/vn-num-to-words';
import { getProviderEntity } from '../constants/provider-entities';

const PROVIDER_5BIB = getProviderEntity('5BIB');
const PROVIDER_5SOL = getProviderEntity('5SOLUTION');

function ctx(providerId: '5BIB' | '5SOLUTION', overrides: Record<string, unknown> = {}) {
  const provider = getProviderEntity(providerId);
  return {
    contractNumber: '10.05/2026/HDDV/TEST-001',
    contractType: 'RACEKIT',
    documentType: 'CONTRACT',
    signDate: new Date('2026-05-01'),
    signDay: '01',
    signMonth: '05',
    signYear: '2026',
    effectiveDate: new Date('2026-05-01'),
    endDate: new Date('2026-12-31'),
    provider,
    client: {
      entityName: 'CÔNG TY TNHH CÁT TIÊN ADVENTURE',
      taxId: '0123456789',
      address: 'Đồng Nai',
      representative: 'Trần Văn A',
      position: 'CEO',
      bankAccount: '999',
      bankName: 'VCB',
      phone: '0901234567',
      email: 'a@b.vn',
    },
    raceName: 'Cát Tiên Trail Family Adventure',
    raceDate: new Date('2026-06-15'),
    raceLocation: 'VQG Cát Tiên',
    lineItems: [
      { stt: 1, description: 'Item', unit: 'cái', unitPrice: 1000, quantity: 1, discount: 0, amount: 1000 },
    ],
    revenueShare: { feePercentage: 0, feePerAthlete: 0, estimatedAthletes: 0 },
    ticketFeePercent: 0,
    subtotal: 50000000,
    vatRate: 8,
    vatAmount: 4000000,
    totalAmount: 54000000,
    totalAmountInWords: vndAmountInWords(54000000),
    paymentTerms: {
      advancePercentage: 50,
      advanceAmount: 27000000,
      remainderPercentage: 50,
      remainderAmount: 27000000,
      paymentDeadlineDays: 15,
      latePenaltyRate: 0.05,
      latePenaltyUnit: '%/day',
    },
    articles: [],
    acceptanceReport: null,
    paymentRequest: null,
    requestDay: '',
    requestMonth: '',
    requestYear: '',
    generatedAt: new Date(),
    ...overrides,
  };
}

function bbntCtx(providerId: '5BIB' | '5SOLUTION', overrides: Record<string, unknown> = {}) {
  return ctx(providerId, {
    documentType: 'ACCEPTANCE_REPORT',
    actualSubtotal: 50000000,
    actualVatAmount: 4000000,
    actualTotalWithVat: 54000000,
    contractSubtotal: 50000000,
    diffAmount: 0,
    advancePaid: 15000000,
    remainingBalance: 39000000, // 30/70 asymmetric per F-044 Adjustment #1
    actualTotalWithVatInWords: vndAmountInWords(54000000),
    remainingBalanceInWords: vndAmountInWords(39000000),
    reportDay: '20',
    reportMonth: '06',
    reportYear: '2026',
    acceptanceReport: {
      reportDate: new Date('2026-06-20'),
      actualValues: [],
      actualSubtotal: 50000000,
      actualVatAmount: 4000000,
      actualTotalWithVat: 54000000,
      contractSubtotal: 50000000,
      diffAmount: 0,
      advancePaid: 15000000,
      remainingBalance: 39000000,
      verdict: 'ACCEPTED',
      notes: '',
      status: 'FINALIZED',
      finalizedAt: null,
    },
    ...overrides,
  });
}

describe('F-045 — Multi-provider DOCX render verification', () => {
  let svc: DocumentGeneratorService;
  beforeEach(() => {
    svc = new DocumentGeneratorService();
  });

  describe('TC-45-01: acceptance-racekit RACEKIT default 5BIB provider', () => {
    it('renders 5BIB provider data correctly + service label fixed to "vận hành racekit"', async () => {
      const buf = await svc.renderDocx('acceptance-racekit.docx', bbntCtx('5BIB', { contractType: 'RACEKIT' }));
      const text = await extractDocxText(buf);

      // 5BIB provider data resolved from F-030 registry
      expect(text).toContain(PROVIDER_5BIB.entityName); // 'CÔNG TY CỔ PHẦN 5BIB'
      expect(text).toContain(PROVIDER_5BIB.bankAccount); // '110398986'
      expect(text).toContain(PROVIDER_5BIB.bankName); // 'MB - Chi nhánh Thụy Khuê'

      // Service label fix BR-45-10
      expect(text).toContain('về vận hành racekit');
      expect(text).not.toContain('về dịch vụ tính giờ Hôm nay');

      // NO hardcoded sample leak
      await assertDocxNotContains(buf, [
        'CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION', // 5SOLUTION shouldn't appear in 5BIB contract
        '111213998', // 5SOLUTION bank account
        'MB chi nhánh Thụy Khuê', // legacy hardcoded (no dash, replaced by F-030 format)
      ]);
    });
  });

  describe('TC-45-02: acceptance-operations OPERATIONS default 5SOLUTION provider + taxId fix + service label fix', () => {
    it('renders 5SOLUTION data correctly + taxId via {provider.taxId} + service label "vận hành"', async () => {
      const buf = await svc.renderDocx(
        'acceptance-operations.docx',
        bbntCtx('5SOLUTION', {
          contractType: 'OPERATIONS',
          contractNumber: '20.05/2026/HDDV/OPS-5SOLUTION-1',
        }),
      );
      const text = await extractDocxText(buf);

      // 5SOLUTION provider data
      expect(text).toContain(PROVIDER_5SOL.entityName); // 'CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION'
      expect(text).toContain(PROVIDER_5SOL.bankAccount); // '111213998'
      expect(text).toContain(PROVIDER_5SOL.bankName); // 'MB - Chi nhánh Hai Bà Trưng'
      expect(text).toContain(PROVIDER_5SOL.taxId); // '0111213998' — Adjustment #1 taxId fix verified

      // Service label fix BR-45-09
      expect(text).toContain('về vận hành');
      expect(text).not.toContain('về dịch vụ tính giờ Hôm nay');

      // NO 5BIB residual
      await assertDocxNotContains(buf, [
        'CÔNG TY CỔ PHẦN 5BIB',
        '110398986',
        'MB - Chi nhánh Thụy Khuê',
      ]);
    });
  });

  describe('TC-45-03: acceptance-racekit RACEKIT với provider OVERRIDDEN to 5SOLUTION (critical)', () => {
    it('renders 5SOLUTION data NOT 5BIB residual when admin overrides provider', async () => {
      const buf = await svc.renderDocx(
        'acceptance-racekit.docx',
        bbntCtx('5SOLUTION', { contractType: 'RACEKIT' }),
      );
      const text = await extractDocxText(buf);

      // 5SOLUTION rendered
      expect(text).toContain(PROVIDER_5SOL.entityName);
      expect(text).toContain(PROVIDER_5SOL.bankAccount); // '111213998'
      expect(text).toContain(PROVIDER_5SOL.bankName); // 'MB - Chi nhánh Hai Bà Trưng'

      // CRITICAL: NO 5BIB residual leak (template was 5BIB-default before F-045)
      expect(text).not.toContain('110398986');
      expect(text).not.toContain('CÔNG TY CỔ PHẦN 5BIB');
      // Should NOT contain 5BIB bankName format
      expect(text).not.toMatch(/MB - Chi nhánh Thụy Khuê/);
    });
  });

  describe('TC-45-04: acceptance-operations OPERATIONS với provider OVERRIDDEN to 5BIB (reverse critical)', () => {
    it('renders 5BIB data NOT 5SOLUTION residual when admin overrides default 5SOLUTION', async () => {
      const buf = await svc.renderDocx(
        'acceptance-operations.docx',
        bbntCtx('5BIB', { contractType: 'OPERATIONS' }),
      );
      const text = await extractDocxText(buf);

      // 5BIB rendered (override default 5SOLUTION)
      expect(text).toContain(PROVIDER_5BIB.entityName);
      expect(text).toContain(PROVIDER_5BIB.bankAccount); // '110398986'
      expect(text).toContain(PROVIDER_5BIB.taxId); // '0110398986'

      // CRITICAL: NO 5SOLUTION residual
      expect(text).not.toContain('111213998');
      expect(text).not.toContain('CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION');
      expect(text).not.toMatch(/Hai Bà Trưng/);
    });
  });

  describe('TC-45-05: acceptance-timing TIMING 5BIB — service label "tính giờ" PRESERVED', () => {
    it('renders 5BIB data + KEEP "dịch vụ tính giờ" service label (correct for TIMING)', async () => {
      const buf = await svc.renderDocx(
        'acceptance-timing.docx',
        bbntCtx('5BIB', { contractType: 'TIMING' }),
      );
      const text = await extractDocxText(buf);

      expect(text).toContain(PROVIDER_5BIB.entityName);
      expect(text).toContain(PROVIDER_5BIB.bankAccount);
      expect(text).toContain(PROVIDER_5BIB.bankName);
      // BR-45-11: TIMING template KEEPS "dịch vụ tính giờ" — CORRECT
      expect(text).toContain('về dịch vụ tính giờ');
    });
  });

  describe('TC-45-06: contract-ticket-sales TICKET_SALES 5BIB — single complex line', () => {
    it('renders bank account + bank name + provider entity in complex single line', async () => {
      const buf = await svc.renderDocx(
        'contract-ticket-sales.docx',
        ctx('5BIB', { contractType: 'TICKET_SALES' }),
      );
      const text = await extractDocxText(buf);

      // Verify bank info renders correctly
      expect(text).toContain(`${PROVIDER_5BIB.bankAccount} tại ${PROVIDER_5BIB.bankName}`);
      expect(text).toContain(`Chủ tài khoản: ${PROVIDER_5BIB.entityName}`);
      // NO hardcoded sample leak
      expect(text).not.toContain('CONG TY CO PHAN 5BIB');
      expect(text).not.toContain('Ngân hàng TMCP Quân Đội (MB) – Chi nhánh Thụy Khuê');
    });
  });

  describe('TC-45-07: contract-operations OPERATIONS 5SOLUTION (scope extension)', () => {
    it('renders 5SOLUTION data via placeholders (taxId + bank account + entity name)', async () => {
      const buf = await svc.renderDocx(
        'contract-operations.docx',
        ctx('5SOLUTION', {
          contractType: 'OPERATIONS',
          contractNumber: '20.05/2026/HDDV/OPS-5SOLUTION-1',
          subtotal: 100000000,
          vatAmount: 8000000,
          totalAmount: 108000000,
          totalAmountInWords: vndAmountInWords(108000000),
        }),
      );
      const text = await extractDocxText(buf);

      // 5SOLUTION provider data resolved (Bên B + Phương thức thanh toán positions)
      expect(text).toContain(PROVIDER_5SOL.entityName);
      expect(text).toContain(PROVIDER_5SOL.bankAccount);
      expect(text).toContain(PROVIDER_5SOL.bankName);
      expect(text).toContain(PROVIDER_5SOL.taxId);

      // F-044 BUGFIX#1 regression: số khớp chữ
      expect(text).toContain('108.000.000 VNĐ');
      expect(text).toContain(vndAmountInWords(108000000)); // "Một trăm lẻ tám triệu đồng"
    });
  });

  describe('Regression: F-042+F-044 preserved', () => {
    it('TC-45-09: F-044 BUGFIX#1 số khớp chữ in contract-racekit preserved', async () => {
      const buf = await svc.renderDocx('contract-racekit.docx', ctx('5BIB', { contractType: 'RACEKIT' }));
      const text = await extractDocxText(buf);

      const m = text.match(/Tổng giá trị Hợp đồng \(đã bao gồm 8% VAT\):\s*([0-9.]+)\s*VND\s*\(Bằng chữ:\s*([^)]+)\)/);
      expect(m).toBeTruthy();
      expect(m![1]).toBe('54.000.000');
      expect(m![2].trim()).toBe('Năm mươi tư triệu đồng');
    });

    it('TC-45-10: F-044 Adjustment #1 acceptance-racekit asymmetric split preserved', async () => {
      const buf = await svc.renderDocx(
        'acceptance-racekit.docx',
        bbntCtx('5BIB', { contractType: 'RACEKIT' }),
      );
      const text = await extractDocxText(buf);

      // advancePaid=15M (tạm ứng line) + remainingBalance=39M (3× "còn lại" sentences)
      expect(text).toContain('15.000.000 đ'); // tạm ứng
      // 3 "còn lại" sentences should show 39M, not 15M
      const remainingMatches = text.match(/39\.000\.000 VNĐ/g);
      expect(remainingMatches).toBeTruthy();
      expect(remainingMatches!.length).toBeGreaterThanOrEqual(2);
    });
  });
});
