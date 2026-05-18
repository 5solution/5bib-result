/**
 * F-042 QC adversarial test cases.
 *
 * Beyond Coder's 9 happy-path tests, QC adds:
 *   - QC-TC-42-A01: Same number repeating in lineItems doesn't bleed into footer placeholders
 *   - QC-TC-42-A02: Render same DOCX 10 times → identical output (deterministic)
 *   - QC-TC-42-A03: BBNT actualTotalWithVat differs from contract totalAmount (diffAmount edge case)
 *   - QC-TC-42-A04: Missing acceptanceReport field → graceful degrade (no crash, empty placeholder)
 *   - QC-TC-42-A05: VN diacritics in lineItem description don't break placeholder resolution
 *   - QC-TC-42-A06: Race condition: concurrent renders of SAME contract → all succeed identically
 */

// Mock @aws-sdk (same boilerplate)
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
import { extractDocxText, assertDocxNotContains } from '../../../../test/helpers/docx-text-extract';
import * as crypto from 'crypto';

const BASE_CTX = {
  contractNumber: 'HD/2026/QC/001',
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
    address: 'Hà Nội',
    representative: 'Người đại diện',
    position: 'Giám đốc',
    bankAccount: '110398986',
    bankName: 'MB',
    phone: '0373398986',
  },
  client: {
    entityName: 'CÔNG TY TNHH ABC',
    taxId: '0123456789',
    address: 'TP HCM',
    representative: 'CEO',
    position: 'CEO',
  },
  raceName: 'QC Adversarial Test Race',
  raceDate: new Date('2026-06-15'),
  raceLocation: 'VN',
  lineItems: [],
  revenueShare: { feePercentage: 0, feePerAthlete: 0, estimatedAthletes: 0 },
  ticketFeePercent: 0,
  subtotal: 0,
  vatRate: 8,
  vatAmount: 0,
  totalAmount: 0,
  totalAmountInWords: '',
  paymentTerms: {
    advancePercentage: 50,
    advanceAmount: 0,
    remainderPercentage: 50,
    remainderAmount: 0,
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

describe('F-042 QC adversarial — edge cases & race conditions', () => {
  let svc: DocumentGeneratorService;
  beforeEach(() => { svc = new DocumentGeneratorService(); });

  describe('QC-TC-42-A01: lineItem amount matching old hardcoded sample doesn\'t bleed', () => {
    it('rendering with lineItem.amount=152.000.000 doesn\'t accidentally hit ex-hardcoded value', async () => {
      // Edge case: real contract MAY have amount happening to equal old hardcoded 152.000.000
      const ctx = {
        ...BASE_CTX,
        lineItems: [
          { stt: 1, description: 'Edge case service', unit: 'gói', unitPrice: 152000000, quantity: 1, discount: 0, amount: 152000000 },
        ],
        subtotal: 152000000,
        vatAmount: 12160000,
        totalAmount: 164160000,
      };
      const buf = await svc.renderDocx('contract-timing.docx', ctx);
      const text = await extractDocxText(buf);
      // 152.000.000 SHOULD appear (subtotal + line item amount) — verifying it's NOT spuriously absent
      expect(text).toContain('152.000.000');
      // 12.160.000 SHOULD appear (vat) — verifying old hardcoded value REPLACED with placeholder reading real ctx
      expect(text).toContain('12.160.000');
      // Total 164.160.000 SHOULD appear
      expect(text).toContain('164.160.000');
    });
  });

  describe('QC-TC-42-A02: Deterministic render — 10x consecutive renders produce identical content', () => {
    it('renders same context 10x → byte-identical text content', async () => {
      const ctx = {
        ...BASE_CTX,
        lineItems: [
          { stt: 1, description: 'Deterministic test', unit: 'gói', unitPrice: 5000000, quantity: 1, discount: 0, amount: 5000000 },
        ],
        subtotal: 5000000,
        vatAmount: 400000,
        totalAmount: 5400000,
      };
      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const buf = await svc.renderDocx('contract-timing.docx', ctx);
        const text = await extractDocxText(buf);
        // Hash text content (ignoring binary zip metadata which may differ per render)
        hashes.push(crypto.createHash('sha256').update(text).digest('hex'));
      }
      // All 10 hashes IDENTICAL
      expect(new Set(hashes).size).toBe(1);
    });
  });

  describe('QC-TC-42-A03: BBNT actualTotalWithVat differs from contract totalAmount (diff scenario)', () => {
    it('renders correctly when actual nghiệm thu > contract value (over-acceptance)', async () => {
      const ctx = {
        ...BASE_CTX,
        contractType: 'TIMING',
        documentType: 'ACCEPTANCE_REPORT',
        subtotal: 25000000,
        vatAmount: 2000000,
        totalAmount: 27000000,
        acceptanceReport: {
          actualSubtotal: 30000000,  // OVER contract
          actualVatAmount: 2400000,
          actualTotalWithVat: 32400000,
          contractSubtotal: 25000000,
          diffAmount: 5000000,
          advancePaid: 13500000,
          remainingBalance: 18900000,
        },
        actualSubtotal: 30000000,
        actualVatAmount: 2400000,
        actualTotalWithVat: 32400000,
        contractSubtotal: 25000000,
        diffAmount: 5000000,
        advancePaid: 13500000,
        remainingBalance: 18900000,
        actualTotalWithVatInWords: 'Ba mươi hai triệu bốn trăm nghìn đồng',
      };
      const buf = await svc.renderDocx('acceptance-timing.docx', ctx);
      const text = await extractDocxText(buf);
      // Contract total (27M) AND actual total (32.4M) BOTH visible (different placeholders)
      expect(text).toContain('27.000.000');  // contract totalAmount
      expect(text).toContain('32.400.000');  // actualTotalWithVat (differs!)
      expect(text).toContain('30.000.000');  // actualSubtotal
      expect(text).toContain('18.900.000');  // remainingBalance
    });
  });

  describe('QC-TC-42-A04: Missing acceptanceReport fields → graceful (no crash)', () => {
    it('renders BBNT when actualSubtotal undefined → empty placeholder not crash', async () => {
      const ctx = {
        ...BASE_CTX,
        contractType: 'TIMING',
        documentType: 'ACCEPTANCE_REPORT',
        acceptanceReport: { actualSubtotal: undefined } as never,
        // Flatten keys deliberately missing
      };
      // Should NOT throw
      const buf = await svc.renderDocx('acceptance-timing.docx', ctx);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(0);
    });
  });

  describe('QC-TC-42-A05: VN diacritics in lineItem description preserved', () => {
    it('renders complex VN string với dấu trong description without escape issues', async () => {
      const ctx = {
        ...BASE_CTX,
        lineItems: [
          {
            stt: 1,
            description: 'Dịch vụ tính giờ Bằng chip RFID — Race "Cát Tiên Jungle Paths"',
            unit: 'gói',
            unitPrice: 25000000,
            quantity: 1,
            discount: 0,
            amount: 25000000,
          },
        ],
        subtotal: 25000000,
        vatAmount: 2000000,
        totalAmount: 27000000,
      };
      const buf = await svc.renderDocx('contract-timing.docx', ctx);
      const text = await extractDocxText(buf);
      expect(text).toContain('Dịch vụ tính giờ');
      expect(text).toContain('Cát Tiên Jungle Paths');
      expect(text).toContain('25.000.000');
    });
  });

  describe('QC-TC-42-A06: Concurrent render race condition (10x Promise.all)', () => {
    it('10 simultaneous renders of same context → all produce identical text', async () => {
      const ctx = {
        ...BASE_CTX,
        lineItems: [
          { stt: 1, description: 'Race condition test', unit: 'gói', unitPrice: 1000000, quantity: 1, discount: 0, amount: 1000000 },
        ],
        subtotal: 1000000,
        vatAmount: 80000,
        totalAmount: 1080000,
      };
      const results = await Promise.all(
        Array.from({ length: 10 }, () => svc.renderDocx('contract-timing.docx', ctx)),
      );
      // All 10 buffers should be valid DOCX
      for (const buf of results) {
        expect(buf).toBeInstanceOf(Buffer);
        expect(buf.length).toBeGreaterThan(0);
      }
      // Extract text from each → verify identical content
      const texts = await Promise.all(results.map((buf) => extractDocxText(buf)));
      const hashes = texts.map((t) => crypto.createHash('sha256').update(t).digest('hex'));
      expect(new Set(hashes).size).toBe(1);
    });
  });

  describe('QC-TC-42-A07: Acceptance OPERATIONS template — actualTotalWithVat appears 2x consistently', () => {
    it('renders 265.482.360 in both section 3.2 + footer with same value when actualTotalWithVat=265482360', async () => {
      const ctx = {
        ...BASE_CTX,
        contractType: 'OPERATIONS',
        documentType: 'ACCEPTANCE_REPORT',
        subtotal: 245817000,
        vatAmount: 19665360,
        totalAmount: 265482360,
        acceptanceReport: {
          actualSubtotal: 245817000,
          actualVatAmount: 19665360,
          actualTotalWithVat: 265482360,
          contractSubtotal: 245817000,
          advancePaid: 132741180,
          remainingBalance: 132741180,
        },
        actualSubtotal: 245817000,
        actualVatAmount: 19665360,
        actualTotalWithVat: 265482360,
        advancePaid: 132741180,
        remainingBalance: 132741180,
        actualTotalWithVatInWords: '',
      };
      const buf = await svc.renderDocx('acceptance-operations.docx', ctx);
      const text = await extractDocxText(buf);
      // Both occurrences of {actualTotalWithVat} should resolve identically
      const matches = (text.match(/265\.482\.360/g) || []).length;
      expect(matches).toBeGreaterThanOrEqual(2);  // section 3.2 + footer
      // Sanity: hardcoded sample value should NOT appear anywhere
      await assertDocxNotContains(buf, ['264.888.360']);  // old hardcoded
    });
  });
});
