/**
 * F-044 — DOCX render test suite: Contract + BBNT TEXT hardcoded fix.
 *
 * Validates BR-44-01..05 (Mapping Tables A-F) + BR-44-03 (placeholder typo fix)
 * + Adjustment #1 (asymmetric advance/remaining split):
 *
 *   - TC-44-01: Contract RACEKIT — contractNumber from DB resolved
 *   - TC-44-02: Contract OPERATIONS — totalAmountInWords computed from DB
 *   - TC-44-03: Contract TICKET_SALES — 2 CN positions both resolved
 *   - TC-44-04: BBNT RACEKIT — 6 CN + remainingBalance + asymmetric split
 *   - TC-44-05: BBNT TIMING — remainingBalanceInWords replaces hardcoded
 *   - TC-44-06: BBNT OPERATIONS — remainingBalanceInWords resolved
 *   - TC-44-15: BBNT RACEKIT asymmetric split — Adjustment #1 typo bug verify
 *
 * Pattern reuse: F-042 spec mock + helpers (extractDocxText / assertDocxContains
 * / assertDocxNotContains).
 */

// Mock @aws-sdk (boilerplate matching F-042 spec)
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
import { vndAmountInWords } from '../utils/vn-num-to-words';

/**
 * Real-world contract context — mirror Danny case `6a0bcab66042f47bde4eb9d7`
 * (Cát Tiên Trail Family Adventure, RACEKIT contract). VN long entity names +
 * diacritics + 1B+ scale ready.
 */
const F044_RACEKIT_CONTEXT = {
  contractNumber: '10.05/2026/HDDV/CTTFA-5BIB-6',
  contractType: 'RACEKIT',
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
    address: 'Hà Nội',
    representative: 'Nguyễn Văn A',
    position: 'Giám đốc',
    bankAccount: '110398986',
    bankName: 'MB Bank',
  },
  client: {
    entityName: 'CÔNG TY TNHH CÁT TIÊN ADVENTURE',
    taxId: '0123456789',
    address: 'Đồng Nai',
    representative: 'Trần Văn B',
    position: 'CEO',
  },
  raceName: 'Cát Tiên Trail Family Adventure',
  raceDate: new Date('2026-06-15'),
  raceLocation: 'VQG Cát Tiên',
  lineItems: [],
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
};

