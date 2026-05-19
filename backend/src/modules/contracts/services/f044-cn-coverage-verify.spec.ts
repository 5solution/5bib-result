/**
 * F-044 Manager — Contract Number Coverage Verify
 *
 * Danny request 2026-05-19: "Số hợp đồng các thứ và biên bản nghiệm thu, số
 * hợp đồng ở các loại hợp đồng khác nhau ok hết chưa"
 *
 * Render ALL (contractType × docType) combinations với contractNumber realistic
 * per type → grep từng câu có "Số:" hoặc "Hợp đồng số" → verify DB value
 * appears, sample value KHÔNG.
 *
 * Coverage matrix:
 *   TIMING       × CONTRACT             → contract-timing.docx
 *   TIMING       × ACCEPTANCE_REPORT    → acceptance-timing.docx
 *   RACEKIT      × CONTRACT             → contract-racekit.docx
 *   RACEKIT      × ACCEPTANCE_REPORT    → acceptance-racekit.docx
 *   OPERATIONS   × CONTRACT             → contract-operations.docx
 *   OPERATIONS   × ACCEPTANCE_REPORT    → acceptance-operations.docx
 *   TICKET_SALES × CONTRACT             → contract-ticket-sales.docx (no BBNT)
 *
 * Plus: payment-request.docx + quotation.xlsx — verify contractNumber rendering
 * if applicable.
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

import * as fs from 'fs';
import * as path from 'path';
import { DocumentGeneratorService } from './document-generator.service';
import { extractDocxText } from '../../../../test/helpers/docx-text-extract';
import { vndAmountInWords } from '../utils/vn-num-to-words';

const OUT_DIR = '/tmp/f044-cn-coverage/output';

// Known sample CN hardcoded values (must NOT appear in any render output)
const HARDCODED_CN_SAMPLES = [
  '10.04/2026/HĐDV/TAM-5BIB', // F-044 racekit sample
  '11.04/2026/HĐDV', // F-024 legacy
  '14.04/2026/HĐDV', // F-024 legacy
  '25.02-HDDV-5BIB-TAM', // F-044 ticket-sales header sample
  '17.01-HDDV-5BIB-VUD', // F-044 ticket-sales Phụ lục sample
];

function baseCtx(overrides: Record<string, unknown>) {
  return {
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
      representative: 'Nguyễn Bình Minh',
      position: 'Giám đốc',
      bankAccount: '110398986',
      bankName: 'MB Bank',
      phone: '0901234567',
      email: 'x@y.vn',
    },
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
    paymentTerms: { advancePercentage: 50, advanceAmount: 0, remainderPercentage: 50, remainderAmount: 0, paymentDeadlineDays: 15, latePenaltyRate: 0, latePenaltyUnit: '%/day' },
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

describe('F-044 Coverage Verify — contractNumber render across ALL contractType × docType', () => {
  let svc: DocumentGeneratorService;
  beforeAll(() => {
    svc = new DocumentGeneratorService();
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  // 7 contract × doc combinations + 2 extras (payment-request, quotation)
  const cases = [
    // === CONTRACT documents ===
    {
      tpl: 'contract-timing.docx',
      cn: 'HD/2026/05/TIMING-001',
      ctx: {
        contractType: 'TIMING',
        documentType: 'CONTRACT',
        subtotal: 152000000, vatRate: 8, vatAmount: 12160000, totalAmount: 164160000,
        totalAmountInWords: vndAmountInWords(164160000),
      },
      // expected CN occurrences in template (manual count from F-024+F-042+F-044 verified)
      expectedMinOccurrences: 1,
    },
    {
      tpl: 'contract-racekit.docx',
      cn: '10.05/2026/HDDV/CTTFA-5BIB-6',
      ctx: {
        contractType: 'RACEKIT',
        documentType: 'CONTRACT',
        subtotal: 50000000, vatRate: 8, vatAmount: 4000000, totalAmount: 54000000,
        totalAmountInWords: vndAmountInWords(54000000),
      },
      expectedMinOccurrences: 1,
    },
    {
      tpl: 'contract-operations.docx',
      cn: '20.05/2026/HDDV/OPS-5BIB-1',
      ctx: {
        contractType: 'OPERATIONS',
        documentType: 'CONTRACT',
        subtotal: 100000000, vatRate: 8, vatAmount: 8000000, totalAmount: 108000000,
        totalAmountInWords: vndAmountInWords(108000000),
      },
      expectedMinOccurrences: 1,
    },
    {
      tpl: 'contract-ticket-sales.docx',
      cn: '01.05/2026/HDDV/XYZ-5BIB-1',
      ctx: {
        contractType: 'TICKET_SALES',
        documentType: 'CONTRACT',
        subtotal: 0, vatRate: 8, vatAmount: 0, totalAmount: 0,
        totalAmountInWords: vndAmountInWords(0),
      },
      // F-044 Mapping Table C — 2 CN positions (header + Phụ lục)
      expectedMinOccurrences: 2,
    },
    // === ACCEPTANCE_REPORT documents ===
    {
      tpl: 'acceptance-timing.docx',
      cn: 'HD/2026/05/TIMING-001',
      ctx: {
        contractType: 'TIMING',
        documentType: 'ACCEPTANCE_REPORT',
        subtotal: 152000000, vatRate: 8, vatAmount: 12160000, totalAmount: 164160000,
        totalAmountInWords: vndAmountInWords(164160000),
        actualSubtotal: 152000000, actualVatAmount: 12160000, actualTotalWithVat: 164160000,
        contractSubtotal: 152000000, diffAmount: 0,
        advancePaid: 50000000, remainingBalance: 114160000,
        actualTotalWithVatInWords: vndAmountInWords(164160000),
        remainingBalanceInWords: vndAmountInWords(114160000),
        reportDay: '20', reportMonth: '06', reportYear: '2026',
        acceptanceReport: { reportDate: new Date('2026-06-20'), actualValues: [], actualSubtotal: 152000000, actualVatAmount: 12160000, actualTotalWithVat: 164160000, contractSubtotal: 152000000, diffAmount: 0, advancePaid: 50000000, remainingBalance: 114160000, verdict: 'ACCEPTED', notes: '', status: 'FINALIZED', finalizedAt: null },
      },
      expectedMinOccurrences: 4, // BBNT thường 4-6 occurrences (header, căn cứ, phụ lục, kết luận, biên bản, payment)
    },
    {
      tpl: 'acceptance-racekit.docx',
      cn: '10.05/2026/HDDV/CTTFA-5BIB-6',
      ctx: {
        contractType: 'RACEKIT',
        documentType: 'ACCEPTANCE_REPORT',
        subtotal: 50000000, vatRate: 8, vatAmount: 4000000, totalAmount: 54000000,
        totalAmountInWords: vndAmountInWords(54000000),
        actualSubtotal: 50000000, actualVatAmount: 4000000, actualTotalWithVat: 54000000,
        contractSubtotal: 50000000, diffAmount: 0,
        advancePaid: 15000000, remainingBalance: 39000000, // 30/70 asymmetric
        actualTotalWithVatInWords: vndAmountInWords(54000000),
        remainingBalanceInWords: vndAmountInWords(39000000),
        reportDay: '20', reportMonth: '06', reportYear: '2026',
        acceptanceReport: { reportDate: new Date('2026-06-20'), actualValues: [], actualSubtotal: 50000000, actualVatAmount: 4000000, actualTotalWithVat: 54000000, contractSubtotal: 50000000, diffAmount: 0, advancePaid: 15000000, remainingBalance: 39000000, verdict: 'ACCEPTED', notes: '', status: 'FINALIZED', finalizedAt: null },
      },
      expectedMinOccurrences: 6, // F-044 Mapping Table E — 6 CN positions
    },
    {
      tpl: 'acceptance-operations.docx',
      cn: '20.05/2026/HDDV/OPS-5BIB-1',
      ctx: {
        contractType: 'OPERATIONS',
        documentType: 'ACCEPTANCE_REPORT',
        subtotal: 100000000, vatRate: 8, vatAmount: 8000000, totalAmount: 108000000,
        totalAmountInWords: vndAmountInWords(108000000),
        actualSubtotal: 100000000, actualVatAmount: 8000000, actualTotalWithVat: 108000000,
        contractSubtotal: 100000000, diffAmount: 0,
        advancePaid: 30000000, remainingBalance: 78000000, // asymmetric
        actualTotalWithVatInWords: vndAmountInWords(108000000),
        remainingBalanceInWords: vndAmountInWords(78000000),
        reportDay: '20', reportMonth: '06', reportYear: '2026',
        acceptanceReport: { reportDate: new Date('2026-06-20'), actualValues: [], actualSubtotal: 100000000, actualVatAmount: 8000000, actualTotalWithVat: 108000000, contractSubtotal: 100000000, diffAmount: 0, advancePaid: 30000000, remainingBalance: 78000000, verdict: 'ACCEPTED', notes: '', status: 'FINALIZED', finalizedAt: null },
      },
      expectedMinOccurrences: 4,
    },
  ];

  for (const c of cases) {
    describe(`${c.tpl} (CN=${c.cn})`, () => {
      let text: string;
      beforeAll(async () => {
        const ctx = baseCtx({ contractNumber: c.cn, ...c.ctx });
        const buf = await svc.renderDocx(c.tpl, ctx as never);
        text = await extractDocxText(buf);
        fs.writeFileSync(path.join(OUT_DIR, `${c.tpl}.txt`), text);
      });

      it(`renders DB contractNumber "${c.cn}" with ≥${c.expectedMinOccurrences} occurrences`, () => {
        // Count occurrences via simple split (avoid regex escape complexity)
        const count = text.split(c.cn).length - 1;
        if (count < c.expectedMinOccurrences) {
          throw new Error(
            `${c.tpl}: expected ≥${c.expectedMinOccurrences} occurrences of "${c.cn}" but got ${count}.\n` +
              `Text excerpt: ${text.slice(0, 800)}...`,
          );
        }
      });

      it(`does NOT contain any hardcoded CN sample`, () => {
        for (const sample of HARDCODED_CN_SAMPLES) {
          if (text.includes(sample)) {
            throw new Error(
              `${c.tpl}: HARDCODED sample "${sample}" FOUND in render output. Coder MUST fix template.`,
            );
          }
        }
      });

      it(`renders contractNumber after "Số:" or "số" prefix (header, căn cứ, phụ lục context)`, () => {
        // Every contract/BBNT template has "Số: <CN>" or "số <CN>" somewhere
        const hasNumberPrefix =
          text.includes(`Số: ${c.cn}`) ||
          text.includes(`Số:${c.cn}`) ||
          text.includes(`số ${c.cn}`) ||
          text.includes(`số: ${c.cn}`);
        if (!hasNumberPrefix) {
          throw new Error(
            `${c.tpl}: contractNumber "${c.cn}" found in text BUT NOT after "Số:" or "số" prefix. ` +
              `Verify template uses "Số: {contractNumber}" pattern.\n` +
              `Excerpt: ${text.slice(0, 500)}`,
          );
        }
      });
    });
  }

  // payment-request.docx — verify contractNumber rendering when paymentRequest present
  describe('payment-request.docx — verify CN rendering', () => {
    it('renders contractNumber if template uses it', async () => {
      const cn = 'HD/2026/05/PAY-001';
      const ctx = baseCtx({
        contractNumber: cn,
        contractType: 'TIMING',
        documentType: 'PAYMENT_REQUEST',
        subtotal: 100000000, vatRate: 8, vatAmount: 8000000, totalAmount: 108000000,
        totalAmountInWords: vndAmountInWords(108000000),
        paymentRequest: {
          requestDate: new Date('2026-06-20'),
          totalAmount: 108000000,
          advancePaid: 50000000,
          amountDue: 58000000,
          amountDueInWords: vndAmountInWords(58000000),
          paymentDeadline: new Date('2026-07-20'),
          status: 'DRAFT',
          paidAt: null,
          notes: '',
        },
        requestDay: '20',
        requestMonth: '06',
        requestYear: '2026',
      });
      const buf = await svc.renderDocx('payment-request.docx', ctx as never);
      const text = await extractDocxText(buf);
      fs.writeFileSync(path.join(OUT_DIR, 'payment-request.docx.txt'), text);
      // Verify CN appears at least once (payment request references contract)
      expect(text).toContain(cn);
      // No hardcoded CN sample
      for (const sample of HARDCODED_CN_SAMPLES) {
        expect(text).not.toContain(sample);
      }
    });
  });
});
