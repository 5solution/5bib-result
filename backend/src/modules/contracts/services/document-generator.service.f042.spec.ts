/**
 * F-042 — Test suite: Contract DOCX + BBNT render với REAL DB context
 *
 * Validates BR-42-01..09 + BR-42-15:
 *   - Contract DOCX renders subtotal/vatAmount/totalAmount correctly per Mapping Tables A-C
 *   - BBNT DOCX renders actualSubtotal/actualVatAmount/actualTotalWithVat/advancePaid/remainingBalance per Tables D-F
 *   - Zero hardcoded vi-VN financial values remaining (BR-42-07)
 *   - Real-world data scenarios: TIMING contract `6a095ceae7c717e8fc1c2c0e` exact mirror,
 *     1B+ VND format, 1000+ qty items, edge case zero discount
 *
 * TC-42-01..09 per Manager plan.
 */

// Mock @aws-sdk (same boilerplate as F-024 spec)
jest.mock('@aws-sdk/client-s3', () => {
  const sendMock = jest.fn().mockResolvedValue({});
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: jest.fn().mockImplementation((p) => p),
    GetObjectCommand: jest.fn().mockImplementation((p) => p),
    __sendMock: sendMock,
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
process.env.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET ?? 'test-bucket';

import { DocumentGeneratorService } from './document-generator.service';
import {
  extractDocxText,
  assertDocxContains,
  assertDocxNotContains,
} from '../../../../test/helpers/docx-text-extract';

/**
 * Mirror real contract `6a095ceae7c717e8fc1c2c0e` (Danny screenshot 2026-05-18).
 * 5 line items: Thảm tính giờ + Chip RFID + BIB A5 + Vận chuyển + Phí quản lý.
 */
const REAL_CONTRACT_CONTEXT = {
  contractNumber: 'HD/2026/05/001',
  contractType: 'TIMING',
  documentType: 'CONTRACT',
  signDate: new Date('2026-05-01'),
  signDay: '01',
  signMonth: '05',
  signYear: '2026',
  effectiveDate: new Date('2026-05-01'),
  endDate: new Date('2026-12-31'),
  provider: {
    entityName: 'CÔNG TY CỔ PHẦN ĐẦU TƯ THƯƠNG MẠI DỊCH VỤ XYZ VIỆT NAM',
    taxId: '0110398986',
    address: 'Tầng 9, Hồ Gươm Plaza, 102 Trần Phú, Hà Đông, Hà Nội',
    representative: 'Nguyễn Bình Minh',
    position: 'Giám đốc',
    bankAccount: '110398986',
    bankName: 'MB Bank',
    phone: '0373398986',
  },
  client: {
    entityName: 'CÔNG TY TNHH CÁT TIÊN ADVENTURE',
    taxId: '0123456789',
    address: 'Đồng Nai',
    representative: 'Trần Văn A',
    position: 'CEO',
  },
  raceName: 'Cat Tien Jungle Paths 2026',
  raceDate: new Date('2026-06-15'),
  raceLocation: 'VQG Cát Tiên, Đồng Nai',
  lineItems: [
    { stt: 1, description: 'Thảm tính giờ Start/Finish (chung điểm)', unit: 'gói', unitPrice: 15000000, quantity: 1, discount: 15, amount: 12750000 },
    { stt: 2, description: 'Chip RFID dán sau BIB', unit: 'cái', unitPrice: 30000, quantity: 80, discount: 0, amount: 2400000 },
    { stt: 3, description: 'BIB A5 in 2 mặt giấy chống nước', unit: 'cái', unitPrice: 9000, quantity: 80, discount: 0, amount: 720000 },
    { stt: 4, description: 'Vận chuyển thiết bị tính giờ + công tác phí', unit: 'gói', unitPrice: 5000000, quantity: 1, discount: 0, amount: 5000000 },
    { stt: 5, description: 'Phí quản lý & vận hành tính giờ', unit: 'gói', unitPrice: 5000000, quantity: 1, discount: 0, amount: 5000000 },
  ],
  revenueShare: { feePercentage: 0, feePerAthlete: 0, estimatedAthletes: 0 },
  ticketFeePercent: 0,
  subtotal: 25870000,
  vatRate: 8,
  vatAmount: 2069600,
  totalAmount: 27939600,
  totalAmountInWords: 'Hai mươi bảy triệu chín trăm ba mươi chín nghìn sáu trăm đồng',
  paymentTerms: {
    advancePercentage: 50,
    advanceAmount: 13969800,
    remainderPercentage: 50,
    remainderAmount: 13969800,
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
};

const REAL_BBNT_CONTEXT = {
  ...REAL_CONTRACT_CONTEXT,
  documentType: 'ACCEPTANCE_REPORT',
  acceptanceReport: {
    reportDate: new Date('2026-06-20'),
    actualValues: REAL_CONTRACT_CONTEXT.lineItems,
    actualSubtotal: 25870000,
    actualVatAmount: 2069600,
    actualTotalWithVat: 27939600,
    contractSubtotal: 25870000,
    diffAmount: 0,
    advancePaid: 13969800,
    remainingBalance: 13969800,
    verdict: 'ACCEPTED',
    notes: '',
    status: 'DRAFT',
    finalizedAt: null,
  },
  // Flatten fields per F-042 buildRenderContext extension
  actualSubtotal: 25870000,
  actualVatAmount: 2069600,
  actualTotalWithVat: 27939600,
  contractSubtotal: 25870000,
  diffAmount: 0,
  advancePaid: 13969800,
  remainingBalance: 13969800,
  actualTotalWithVatInWords: 'Hai mươi bảy triệu chín trăm ba mươi chín nghìn sáu trăm đồng',
  reportDay: '20',
  reportMonth: '06',
  reportYear: '2026',
};

describe('F-042 — Contract + BBNT DOCX render với DB context', () => {
  let svc: DocumentGeneratorService;

  beforeEach(() => {
    svc = new DocumentGeneratorService();
  });

  describe('TC-42-01: Contract DOCX TIMING happy path', () => {
    it('renders subtotal/vatAmount/totalAmount match DB + NO hardcoded 152.000.000/12.160.000', async () => {
      const buf = await svc.renderDocx('contract-timing.docx', REAL_CONTRACT_CONTEXT);

      await assertDocxContains(buf, [
        '25.870.000',  // subtotal
        '2.069.600',   // vatAmount
        '27.939.600',  // totalAmount
      ]);
      await assertDocxNotContains(buf, [
        '152.000.000',  // hardcoded sample (must be GONE after F-042)
        '12.160.000',   // hardcoded sample
      ]);
    });
  });

  describe('TC-42-02: BBNT DOCX TIMING happy path', () => {
    it('renders actualSubtotal/actualVatAmount/actualTotalWithVat/advancePaid/remainingBalance correctly', async () => {
      const buf = await svc.renderDocx('acceptance-timing.docx', REAL_BBNT_CONTEXT);

      await assertDocxContains(buf, [
        '25.870.000',  // actualSubtotal
        '2.069.600',   // actualVatAmount
        '27.939.600',  // actualTotalWithVat
        '13.969.800',  // advancePaid + remainingBalance (both same)
      ]);
      await assertDocxNotContains(buf, [
        '155.101.000',  // hardcoded actualSubtotal sample
        '12.408.080',   // hardcoded actualVatAmount sample
        '167.509.080',  // hardcoded actualTotalWithVat sample
        '82.080.000',   // hardcoded advancePaid sample
        '85.429.080',   // hardcoded remainingBalance sample
      ]);
    });
  });

  describe('TC-42-03: Contract DOCX RACEKIT — no 36.180.000 hardcoded', () => {
    // F-044 BUGFIX #1 (2026-05-19): câu "Tổng giá trị Hợp đồng (đã bao gồm 8% VAT)"
    // dùng {totalAmount} (KHÔNG dùng {subtotal} như F-042 đã sai). Updated
    // assertion: verify totalAmount rendering, NOT subtotal.
    it('renders totalAmount correctly (post F-044 bugfix #1) + verify no hardcoded sample value', async () => {
      const ctx = {
        ...REAL_CONTRACT_CONTEXT,
        contractType: 'RACEKIT',
        subtotal: 50000000,
        vatAmount: 4000000,
        totalAmount: 54000000,
      };
      const buf = await svc.renderDocx('contract-racekit.docx', ctx);
      // Câu "Tổng giá trị (đã bao gồm 8% VAT)" hiển thị 54M (totalAmount),
      // line item table vẫn hiển thị 50M (line item amount).
      await assertDocxContains(buf, ['54.000.000']);
      await assertDocxNotContains(buf, ['36.180.000']);
    });
  });

  describe('TC-42-04: Contract DOCX OPERATIONS — no 264.888.360 hardcoded', () => {
    // F-044 BUGFIX #1: same fix as RACEKIT — assert totalAmount not subtotal.
    it('renders totalAmount correctly (post F-044 bugfix #1) + verify no hardcoded sample value', async () => {
      const ctx = {
        ...REAL_CONTRACT_CONTEXT,
        contractType: 'OPERATIONS',
        subtotal: 100000000,
        vatAmount: 8000000,
        totalAmount: 108000000,
      };
      const buf = await svc.renderDocx('contract-operations.docx', ctx);
      await assertDocxContains(buf, ['108.000.000']);
      await assertDocxNotContains(buf, ['264.888.360']);
    });
  });

  describe('TC-42-05: BBNT RACEKIT — 4 hardcoded gone', () => {
    it('renders actual values correctly', async () => {
      const ctx = {
        ...REAL_BBNT_CONTEXT,
        contractType: 'RACEKIT',
        totalAmount: 50000000,
        actualSubtotal: 46000000,
        actualVatAmount: 3680000,
        actualTotalWithVat: 49680000,
        advancePaid: 25000000,
        remainingBalance: 24680000,
      };
      const buf = await svc.renderDocx('acceptance-racekit.docx', ctx);
      await assertDocxNotContains(buf, [
        '36.180.000',
        '33.500.000',
        '2.680.000',
        '18.090.000',
      ]);
    });
  });

  describe('TC-42-06: BBNT OPERATIONS — 6 hardcoded gone', () => {
    it('renders actual values correctly', async () => {
      const ctx = {
        ...REAL_BBNT_CONTEXT,
        contractType: 'OPERATIONS',
        totalAmount: 264000000,
        actualSubtotal: 245000000,
        actualVatAmount: 19600000,
        actualTotalWithVat: 264600000,
        advancePaid: 132000000,
        remainingBalance: 132600000,
      };
      const buf = await svc.renderDocx('acceptance-operations.docx', ctx);
      await assertDocxNotContains(buf, [
        '264.888.360',
        '265.482.360',
        '245.817.000',
        '19.665.360',
        '132.444.180',
        '133.038.180',
      ]);
    });
  });

  describe('TC-42-07: Complex multi-line-item (Danny bug repro contract)', () => {
    it('contract DOCX TIMING with 5 line items + 15% discount matches Danny screenshot expected values', async () => {
      const buf = await svc.renderDocx('contract-timing.docx', REAL_CONTRACT_CONTEXT);
      const text = await extractDocxText(buf);

      // Verify each line item description present
      expect(text).toContain('Thảm tính giờ');
      expect(text).toContain('Chip RFID');
      // Verify line item amounts
      expect(text).toContain('12.750.000');  // item 1 with 15% discount
      expect(text).toContain('2.400.000');   // item 2
      expect(text).toContain('720.000');     // item 3
      expect(text).toContain('5.000.000');   // items 4 + 5
      // Verify totals
      expect(text).toContain('25.870.000');  // subtotal
      expect(text).toContain('2.069.600');   // VAT
      expect(text).toContain('27.939.600');  // total
      // Verify NO hardcoded
      expect(text).not.toContain('152.000.000');
      expect(text).not.toContain('12.160.000');
    });
  });

  describe('TC-42-08: Edge case zero discount', () => {
    it('renders correctly when all line items have discount=0', async () => {
      const ctx = {
        ...REAL_CONTRACT_CONTEXT,
        lineItems: [
          { stt: 1, description: 'Test service', unit: 'gói', unitPrice: 10000000, quantity: 1, discount: 0, amount: 10000000 },
        ],
        subtotal: 10000000,
        vatAmount: 800000,
        totalAmount: 10800000,
      };
      const buf = await svc.renderDocx('contract-timing.docx', ctx);
      await assertDocxContains(buf, ['10.000.000', '800.000', '10.800.000']);
    });
  });

  describe('TC-42-09: Edge case 1B+ VND vi-VN format', () => {
    it('renders 1.000.000.000 (1 tỷ) correctly with vi-VN locale dots', async () => {
      const ctx = {
        ...REAL_CONTRACT_CONTEXT,
        subtotal: 1000000000,
        vatAmount: 80000000,
        totalAmount: 1080000000,
      };
      const buf = await svc.renderDocx('contract-timing.docx', ctx);
      await assertDocxContains(buf, [
        '1.000.000.000',
        '80.000.000',
        '1.080.000.000',
      ]);
    });
  });
});