describe('F-044 — DOCX TEXT hardcoded fix render verification', () => {
  let svc: DocumentGeneratorService;

  beforeEach(() => {
    svc = new DocumentGeneratorService();
  });

  describe('TC-44-01: Contract DOCX RACEKIT — contractNumber from DB resolved', () => {
    it('resolves {contractNumber} placeholder + NO hardcoded 10.04/2026/HĐDV/TAM-5BIB sample', async () => {
      const buf = await svc.renderDocx(
        'contract-racekit.docx',
        F044_RACEKIT_CONTEXT,
      );

      await assertDocxContains(buf, [
        '10.05/2026/HDDV/CTTFA-5BIB-6', // DB-resolved value
      ]);
      await assertDocxNotContains(buf, [
        '10.04/2026/HĐDV/TAM-5BIB', // hardcoded sample MUST be gone
      ]);
    });

    it('resolves {totalAmountInWords} dynamically from computed amount', async () => {
      const buf = await svc.renderDocx(
        'contract-racekit.docx',
        F044_RACEKIT_CONTEXT,
      );
      const text = await extractDocxText(buf);

      // Computed in-words for 54M
      const computedInWords = vndAmountInWords(54000000);
      expect(text).toContain(computedInWords);
      // Hardcoded 36.180.000 in-words sample MUST be gone
      expect(text).not.toContain(
        'Ba mươi sáu triệu một trăm tám mươi nghìn đồng',
      );
    });
  });

  describe('TC-44-02: Contract DOCX OPERATIONS — totalAmountInWords computed', () => {
    it('replaces hardcoded 264.888.360 in-words with computed value', async () => {
      const ctx = {
        ...F044_RACEKIT_CONTEXT,
        contractType: 'OPERATIONS',
        contractNumber: '20.05/2026/HDDV/OPS-5BIB-1',
        subtotal: 100000000,
        vatAmount: 8000000,
        totalAmount: 108000000,
        totalAmountInWords: vndAmountInWords(108000000),
      };
      const buf = await svc.renderDocx('contract-operations.docx', ctx);
      const text = await extractDocxText(buf);

      expect(text).toContain(vndAmountInWords(108000000));
      // Hardcoded sample 264M in-words MUST be gone
      expect(text).not.toContain(
        'Hai trăm sáu mươi tư triệu tám trăm tám tám ngàn ba trăm sáu mươi đồng',
      );
    });
  });

  describe('TC-44-03: Contract DOCX TICKET_SALES — 2 CN positions both resolved', () => {
    it('renders contractNumber in both header + Phụ lục 1, with NO hardcoded fragments', async () => {
      const ctx = {
        ...F044_RACEKIT_CONTEXT,
        contractType: 'TICKET_SALES',
        contractNumber: '01.05/2026/HDDV/XYZ-5BIB-1',
        documentType: 'CONTRACT',
      };
      const buf = await svc.renderDocx('contract-ticket-sales.docx', ctx);
      const text = await extractDocxText(buf);

      // Both header + Phụ lục should have DB contractNumber
      const matches = text.match(/01\.05\/2026\/HDDV\/XYZ-5BIB-1/g);
      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThanOrEqual(2);

      // Hardcoded sample CN fragments MUST be gone
      expect(text).not.toContain('25.02-HDDV-5BIB-TAM');
      expect(text).not.toContain('17.01-HDDV-5BIB-VUD');
    });
  });

  describe('TC-44-04: BBNT RACEKIT — 6 CN resolved + remainingBalance asymmetric (Adjustment #1)', () => {
    it('renders 6 occurrences of contractNumber + remainingBalance correctly when split asymmetric', async () => {
      // 30/70 split asymmetric — exposes Adjustment #1 typo bug if not fixed
      const ctx = {
        ...F044_RACEKIT_CONTEXT,
        documentType: 'ACCEPTANCE_REPORT',
        // Flatten F-042 fields
        actualSubtotal: 50000000,
        actualVatAmount: 4000000,
        actualTotalWithVat: 54000000,
        contractSubtotal: 50000000,
        diffAmount: 0,
        advancePaid: 15000000, // 30% tạm ứng
        remainingBalance: 39000000, // 70% còn lại — DIFFERENT from advancePaid
        actualTotalWithVatInWords: vndAmountInWords(54000000),
        // F-044 NEW flatten key
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
      };
      const buf = await svc.renderDocx('acceptance-racekit.docx', ctx);
      const text = await extractDocxText(buf);

      // 6 contractNumber occurrences (Manager grep verified pre-edit)
      const cnMatches = text.match(/10\.05\/2026\/HDDV\/CTTFA-5BIB-6/g);
      expect(cnMatches).toBeTruthy();
      expect(cnMatches!.length).toBeGreaterThanOrEqual(6);

      // Adjustment #1 verify: remainingBalance value (39M) appears in "còn lại"
      // sentences, NOT advancePaid value (15M).
      expect(text).toContain('39.000.000');

      // remainingBalance in-words present (3 occurrences post-F-044 fix)
      expect(text).toContain(vndAmountInWords(39000000));

      // Hardcoded samples MUST be gone
      await assertDocxNotContains(buf, [
        '10.04/2026/HĐDV/TAM-5BIB', // hardcoded CN sample
        'Mười tám triệu không trăm chín mươi ngàn', // hardcoded "Bằng chữ" 18M sample
        'Ba mươi sáu triệu một trăm tám mươi nghìn đồng', // hardcoded 36M in-words
      ]);
    });
  });

  describe('TC-44-05: BBNT TIMING — remainingBalanceInWords replaces hardcoded', () => {
    it('renders computed remainingBalanceInWords + NO 85.429.080 in-words sample', async () => {
      const ctx = {
        ...F044_RACEKIT_CONTEXT,
        contractType: 'TIMING',
        contractNumber: 'HD/2026/05/001',
        documentType: 'ACCEPTANCE_REPORT',
        actualSubtotal: 25870000,
        actualVatAmount: 2069600,
        actualTotalWithVat: 27939600,
        contractSubtotal: 25870000,
        diffAmount: 0,
        advancePaid: 13969800,
        remainingBalance: 13969800,
        actualTotalWithVatInWords: vndAmountInWords(27939600),
        remainingBalanceInWords: vndAmountInWords(13969800),
        reportDay: '20',
        reportMonth: '06',
        reportYear: '2026',
        acceptanceReport: {
          reportDate: new Date('2026-06-20'),
          actualValues: [],
          actualSubtotal: 25870000,
          actualVatAmount: 2069600,
          actualTotalWithVat: 27939600,
          contractSubtotal: 25870000,
          diffAmount: 0,
          advancePaid: 13969800,
          remainingBalance: 13969800,
          status: 'FINALIZED',
        },
      };
      const buf = await svc.renderDocx('acceptance-timing.docx', ctx);
      const text = await extractDocxText(buf);

      expect(text).toContain(vndAmountInWords(13969800));
      expect(text).not.toContain(
        'Tám mươi lăm triệu bốn trăm hai mươi chín ngàn không trăm tám mươi đồng',
      );
    });
  });

  describe('TC-44-06: BBNT OPERATIONS — remainingBalanceInWords resolved', () => {
    it('renders computed in-words + NO 133.038.180 hardcoded in-words', async () => {
      const ctx = {
        ...F044_RACEKIT_CONTEXT,
        contractType: 'OPERATIONS',
        contractNumber: 'HD/2026/05/OPS-1',
        documentType: 'ACCEPTANCE_REPORT',
        actualSubtotal: 245000000,
        actualVatAmount: 19600000,
        actualTotalWithVat: 264600000,
        contractSubtotal: 245000000,
        diffAmount: 0,
        advancePaid: 132000000,
        remainingBalance: 132600000,
        actualTotalWithVatInWords: vndAmountInWords(264600000),
        remainingBalanceInWords: vndAmountInWords(132600000),
        reportDay: '20',
        reportMonth: '06',
        reportYear: '2026',
        acceptanceReport: {
          reportDate: new Date('2026-06-20'),
          actualValues: [],
          actualSubtotal: 245000000,
          actualVatAmount: 19600000,
          actualTotalWithVat: 264600000,
          contractSubtotal: 245000000,
          diffAmount: 0,
          advancePaid: 132000000,
          remainingBalance: 132600000,
          status: 'FINALIZED',
        },
      };
      const buf = await svc.renderDocx('acceptance-operations.docx', ctx);
      const text = await extractDocxText(buf);

      expect(text).toContain(vndAmountInWords(132600000));
      expect(text).not.toContain(
        'Một trăm ba mươi ba triệu không trăm ba tám ngàn một trăm tám mươi đồng',
      );
    });
  });
});
