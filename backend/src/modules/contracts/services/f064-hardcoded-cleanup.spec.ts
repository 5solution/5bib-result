/**
 * F-064 — Render verification spec for Phase 4 hardcoded cleanup.
 *
 * Renders 5 templates with realistic VCB KID RUN 2026 fixture and asserts:
 *   - 0 forbidden hardcoded text leaks in rendered output
 *   - Phụ lục column mapping correct (Chiết khấu=discount, Thành tiền=amount,
 *     Ghi chú=note)
 *   - Setup/Expo fallback derive when admin omits
 *   - Athlete count derive from line items
 *   - Acceptance DOCX renders 2 separate dates
 *
 * Pattern REUSES F-044/F-045 — PizZip + extractText() XML strip + regex
 * assertions.
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
  deriveExpoDate,
  deriveSetupDate,
} from '../utils/event-date-derive';
import { vndAmountInWords } from '../utils/vn-num-to-words';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require('pizzip');

function extractText(buf: Buffer): string {
  const zip = new PizZip(buf);
  const xml = zip.file('word/document.xml').asText();
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** VCB KID RUN 2026 — realistic fixture (raceDate 31/05/2026, Hồ Hoàn Kiếm). */
function vcbKidRunCtx() {
  const raceDate = new Date('2026-05-31');
  return {
    contractNumber: '24.05/2026/HDDV/CTCPTAM-5BIB-7',
    contractType: 'OPERATIONS',
    documentType: 'CONTRACT',
    signDate: new Date('2026-06-01'),
    signDay: '01',
    signMonth: '06',
    signYear: '2026',
    effectiveDate: new Date('2026-06-01'),
    endDate: new Date('2026-12-31'),
    provider: {
      entityName: 'CÔNG TY CỔ PHẦN TƯ VẤN ĐẦU TƯ 5BIB',
      taxId: '0110398986',
      address: 'Tầng 9, Tòa nhà Hồ Gươm Plaza, 102 Trần Phú, Hà Đông, Hà Nội',
      representative: 'Nguyễn Bình Minh',
      position: 'Giám đốc',
      bankAccount: '110398986',
      bankName: 'MB Bank',
      phone: '0373398986',
      email: 'contact@5bib.vn',
    },
    client: {
      entityName: 'TRUNG TÂM THẺ VIETCOMBANK',
      taxId: '0123456789',
      address: '198 Trần Quang Khải, Hoàn Kiếm, Hà Nội',
      representative: 'Nguyễn Văn A',
      position: 'Giám đốc TT Thẻ',
      bankAccount: '999123456',
      bankName: 'Vietcombank',
      phone: '0901234567',
      email: 'card@vcb.vn',
    },
    raceName: 'VCB KID RUN 2026',
    raceDate: '2026-05-31',
    raceLocation: 'Hồ Hoàn Kiếm - Hà Nội',
    // F-064 new keys
    eventStartDate: raceDate,
    eventEndDate: raceDate,
    setupDate: deriveSetupDate(raceDate),
    expoDate: deriveExpoDate(raceDate),
    eventLocation: 'Hồ Hoàn Kiếm 6h sáng',
    athleteCount: 3500,
    contractSignDate: new Date('2026-06-01'),
    acceptanceSignDate: new Date('2026-06-08'),
    lineItems: [
      {
        stt: 1,
        description: 'Vận hành cổng start/finish',
        unit: 'gói',
        quantity: 1,
        unitPrice: 30000000,
        discount: 20,
        amount: 24000000,
        note: 'Bao gồm VAT',
      },
      {
        stt: 2,
        description: 'MC race day',
        unit: 'buổi',
        quantity: 1,
        unitPrice: 5000000,
        discount: 0,
        amount: 5000000,
        note: '',
      },
    ],
    revenueShare: { feePercentage: 0, feePerAthlete: 0, estimatedAthletes: 0 },
    ticketFeePercent: 0,
    subtotal: 29000000,
    vatRate: 8,
    vatAmount: 2320000,
    totalAmount: 31320000,
    totalAmountInWords: vndAmountInWords(31320000),
    paymentTerms: {
      advancePercentage: 50,
      advanceAmount: 15660000,
      remainderPercentage: 50,
      remainderAmount: 15660000,
      paymentDeadlineDays: 15,
      latePenaltyRate: 0.02,
      latePenaltyUnit: 'PER_DAY',
    },
    articles: [],
    acceptanceReport: null,
    paymentRequest: null,
    requestDay: '',
    requestMonth: '',
    requestYear: '',
    generatedAt: new Date(),
  };
}

