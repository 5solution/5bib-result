/**
 * F-044 — build-filename HYBRID Option C tests.
 *
 * Tests cover:
 *   - TC-44-07: HYBRID happy path — `[CN] - [Race] - [DocType].ext`
 *   - TC-44-08: Backward compat — F-024 pattern khi contractNumber missing
 *   - TC-44-09: Sanitize edge cases — slashes, control chars, long names, VN diacritics
 *
 * Per BR-44-08..12 + Manager plan Scope Lock.
 */

import { buildDocumentFilename } from './build-filename';

describe('F-044 buildDocumentFilename — HYBRID Option C pattern', () => {
  const fixedSign = new Date(2026, 4, 15); // May 15, 2026 local

  describe('TC-44-07: HYBRID happy path', () => {
    it('produces `[CN sanitized] - [RaceName] - [DocType].ext` when both contractNumber + raceName present', () => {
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'CÔNG TY CỔ PHẦN ĐẦU TƯ THƯƠNG MẠI DỊCH VỤ XYZ VIỆT NAM', // VN long name
        docType: 'CONTRACT',
        contractType: 'RACEKIT',
        signDate: fixedSign,
        format: 'docx',
        contractNumber: '10.05/2026/HDDV/CTTFA-5BIB-6',
        raceName: 'Cát Tiên Trail Family Adventure',
      });
      // contractNumber `/` → `.` sanitized
      expect(out).toBe(
        '10.05.2026.HDDV.CTTFA-5BIB-6 - Cát Tiên Trail Family Adventure - Hợp đồng.docx',
      );
    });

    it('uses ACCEPTANCE_REPORT docLabel for BBNT', () => {
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'CÔNG TY ABC',
        docType: 'ACCEPTANCE_REPORT',
        contractType: 'RACEKIT',
        signDate: fixedSign,
        format: 'docx',
        contractNumber: '10.05/2026/HDDV/CTTFA-5BIB-6',
        raceName: 'Cát Tiên Trail Family Adventure',
      });
      expect(out).toBe(
        '10.05.2026.HDDV.CTTFA-5BIB-6 - Cát Tiên Trail Family Adventure - Biên bản nghiệm thu.docx',
      );
    });

    it('handles dash-format contract number (TICKET_SALES style)', () => {
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'Đối tác',
        docType: 'CONTRACT',
        contractType: 'TICKET_SALES',
        signDate: fixedSign,
        format: 'docx',
        contractNumber: '25.02-HDDV-5BIB-TAM',
        raceName: 'Test Race 1000 VĐV',
      });
      // No slash in input → no transform needed
      expect(out).toBe(
        '25.02-HDDV-5BIB-TAM - Test Race 1000 VĐV - Hợp đồng.docx',
      );
    });

    it('handles PDF format', () => {
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'X',
        docType: 'CONTRACT',
        contractType: 'TIMING',
        signDate: fixedSign,
        format: 'pdf',
        contractNumber: '01.01/2026/HDDV/ABC-XYZ',
        raceName: 'Marathon Hà Nội',
      });
      expect(out).toBe(
        '01.01.2026.HDDV.ABC-XYZ - Marathon Hà Nội - Hợp đồng.pdf',
      );
    });
  });

  describe('TC-44-08: Backward compat F-024 pattern when contractNumber missing', () => {
    it('falls back to F-024 pattern when contractNumber = null', () => {
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'CÔNG TY TNHH XYZ',
        docType: 'CONTRACT',
        contractType: 'TIMING',
        signDate: fixedSign,
        format: 'docx',
        contractNumber: null,
        raceName: 'Marathon Hà Nội',
      });
      // Falls back to F-024 (Quotation/Pre-contract preserve)
      expect(out).toBe(
        '[5BIB] CÔNG TY TNHH XYZ - Hợp đồng dịch vụ tính giờ - 15.05.2026.docx',
      );
    });

    it('falls back to F-024 pattern when raceName = null', () => {
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'CÔNG TY XYZ',
        docType: 'CONTRACT',
        contractType: 'TIMING',
        signDate: fixedSign,
        format: 'docx',
        contractNumber: '10.05/2026/HDDV/X',
        raceName: null,
      });
      expect(out).toBe(
        '[5BIB] CÔNG TY XYZ - Hợp đồng dịch vụ tính giờ - 15.05.2026.docx',
      );
    });

    it('falls back to F-024 when contractNumber empty string', () => {
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'XYZ',
        docType: 'QUOTATION', // typical case: Quotation chưa có contractNumber
        contractType: 'TIMING',
        format: 'xlsx',
        contractNumber: '',
        raceName: 'Test Race',
      });
      // Quotation flow — F-024 pattern (no date because no signDate/fallback)
      expect(out).toBe('[5BIB] XYZ - Báo giá dịch vụ tính giờ.xlsx');
    });

    it('omits F-044 HYBRID when both fields omitted (undefined)', () => {
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'XYZ',
        docType: 'CONTRACT',
        contractType: 'TIMING',
        signDate: fixedSign,
        format: 'docx',
        // contractNumber + raceName both undefined (existing callers)
      });
      expect(out).toBe(
        '[5BIB] XYZ - Hợp đồng dịch vụ tính giờ - 15.05.2026.docx',
      );
    });
  });

  describe('TC-44-09: Sanitize edge cases', () => {
    it('replaces / in contractNumber with . (filesystem safe)', () => {
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'X',
        docType: 'CONTRACT',
        contractType: 'TIMING',
        format: 'docx',
        contractNumber: 'a/b/c/d/e',
        raceName: 'Race',
      });
      expect(out).toContain('a.b.c.d.e - Race');
    });

    it('replaces / and \\ in raceName with -', () => {
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'X',
        docType: 'CONTRACT',
        contractType: 'TIMING',
        format: 'docx',
        contractNumber: 'CN-1',
        raceName: 'Race/Sub\\Path',
      });
      expect(out).toContain('CN-1 - Race-Sub-Path');
    });

    it('strips control chars + Windows-reserved chars from contractNumber', () => {
      const ctrlChar = '\x00\x07';
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'X',
        docType: 'CONTRACT',
        contractType: 'TIMING',
        format: 'docx',
        contractNumber: `10.05${ctrlChar}<>:|?*"-X`,
        raceName: 'Race',
      });
      expect(out).not.toMatch(/[<>:|?*"]/);
      expect(out).toContain('10.05-X');
    });

    it('truncates contractNumber > 80 chars with ellipsis', () => {
      const longCn = 'A'.repeat(120);
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'X',
        docType: 'CONTRACT',
        contractType: 'TIMING',
        format: 'docx',
        contractNumber: longCn,
        raceName: 'Race',
      });
      // Truncated portion + '...' marker
      const cn = out.split(' - ')[0];
      expect(cn.length).toBeLessThanOrEqual(83); // 80 + '...'
      expect(cn).toMatch(/A+\.\.\./);
    });

    it('truncates raceName > 80 chars with ellipsis', () => {
      const longRace = 'B'.repeat(120);
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'X',
        docType: 'CONTRACT',
        contractType: 'TIMING',
        format: 'docx',
        contractNumber: '10.05/2026/HDDV/X',
        raceName: longRace,
      });
      const parts = out.split(' - ');
      expect(parts[1].length).toBeLessThanOrEqual(83); // 80 + '...'
      expect(parts[1]).toMatch(/B+\.\.\./);
    });

    it('preserves VN diacritics in contractNumber + raceName', () => {
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'X',
        docType: 'ACCEPTANCE_REPORT',
        contractType: 'RACEKIT',
        format: 'docx',
        contractNumber: '10.05/2026/HĐDV/CTTFA-5BIB',
        raceName: 'CÔNG TY CỔ PHẦN — Cát Tiên Trail',
      });
      expect(out).toContain('HĐDV');
      expect(out).toContain('Cát Tiên Trail');
      expect(out).toContain('Biên bản nghiệm thu');
    });

    it('uses fallback "(chưa cấp số)" when contractNumber is whitespace', () => {
      // raceName provided BUT contractNumber whitespace-only
      // → sanitize returns fallback label, HYBRID still activates
      const out = buildDocumentFilename({
        providerId: '5BIB',
        partnerName: 'X',
        docType: 'CONTRACT',
        contractType: 'TIMING',
        format: 'docx',
        contractNumber: '   ',
        raceName: 'Race',
      });
      // Whitespace-only triggers F-024 fallback (falsy after .trim() in HYBRID branch)
      // since `if (input.contractNumber && input.raceName)` evaluates truthy
      // for '   ' string — sanitize returns fallback label.
      // Verify behavior matches sanitize fallback for whitespace input.
      // (Implementation: '   ' is truthy → enters HYBRID → sanitize returns
      // FALLBACK_CONTRACT_NUMBER `(chưa cấp số)`.)
      expect(out).toContain('(chưa cấp số)');
    });
  });
});
