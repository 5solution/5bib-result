/**
 * F-044 BUGFIX #1 (2026-05-19) — Số khớp Bằng chữ trong câu "Tổng giá trị
 * Hợp đồng (đã bao gồm 8% VAT)".
 *
 * Root cause: F-042 đã đặt {subtotal} ở vị trí thực tế là totalAmount
 * (câu "đã bao gồm VAT" = total INCLUDING VAT). F-044 thêm {totalAmountInWords}
 * cho "Bằng chữ" expose latent inconsistency.
 *
 * Fix: đổi {subtotal} → {totalAmount} trong contract-racekit.docx +
 * contract-operations.docx. Sau fix, số và chữ phải KHỚP.
 *
 * Manager content review 2026-05-19 phát hiện bug — REJECTED deploy. Spec này
 * verify fix chính xác và prevent regression.
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
import { extractDocxText } from '../../../../test/helpers/docx-text-extract';
import { vndAmountInWords } from '../utils/vn-num-to-words';

const BASE = {
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
  paymentTerms: {
    advancePercentage: 50,
    advanceAmount: 0,
    remainderPercentage: 50,
    remainderAmount: 0,
    paymentDeadlineDays: 15,
    latePenaltyRate: 0,
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

describe('F-044 BUGFIX #1 — Số khớp Bằng chữ trong contract templates', () => {
  let svc: DocumentGeneratorService;
  beforeEach(() => {
    svc = new DocumentGeneratorService();
  });

  describe('contract-racekit.docx — semantic số/chữ match', () => {
    it('renders totalAmount + totalAmountInWords cùng giá trị trong "Tổng giá trị (đã bao gồm 8% VAT)"', async () => {
      const ctx = {
        ...BASE,
        contractType: 'RACEKIT',
        subtotal: 50000000,
        vatRate: 8,
        vatAmount: 4000000,
        totalAmount: 54000000,
        totalAmountInWords: vndAmountInWords(54000000),
      };
      const buf = await svc.renderDocx('contract-racekit.docx', ctx);
      const text = await extractDocxText(buf);

      // Tìm câu "Tổng giá trị Hợp đồng (đã bao gồm 8% VAT): X VND (Bằng chữ: Y)"
      const m = text.match(
        /Tổng giá trị Hợp đồng \(đã bao gồm 8% VAT\):\s*([0-9.]+)\s*VND\s*\(Bằng chữ:\s*([^)]+)\)/,
      );
      expect(m).toBeTruthy();
      const [, numStr, wordsStr] = m!;
      expect(numStr).toBe('54.000.000');
      expect(wordsStr.trim()).toBe('Năm mươi tư triệu đồng');
      // Verify semantic: numeric value should match what vndAmountInWords produces
      expect(vndAmountInWords(54000000)).toBe(wordsStr.trim());
    });

    it('handles 1B+ VND scale với số khớp chữ', async () => {
      const ctx = {
        ...BASE,
        contractType: 'RACEKIT',
        subtotal: 1000000000,
        vatRate: 8,
        vatAmount: 80000000,
        totalAmount: 1080000000,
        totalAmountInWords: vndAmountInWords(1080000000),
      };
      const buf = await svc.renderDocx('contract-racekit.docx', ctx);
      const text = await extractDocxText(buf);
      expect(text).toContain('1.080.000.000 VND');
      expect(text).toContain(vndAmountInWords(1080000000));
    });
  });

  describe('contract-operations.docx — semantic số/chữ match', () => {
    it('renders totalAmount + totalAmountInWords cùng giá trị trong "Tổng giá trị (đã bao gồm 8% VAT)"', async () => {
      const ctx = {
        ...BASE,
        contractType: 'OPERATIONS',
        contractNumber: '20.05/2026/HDDV/OPS-5BIB-1',
        subtotal: 100000000,
        vatRate: 8,
        vatAmount: 8000000,
        totalAmount: 108000000,
        totalAmountInWords: vndAmountInWords(108000000),
      };
      const buf = await svc.renderDocx('contract-operations.docx', ctx);
      const text = await extractDocxText(buf);

      const m = text.match(
        /Tổng giá trị Hợp đồng \(đã bao gồm 8% VAT\):\s*([0-9.]+)\s*VNĐ\s*\(Bằng chữ:\s*([^)]+)\)/,
      );
      expect(m).toBeTruthy();
      const [, numStr, wordsStr] = m!;
      expect(numStr).toBe('108.000.000');
      expect(wordsStr.trim()).toBe('Một trăm lẻ tám triệu đồng');
      expect(vndAmountInWords(108000000)).toBe(wordsStr.trim());
    });
  });

  describe('Regression guard — {subtotal} placeholder MUST NOT exist trong vị trí "Tổng giá trị (đã bao gồm VAT)"', () => {
    it('contract-racekit.docx does NOT have {subtotal} placeholder anywhere (only {totalAmount})', async () => {
      const ctx = {
        ...BASE,
        contractType: 'RACEKIT',
        subtotal: 50000000,
        totalAmount: 54000000,
        totalAmountInWords: vndAmountInWords(54000000),
      };
      const buf = await svc.renderDocx('contract-racekit.docx', ctx);
      const text = await extractDocxText(buf);
      // Sau bugfix #1, contract-racekit KHÔNG có {subtotal} (đã đổi → {totalAmount}).
      // Verify literal placeholder string KHÔNG có (sẽ xuất hiện nếu render fail).
      expect(text).not.toContain('{subtotal}');
      // Subtotal value (50M) chỉ xuất hiện ở line item table, KHÔNG ở "Tổng giá trị" sentence.
      expect(text).not.toMatch(/đã bao gồm 8% VAT\):\s*50\.000\.000/);
    });

    it('contract-operations.docx does NOT have {subtotal} placeholder', async () => {
      const ctx = {
        ...BASE,
        contractType: 'OPERATIONS',
        contractNumber: '20.05/2026/HDDV/OPS-5BIB-1',
        subtotal: 100000000,
        totalAmount: 108000000,
        totalAmountInWords: vndAmountInWords(108000000),
      };
      const buf = await svc.renderDocx('contract-operations.docx', ctx);
      const text = await extractDocxText(buf);
      expect(text).not.toContain('{subtotal}');
      expect(text).not.toMatch(/đã bao gồm 8% VAT\):\s*100\.000\.000/);
    });
  });
});
