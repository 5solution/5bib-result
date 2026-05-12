import { buildDocumentFilename } from './build-filename';

describe('buildDocumentFilename — F-024 output naming', () => {
  const signDate = new Date('2026-05-15T03:00:00Z'); // → DD=15 local (Asia/Bangkok UTC+7)
  // Use UTC date construction to be timezone-agnostic in tests
  const fixedSign = new Date(2026, 4, 15); // May 15, 2026 local
  const fixedSignJune = new Date(2026, 5, 20); // June 20, 2026 local

  it('1. TIMING 5BIB CONTRACT → [5BIB] CÔNG TY TNHH XYZ - Hợp đồng dịch vụ tính giờ - 15.05.2026.docx', () => {
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: 'CÔNG TY TNHH XYZ',
      docType: 'CONTRACT',
      contractType: 'TIMING',
      signDate: fixedSign,
      format: 'docx',
    });
    expect(out).toBe(
      '[5BIB] CÔNG TY TNHH XYZ - Hợp đồng dịch vụ tính giờ - 15.05.2026.docx',
    );
  });

  it('2. OPERATIONS 5SOLUTION CONTRACT → [5S] Thành An Media - Hợp đồng vận hành - 20.06.2026.docx', () => {
    const out = buildDocumentFilename({
      providerId: '5SOLUTION',
      partnerName: 'Thành An Media',
      docType: 'CONTRACT',
      contractType: 'OPERATIONS',
      signDate: fixedSignJune,
      format: 'docx',
    });
    expect(out).toBe(
      '[5S] Thành An Media - Hợp đồng vận hành - 20.06.2026.docx',
    );
  });

  it('3. ACCEPTANCE_REPORT TIMING → [5BIB] XYZ - Biên bản nghiệm thu tính giờ - 15.05.2026.docx', () => {
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: 'XYZ',
      docType: 'ACCEPTANCE_REPORT',
      contractType: 'TIMING',
      signDate: fixedSign,
      format: 'docx',
    });
    expect(out).toBe(
      '[5BIB] XYZ - Biên bản nghiệm thu tính giờ - 15.05.2026.docx',
    );
  });

  it('4. PAYMENT_REQUEST → [5BIB] XYZ - Đề nghị thanh toán - 15.05.2026.docx', () => {
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: 'XYZ',
      docType: 'PAYMENT_REQUEST',
      contractType: 'TIMING',
      signDate: fixedSign,
      format: 'docx',
    });
    expect(out).toBe('[5BIB] XYZ - Đề nghị thanh toán - 15.05.2026.docx');
  });

  it('5. QUOTATION TIMING + no signDate → [5BIB] XYZ - Báo giá dịch vụ tính giờ.xlsx (bỏ ngày)', () => {
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: 'XYZ',
      docType: 'QUOTATION',
      contractType: 'TIMING',
      signDate: null,
      fallbackDate: null,
      format: 'xlsx',
    });
    expect(out).toBe('[5BIB] XYZ - Báo giá dịch vụ tính giờ.xlsx');
  });

  it('6. TICKET_SALES CONTRACT → [5BIB] XYZ - Hợp đồng bán vé - DD.MM.YYYY.docx', () => {
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: 'XYZ',
      docType: 'CONTRACT',
      contractType: 'TICKET_SALES',
      signDate: fixedSign,
      format: 'docx',
    });
    expect(out).toBe('[5BIB] XYZ - Hợp đồng bán vé - 15.05.2026.docx');
  });

  it('7. Entity name "A/B Corp" — replace `/` thành `-`', () => {
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: 'A/B Corp',
      docType: 'CONTRACT',
      contractType: 'TIMING',
      signDate: fixedSign,
      format: 'docx',
    });
    expect(out).toBe(
      '[5BIB] A-B Corp - Hợp đồng dịch vụ tính giờ - 15.05.2026.docx',
    );
  });

  it('8. Entity name dài >100 chars → truncate + ellipsis', () => {
    const longName = 'CÔNG TY TNHH MTV ' + 'A'.repeat(150);
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: longName,
      docType: 'CONTRACT',
      contractType: 'TIMING',
      signDate: fixedSign,
      format: 'docx',
    });
    // partner segment phải là 100 chars + "..." (max thực ≤ 103)
    const match = out.match(/^\[5BIB\] (.+) - Hợp đồng dịch vụ tính giờ - 15\.05\.2026\.docx$/);
    expect(match).toBeTruthy();
    const partnerSeg = match![1];
    expect(partnerSeg.endsWith('...')).toBe(true);
    expect(partnerSeg.length).toBeLessThanOrEqual(103);
    expect(partnerSeg.startsWith('CÔNG TY TNHH MTV')).toBe(true);
  });

  it('9. Quotation TIMING với fallbackDate (createdAt) khi signDate null', () => {
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: 'XYZ',
      docType: 'QUOTATION',
      contractType: 'TIMING',
      signDate: null,
      fallbackDate: fixedSign,
      format: 'xlsx',
    });
    expect(out).toBe(
      '[5BIB] XYZ - Báo giá dịch vụ tính giờ - 15.05.2026.xlsx',
    );
  });

  it('10. RACEKIT contract — service label "vận hành racekit"', () => {
    const out = buildDocumentFilename({
      providerId: '5SOLUTION',
      partnerName: 'Thành An Media',
      docType: 'CONTRACT',
      contractType: 'RACEKIT',
      signDate: fixedSign,
      format: 'docx',
    });
    expect(out).toBe(
      '[5S] Thành An Media - Hợp đồng vận hành racekit - 15.05.2026.docx',
    );
  });

  it('11. Empty partnerName → fallback "doi-tac"', () => {
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: '',
      docType: 'CONTRACT',
      contractType: 'TIMING',
      signDate: fixedSign,
      format: 'docx',
    });
    expect(out).toBe(
      '[5BIB] doi-tac - Hợp đồng dịch vụ tính giờ - 15.05.2026.docx',
    );
  });

  it('12. PDF format extension', () => {
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: 'XYZ',
      docType: 'CONTRACT',
      contractType: 'TIMING',
      signDate: fixedSign,
      format: 'pdf',
    });
    expect(out).toBe(
      '[5BIB] XYZ - Hợp đồng dịch vụ tính giờ - 15.05.2026.pdf',
    );
  });

  it('13. Invalid date string → fallback null (bỏ phần ngày)', () => {
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: 'XYZ',
      docType: 'QUOTATION',
      contractType: 'TIMING',
      signDate: 'not-a-date',
      fallbackDate: null,
      format: 'xlsx',
    });
    expect(out).toBe('[5BIB] XYZ - Báo giá dịch vụ tính giờ.xlsx');
  });

  it('14. Backslash `\\` trong tên — cũng replace thành `-`', () => {
    const out = buildDocumentFilename({
      providerId: '5BIB',
      partnerName: 'A\\B Co',
      docType: 'CONTRACT',
      contractType: 'TIMING',
      signDate: fixedSign,
      format: 'docx',
    });
    expect(out).toBe(
      '[5BIB] A-B Co - Hợp đồng dịch vụ tính giờ - 15.05.2026.docx',
    );
  });
});