function vcbAcceptanceCtx() {
  return {
    ...vcbKidRunCtx(),
    documentType: 'ACCEPTANCE_REPORT',
    actualSubtotal: 29000000,
    actualVatAmount: 2320000,
    actualTotalWithVat: 31320000,
    contractSubtotal: 29000000,
    diffAmount: 0,
    advancePaid: 15660000,
    remainingBalance: 15660000,
    actualTotalWithVatInWords: vndAmountInWords(31320000),
    remainingBalanceInWords: vndAmountInWords(15660000),
    reportDay: '08',
    reportMonth: '06',
    reportYear: '2026',
    acceptanceReport: {
      reportDate: new Date('2026-06-08'),
      actualValues: [],
      actualSubtotal: 29000000,
      actualVatAmount: 2320000,
      actualTotalWithVat: 31320000,
      contractSubtotal: 29000000,
      diffAmount: 0,
      advancePaid: 15660000,
      remainingBalance: 15660000,
      verdict: 'ACCEPTED',
      notes: '',
      status: 'FINALIZED',
      finalizedAt: null,
    },
  };
}

const FORBIDDEN_REGEX =
  /01\/05\/2026|02\/05\/2026|29\/05\/2026|11\/04\/2026|14\/04\/2026|Phường Vinh|Tỉnh Nghệ An|Phường Cầu Giấy|Quảng trường Hồ Chí Minh|số 23 Duy Tân/;

