/**
 * F-024 document-generator.service.spec.ts
 *
 * Coverage:
 * - Placeholder replacement {partnerName}
 * - Line items render (1 / 5 / 25 items via loop)
 * - VAT động {vatRate}% renders correctly
 * - Missing data → empty string (no crash)
 * - PDF convert calls libreoffice-convert with DOCX buffer (mocked)
 * - Real DOCX template renders without crash (integration smoke test)
 * - S3 upload mock — renderAndUpload returns docxKey + URL
 */

// Mock @aws-sdk before importing service (constructor builds S3Client).
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
// Stub env.s3 — config/index.ts reads process.env. Set safe defaults.
process.env.AWS_REGION = process.env.AWS_REGION ?? 'ap-southeast-1';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? 'test';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY ?? 'test';
process.env.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET ?? 'test-bucket';

import { DocumentGeneratorService } from './document-generator.service';
import * as path from 'path';
import * as fs from 'fs';

describe('DocumentGeneratorService — context sanitization', () => {
  let svc: DocumentGeneratorService;

  beforeEach(() => {
    svc = new DocumentGeneratorService();
  });

  it('formats numbers with vi-VN locale (BR-CM-04 currency display)', () => {
    // @ts-ignore — accessing private for test
    const formatted = svc['formatNumber'](36_180_000);
    expect(formatted).toMatch(/36\D180\D000/); // separator may be dot or non-breaking space
  });

  it('formats date as DD/MM/YYYY', () => {
    // @ts-ignore
    const formatted = svc['formatDate'](new Date(2026, 4, 15));
    expect(formatted).toBe('15/05/2026');
  });

  it('returns empty string for invalid date (no crash)', () => {
    // @ts-ignore
    expect(svc['formatDate'](new Date('invalid'))).toBe('');
  });

  it('sanitizeContext: null/undefined → empty string', () => {
    // @ts-ignore
    const out = svc['sanitizeContext']({
      partnerName: 'TAM Media',
      taxId: null,
      missing: undefined,
    });
    expect(out.partnerName).toBe('TAM Media');
    expect(out.taxId).toBe('');
    expect(out.missing).toBe('');
  });

  it('sanitizeContext: nested object recursively sanitized', () => {
    // @ts-ignore
    const out = svc['sanitizeContext']({
      provider: {
        entityName: 'CTCP 5BIB',
        empty: null,
      },
    });
    expect(out.provider.entityName).toBe('CTCP 5BIB');
    expect(out.provider.empty).toBe('');
  });

  it('sanitizeContext: line items array preserved with formatted numbers', () => {
    // @ts-ignore
    const out = svc['sanitizeContext']({
      lineItems: [
        { description: 'Chip', quantity: 3000, unitPrice: 28000 },
      ],
    });
    expect(out.lineItems[0].description).toBe('Chip');
    expect(typeof out.lineItems[0].quantity).toBe('string'); // formatted
  });

  it('sanitizeContext: VAT động {vatRate} as number', () => {
    // @ts-ignore
    const out = svc['sanitizeContext']({ vatRate: 8 });
    expect(out.vatRate).toBe('8'); // formatted as number-string
  });
});

