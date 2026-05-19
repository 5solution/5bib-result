/**
 * F-044 — Manager Content Review render verify (one-shot test that writes
 * rendered text output to /tmp/f044-render-verify/output/ for eyeball review).
 *
 * NOT a regular spec — single test that orchestrates rendering. Used by
 * Manager per Danny request 2026-05-19: "tuyệt đối không được sai".
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
import { vndAmountInWords } from '../utils/vn-num-to-words';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require('pizzip');

const OUT_DIR = '/tmp/f044-render-verify/output';

function extractText(buf: Buffer): string {
  const zip = new PizZip(buf);
  const xml = zip.file('word/document.xml').asText();
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const BASE_CTX = {
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
    address: 'Tầng 9, Hồ Gươm Plaza, 102 Trần Phú, Hà Đông, Hà Nội',
    representative: 'Nguyễn Bình Minh',
    position: 'Giám đốc',
    bankAccount: '110398986',
    bankName: 'MB Bank',
    phone: '0373398986',
    email: 'contact@xyz.vn',
  },
  client: {
    entityName: 'CÔNG TY TNHH CÁT TIÊN ADVENTURE',
    taxId: '0123456789',
    address: '123 Đường ABC, TP. Biên Hoà, Đồng Nai',
    representative: 'Trần Văn A',
    position: 'CEO',
    bankAccount: '999123456',
    bankName: 'Vietcombank',
    phone: '0901234567',
    email: 'a@cattienadventure.vn',
  },
  raceName: 'Cát Tiên Trail Family Adventure',
  raceDate: new Date('2026-06-15'),
  raceLocation: 'VQG Cát Tiên, Đồng Nai',
  lineItems: [
    {
      stt: 1,
      description: 'Bib chính thức',
      unit: 'bộ',
      unitPrice: 50000,
      quantity: 1000,
      discount: 0,
      amount: 50000000,
    },
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
};

const BBNT_ASYMMETRIC = {
  ...BASE_CTX,
  documentType: 'ACCEPTANCE_REPORT',
  actualSubtotal: 50000000,
  actualVatAmount: 4000000,
  actualTotalWithVat: 54000000,
  contractSubtotal: 50000000,
  diffAmount: 0,
  advancePaid: 15000000,
  remainingBalance: 39000000,
  actualTotalWithVatInWords: vndAmountInWords(54000000),
  remainingBalanceInWords: vndAmountInWords(39000000),
  reportDay: '20',
  reportMonth: '06',
  reportYear: '2026',
  acceptanceReport: {
    reportDate: new Date('2026-06-20'),
    actualValues: BASE_CTX.lineItems,
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

describe('F-044 Manager Content Review — render 6 templates with realistic fixture', () => {
  it('renders all 6 templates and writes plain text to /tmp/f044-render-verify/output/', async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const svc = new DocumentGeneratorService();

    const cases = [
      { tpl: 'contract-racekit.docx', ctx: { ...BASE_CTX }, label: '1-contract-racekit-RACEKIT-54M' },
      {
        tpl: 'contract-operations.docx',
        ctx: {
          ...BASE_CTX,
          contractType: 'OPERATIONS',
          contractNumber: '20.05/2026/HDDV/OPS-5BIB-1',
          subtotal: 100000000,
          vatAmount: 8000000,
          totalAmount: 108000000,
          totalAmountInWords: vndAmountInWords(108000000),
        },
        label: '2-contract-operations-OPS-108M',
      },
      {
        tpl: 'contract-ticket-sales.docx',
        ctx: {
          ...BASE_CTX,
          contractType: 'TICKET_SALES',
          contractNumber: '01.05/2026/HDDV/XYZ-5BIB-1',
        },
        label: '3-contract-ticket-sales-XYZ',
      },
      {
        tpl: 'acceptance-timing.docx',
        ctx: {
          ...BBNT_ASYMMETRIC,
          contractType: 'TIMING',
          contractNumber: 'HD/2026/05/001',
          actualSubtotal: 25870000,
          actualVatAmount: 2069600,
          actualTotalWithVat: 27939600,
          advancePaid: 13969800,
          remainingBalance: 13969800,
          actualTotalWithVatInWords: vndAmountInWords(27939600),
          remainingBalanceInWords: vndAmountInWords(13969800),
          acceptanceReport: {
            ...BBNT_ASYMMETRIC.acceptanceReport,
            actualSubtotal: 25870000,
            actualVatAmount: 2069600,
            actualTotalWithVat: 27939600,
            advancePaid: 13969800,
            remainingBalance: 13969800,
          },
        },
        label: '4-acceptance-timing-50-50-TIMING',
      },
      {
        tpl: 'acceptance-racekit.docx',
        ctx: BBNT_ASYMMETRIC,
        label: '5-acceptance-racekit-30-70-ASYMMETRIC-Adjustment1',
      },
      {
        tpl: 'acceptance-operations.docx',
        ctx: {
          ...BBNT_ASYMMETRIC,
          contractType: 'OPERATIONS',
          contractNumber: 'HD/2026/05/OPS-1',
          actualSubtotal: 245000000,
          actualVatAmount: 19600000,
          actualTotalWithVat: 264600000,
          advancePaid: 132000000,
          remainingBalance: 132600000,
          actualTotalWithVatInWords: vndAmountInWords(264600000),
          remainingBalanceInWords: vndAmountInWords(132600000),
          acceptanceReport: {
            ...BBNT_ASYMMETRIC.acceptanceReport,
            actualSubtotal: 245000000,
            actualVatAmount: 19600000,
            actualTotalWithVat: 264600000,
            advancePaid: 132000000,
            remainingBalance: 132600000,
          },
        },
        label: '6-acceptance-operations-OPS-264M',
      },
    ];

    for (const c of cases) {
      const buf = await svc.renderDocx(c.tpl, c.ctx as never);
      const text = extractText(buf);
      const outPath = path.join(OUT_DIR, `${c.label}.txt`);
      const header =
        `===== ${c.tpl} =====\n` +
        `Label: ${c.label}\n` +
        `ContractNumber: ${c.ctx.contractNumber}\n` +
        `ContractType: ${c.ctx.contractType}\n` +
        `TotalAmount: ${c.ctx.totalAmount.toLocaleString('vi-VN')} VND\n` +
        ('advancePaid' in c.ctx
          ? `advancePaid: ${(c.ctx as { advancePaid: number }).advancePaid.toLocaleString('vi-VN')} VND\n` +
            `remainingBalance: ${(c.ctx as { remainingBalance: number }).remainingBalance.toLocaleString('vi-VN')} VND\n`
          : '');
      fs.writeFileSync(
        outPath,
        `${header}\n\n===== RENDERED CONTENT =====\n\n${text}\n`,
        'utf-8',
      );
      console.log(`✅ ${c.tpl} → ${outPath}`);
    }
    expect(fs.readdirSync(OUT_DIR).length).toBeGreaterThanOrEqual(6);
  }, 30000);
});