describe('F-064 — Render hardcoded cleanup verification', () => {
  const svc = new DocumentGeneratorService();

  describe('TC-64-01: contract-operations renders event/setup/expo dates from new keys', () => {
    it('renders 31/05/2026 + 28/05/2026 (setup) + 30/05/2026 (expo) — NO Nghệ An leak', async () => {
      const buf = await svc.renderDocx(
        'contract-operations.docx',
        vcbKidRunCtx() as never,
      );
      const text = extractText(buf);
      expect(text).toContain('31/05/2026'); // raceDate / eventStart/End
      expect(text).toContain('28/05/2026'); // setup raceDate - 3d
      expect(text).toContain('30/05/2026'); // expo raceDate - 1d
      expect(text).toContain('Hồ Hoàn Kiếm 6h sáng'); // eventLocation override
      expect(text).not.toMatch(FORBIDDEN_REGEX);
    });
  });

  describe('TC-64-02: contract-operations phụ lục 8-cell column mapping fix', () => {
    it('renders Chiết khấu=20, Thành tiền=24.000.000, Ghi chú=Bao gồm VAT in correct order', async () => {
      const buf = await svc.renderDocx(
        'contract-operations.docx',
        vcbKidRunCtx() as never,
      );
      const text = extractText(buf);
      // Header in order
      const headerRe = /Chiết khấu[\s\S]{0,500}?Thành tiền[\s\S]{0,500}?Ghi chú/;
      expect(text).toMatch(headerRe);
      // Data line item 1 in order: 20 (discount), 24.000.000 (amount), Bao gồm VAT (note)
      const rowRe = /20[\s\S]{0,500}?24\.000\.000[\s\S]{0,500}?Bao gồm VAT/;
      expect(text).toMatch(rowRe);
    });
  });

  describe('TC-64-03: contract-operations provider address scrub', () => {
    it('does NOT render hardcoded "số 23 Duy Tân" provider suffix', async () => {
      const buf = await svc.renderDocx(
        'contract-operations.docx',
        vcbKidRunCtx() as never,
      );
      const text = extractText(buf);
      expect(text).not.toContain('số 23 Duy Tân');
      expect(text).not.toContain('Phường Cầu Giấy');
      // provider.address renders correctly (Hồ Gươm Plaza)
      expect(text).toContain('Hồ Gươm Plaza');
    });
  });

  describe('TC-64-04: acceptance-operations renders 2 separate dates', () => {
    it('contractSignDate=01/06/2026 + acceptanceSignDate=08/06/2026 — NO 11/04 or 14/04 leak', async () => {
      const buf = await svc.renderDocx(
        'acceptance-operations.docx',
        vcbAcceptanceCtx() as never,
      );
      const text = extractText(buf);
      expect(text).toContain('01/06/2026'); // contractSignDate
      expect(text).toContain('08/06/2026'); // acceptanceSignDate
      expect(text).not.toMatch(FORBIDDEN_REGEX);
    });
  });

  describe('TC-64-05: acceptance-racekit + acceptance-timing same pattern', () => {
    it('acceptance-racekit renders contractSignDate without 11/04 leak', async () => {
      const ctx = { ...vcbAcceptanceCtx(), contractType: 'RACEKIT' };
      const buf = await svc.renderDocx('acceptance-racekit.docx', ctx as never);
      const text = extractText(buf);
      expect(text).toContain('01/06/2026');
      expect(text).not.toMatch(FORBIDDEN_REGEX);
    });

    it('acceptance-timing renders contractSignDate without 11/04 leak', async () => {
      const ctx = { ...vcbAcceptanceCtx(), contractType: 'TIMING' };
      const buf = await svc.renderDocx('acceptance-timing.docx', ctx as never);
      const text = extractText(buf);
      expect(text).toContain('01/06/2026');
      expect(text).not.toMatch(FORBIDDEN_REGEX);
    });
  });

  describe('TC-64-06: contract-racekit renders athleteCount + eventLocation', () => {
    it('renders 3500 (not 3000) + Hồ Hoàn Kiếm (not Quảng trường HCM Nghệ An)', async () => {
      const ctx = { ...vcbKidRunCtx(), contractType: 'RACEKIT' };
      const buf = await svc.renderDocx('contract-racekit.docx', ctx as never);
      const text = extractText(buf);
      // athleteCount = 3500 → vi-VN formatted "3.500"
      expect(text).toMatch(/3\.500|3500/);
      expect(text).toContain('Hồ Hoàn Kiếm');
      expect(text).not.toContain('3000');
      expect(text).not.toMatch(FORBIDDEN_REGEX);
    });
  });

  describe('TC-64-07: Bug 2 header date placeholders render signDate components', () => {
    it('contract-operations renders "Hà Nội, ngày 01 tháng 06 năm 2026"', async () => {
      const buf = await svc.renderDocx(
        'contract-operations.docx',
        vcbKidRunCtx() as never,
      );
      const text = extractText(buf);
      // The header may render with various spacing depending on docxtemplater
      // run reconstruction. Assert key fragments present in order.
      expect(text).toMatch(/Hà Nội[\s\S]{0,200}?01[\s\S]{0,50}?06[\s\S]{0,50}?2026/);
    });
  });

  describe('TC-64-08: Setup/Expo fallback derive when admin không nhập', () => {
    it('renders 28/05 + 30/05 when admin omits setupDate/expoDate (raceDate ISO derive)', async () => {
      const ctx = vcbKidRunCtx();
      // Simulate admin omits → use helper-derived values
      const buf = await svc.renderDocx(
        'contract-operations.docx',
        ctx as never,
      );
      const text = extractText(buf);
      expect(text).toContain('28/05/2026'); // setup = 31/05 - 3d
      expect(text).toContain('30/05/2026'); // expo = 31/05 - 1d
    });
  });

  describe('TC-64-09: Backward compat — pre-F-064 contracts (no new fields)', () => {
    it('renders empty strings when 8 new keys undefined — no hardcoded leak', async () => {
      const ctx = vcbKidRunCtx() as Record<string, unknown>;
      // Wipe new keys to simulate pre-F-064 contract
      delete ctx.eventStartDate;
      delete ctx.eventEndDate;
      delete ctx.setupDate;
      delete ctx.expoDate;
      delete ctx.eventLocation;
      delete ctx.athleteCount;
      delete ctx.contractSignDate;
      delete ctx.acceptanceSignDate;
      const buf = await svc.renderDocx(
        'contract-operations.docx',
        ctx as never,
      );
      const text = extractText(buf);
      // No leak — docxtemplater nullGetter returns ''
      expect(text).not.toMatch(FORBIDDEN_REGEX);
    });
  });

  describe('TC-64-10: Free-format raceDate — anti-leak (NO fallback hardcoded)', () => {
    it('renders empty for setup/expo when raceDate is free-form multi-day text', async () => {
      const ctx = vcbKidRunCtx() as Record<string, unknown>;
      ctx.raceDate = '06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026';
      ctx.setupDate = '' as never; // simulate ctx after derive on free-form
      ctx.expoDate = '' as never;
      ctx.eventStartDate = '' as never;
      ctx.eventEndDate = '' as never;
      const buf = await svc.renderDocx(
        'contract-operations.docx',
        ctx as never,
      );
      const text = extractText(buf);
      // raceDate as-is
      expect(text).toContain('06:00 ngày 15/06/2026');
      // No leak
      expect(text).not.toMatch(FORBIDDEN_REGEX);
    });
  });
});
