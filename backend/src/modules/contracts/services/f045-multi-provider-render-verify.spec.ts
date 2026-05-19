/**
 * F-045 Manager Content Review — multi-provider render verify.
 *
 * Render 5 templates × 2 provider variants = 10 outputs → write `.txt` to
 * `/tmp/f045-render-verify/output/` for Manager eyeball review per F-044 lesson
 * (DOCX Content Review Protocol mandate from `conventions.md`).
 *
 * NOT a regression test — orchestrator that writes per-template outputs.
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
import { getProviderEntity } from '../constants/provider-entities';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require('pizzip');

const OUT_DIR = '/tmp/f045-render-verify/output';

function extractText(buf: Buffer): string {
  const zip = new PizZip(buf);
  const xml = zip.file('word/document.xml').asText();
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function fixture(providerId: '5BIB' | '5SOLUTION', kind: 'contract' | 'bbnt') {
  const provider = getProviderEntity(providerId);
  const base = {
    contractNumber: `TEST/F-045/${providerId}/001`,
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
      { stt: 1, description: 'Bib chính thức', unit: 'bộ', unitPrice: 50000, quantity: 1000, discount: 0, amount: 50000000 },
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
    acceptanceReport: null as unknown as object | null,
    paymentRequest: null,
    requestDay: '',
    requestMonth: '',
    requestYear: '',
    generatedAt: new Date(),
  };
  if (kind === 'bbnt') {
    return {
      ...base,
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
        actualValues: base.lineItems,
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
  }
  return base;
}

describe('F-045 Manager Content Review — render 5 templates × 2 providers', () => {
  it('writes 10 plain text outputs to /tmp/f045-render-verify/output/', async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const svc = new DocumentGeneratorService();

    const cases = [
      // acceptance-racekit × 2 providers
      { tpl: 'acceptance-racekit.docx', providerId: '5BIB' as const, kind: 'bbnt' as const, label: 'acceptance-racekit-5BIB' },
      { tpl: 'acceptance-racekit.docx', providerId: '5SOLUTION' as const, kind: 'bbnt' as const, label: 'acceptance-racekit-5SOLUTION-override' },
      // acceptance-timing × 2 providers
      { tpl: 'acceptance-timing.docx', providerId: '5BIB' as const, kind: 'bbnt' as const, label: 'acceptance-timing-5BIB' },
      { tpl: 'acceptance-timing.docx', providerId: '5SOLUTION' as const, kind: 'bbnt' as const, label: 'acceptance-timing-5SOLUTION-override' },
      // acceptance-operations × 2 providers
      { tpl: 'acceptance-operations.docx', providerId: '5SOLUTION' as const, kind: 'bbnt' as const, label: 'acceptance-operations-5SOLUTION' },
      { tpl: 'acceptance-operations.docx', providerId: '5BIB' as const, kind: 'bbnt' as const, label: 'acceptance-operations-5BIB-override' },
      // contract-ticket-sales × 2 providers
      { tpl: 'contract-ticket-sales.docx', providerId: '5BIB' as const, kind: 'contract' as const, label: 'contract-ticket-sales-5BIB' },
      { tpl: 'contract-ticket-sales.docx', providerId: '5SOLUTION' as const, kind: 'contract' as const, label: 'contract-ticket-sales-5SOLUTION-override' },
      // contract-operations × 2 providers (Manager scope extension)
      { tpl: 'contract-operations.docx', providerId: '5SOLUTION' as const, kind: 'contract' as const, label: 'contract-operations-5SOLUTION' },
      { tpl: 'contract-operations.docx', providerId: '5BIB' as const, kind: 'contract' as const, label: 'contract-operations-5BIB-override' },
    ];

    for (const c of cases) {
      const ctx = fixture(c.providerId, c.kind);
      const buf = await svc.renderDocx(c.tpl, ctx as never);
      const text = extractText(buf);
      const provider = getProviderEntity(c.providerId);
      const header =
        `===== ${c.tpl} (provider=${c.providerId}) =====\n` +
        `Label: ${c.label}\n` +
        `Provider entityName: ${provider.entityName}\n` +
        `Provider bankAccount: ${provider.bankAccount}\n` +
        `Provider bankName: ${provider.bankName}\n` +
        `Provider taxId: ${provider.taxId}\n\n` +
        `===== RENDERED CONTENT =====\n\n`;
      fs.writeFileSync(path.join(OUT_DIR, `${c.label}.txt`), `${header}${text}\n`, 'utf-8');
      console.log(`✅ ${c.label}.txt`);
    }
    expect(fs.readdirSync(OUT_DIR).length).toBeGreaterThanOrEqual(10);
  }, 30000);
});