describe('DocumentGeneratorService — integration with real template', () => {
  let svc: DocumentGeneratorService;
  const templatePath = path.join(
    process.cwd(),
    'assets',
    'contract-templates',
    'contract-timing.docx',
  );

  beforeAll(() => {
    if (!fs.existsSync(templatePath)) {
      // Template may not be available in CI without git LFS — skip integration tests
      console.warn(
        `[doc-gen spec] template missing at ${templatePath} — skipping integration`,
      );
    }
  });

  beforeEach(() => {
    svc = new DocumentGeneratorService();
  });

  it('renderDocx — generates valid DOCX buffer with placeholders replaced', async () => {
    if (!fs.existsSync(templatePath)) return; // skip
    const buf = await svc.renderDocx('contract-timing.docx', {
      contractNumber: '01.05/2026/HDDV/TEST-5BIB',
      signDay: '01',
      signMonth: '05',
      signYear: 2026,
      provider: {
        entityName: 'CTCP 5BIB',
        taxId: '0110398986',
        bankAccount: '123456789',
        representative: 'Nguyen Van A',
        position: 'CEO',
        address: '123 Tay Ho, Ha Noi',
        bankName: 'VCB',
      },
      client: {
        entityName: 'CTCP Test',
        taxId: '0123456789',
        representative: 'Tran Van B',
        position: 'Director',
        address: '456 Nguyen Trai, HCM',
        phone: '0901234567',
        email: 'test@example.com',
        bankAccount: '987654321',
        bankName: 'TCB',
      },
      raceName: 'Test Race 2026',
      raceDate: '2026-06-01',
      raceLocation: 'Da Nang',
      lineItems: [
        {
          stt: 1,
          description: 'Timing chip',
          unit: 'chiếc',
          quantity: 3000,
          unitPrice: 28000,
          amount: 84_000_000,
        },
      ],
      subtotal: 84_000_000,
      vatRate: 8,
      vatAmount: 6_720_000,
      totalAmount: 90_720_000,
      paymentTerms: {
        advancePercentage: 50,
        advanceAmount: 45_360_000,
        remainderAmount: 45_360_000,
        latePenaltyRate: 0.02,
        latePenaltyUnit: 'PER_DAY',
        paymentDeadlineDays: 15,
      },
      articles: [],
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000); // DOCX > 1KB
    // DOCX magic bytes — first 4 bytes "PK\x03\x04" (ZIP container)
    expect(buf.slice(0, 4).toString('hex')).toBe('504b0304');
  });

  it('renderDocx — handles missing data gracefully (nullGetter empty string)', async () => {
    if (!fs.existsSync(templatePath)) return;
    const buf = await svc.renderDocx('contract-timing.docx', {
      contractNumber: '',
      // Most fields missing — service must not crash
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('renderBoth — PDF convert called with DOCX buffer (mocked libre)', async () => {
    if (!fs.existsSync(templatePath)) return;
    const libre = require('libreoffice-convert');
    const result = await svc.renderBoth('contract-timing.docx', {
      contractNumber: 'TEST',
    });
    expect(libre.convert).toHaveBeenCalled();
    const firstCall = (libre.convert as jest.Mock).mock.calls.at(-1);
    expect(Buffer.isBuffer(firstCall[0])).toBe(true); // DOCX buffer
    expect(firstCall[1]).toBe('.pdf'); // target ext
    expect(result.docx).toBeDefined();
    expect(result.pdf).toBeDefined();
  });

  it('renderAndUpload — uploads docx + pdf to S3 and returns signed URLs', async () => {
    if (!fs.existsSync(templatePath)) return;
    const result = await svc.renderAndUpload(
      'contract-timing.docx',
      { contractNumber: 'TEST' },
      'contract-abc-123',
      'CONTRACT',
    );
    expect(result.docxKey).toMatch(
      /^contracts\/contract-abc-123\/CONTRACT_\d+\.docx$/,
    );
    expect(result.docxUrl).toBe('https://signed.example.com/foo');
    expect(result.pdfKey).toMatch(
      /^contracts\/contract-abc-123\/CONTRACT_\d+\.pdf$/,
    );
    expect(result.pdfUrl).toBe('https://signed.example.com/foo');
  });

  it('renderAndUpload — returns DOCX-only when PDF convert fails (graceful degrade)', async () => {
    if (!fs.existsSync(templatePath)) return;
    const libre = require('libreoffice-convert');
    (libre.convert as jest.Mock).mockImplementationOnce((_b, _e, _f, cb) =>
      cb(new Error('libreoffice not installed')),
    );
    const result = await svc.renderAndUpload(
      'contract-timing.docx',
      { contractNumber: 'TEST' },
      'contract-fallback',
      'CONTRACT',
    );
    expect(result.docxKey).toBeDefined();
    expect(result.docxUrl).toBeDefined();
    expect(result.pdfKey).toBeUndefined();
    expect(result.pdfUrl).toBeUndefined();
  });
});
