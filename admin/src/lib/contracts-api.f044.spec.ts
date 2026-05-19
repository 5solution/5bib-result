/**
 * F-044 — streamDownloadBlob refactor tests (Adjustment #2 / BR-44-11).
 *
 * Validates:
 *   - TC-44-16: Returns `{blob, filename}` shape (NOT raw Blob)
 *   - Content-Disposition RFC 5987 filename* parsing (Unicode VN diacritics)
 *   - Plain `filename="..."` fallback
 *   - Missing header → filename = null
 *   - Malformed percent-encoding → graceful fallback
 *
 * Note: Tests don't hit real network — mock `global.fetch` per test.
 */

import { streamDownloadBlob, ContractsApiError } from './contracts-api';

describe('F-044 — streamDownloadBlob Content-Disposition filename parsing', () => {
  // Preserve original fetch to restore between tests
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(headers: Record<string, string>, blob: Blob, ok = true) {
    const headersInstance = new Headers(headers);
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      headers: headersInstance,
      blob: async () => blob,
      json: async () => ({}),
    }) as unknown as typeof fetch;
  }

  describe('TC-44-16: Happy path returns {blob, filename}', () => {
    it('extracts filename from RFC 5987 filename* header (VN diacritics preserved)', async () => {
      const expected =
        '10.05.2026.HDDV.CTTFA-5BIB-6 - Cát Tiên Trail Family Adventure - Hợp đồng.docx';
      const encoded = encodeURIComponent(expected);
      mockFetch(
        {
          'Content-Disposition': `attachment; filename="fallback.docx"; filename*=UTF-8''${encoded}`,
        },
        new Blob(['fake-docx-bytes'], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      );

      const result = await streamDownloadBlob('contract-id', 's3-key.docx');

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.filename).toBe(expected);
    });

    it('extracts filename from plain `filename="..."` when no RFC 5987', async () => {
      mockFetch(
        {
          'Content-Disposition':
            'attachment; filename="Plain ASCII filename.docx"',
        },
        new Blob(['x']),
      );

      const result = await streamDownloadBlob('id', 'key');
      expect(result.filename).toBe('Plain ASCII filename.docx');
    });

    it('prefers RFC 5987 over plain filename when BOTH present', async () => {
      const expected = 'Tiếng Việt diacritics ☆.docx';
      const encoded = encodeURIComponent(expected);
      mockFetch(
        {
          'Content-Disposition': `attachment; filename="ASCII-only.docx"; filename*=UTF-8''${encoded}`,
        },
        new Blob(['x']),
      );

      const result = await streamDownloadBlob('id', 'key');
      expect(result.filename).toBe(expected);
    });

    it('returns filename = null when Content-Disposition header missing', async () => {
      mockFetch({}, new Blob(['x']));

      const result = await streamDownloadBlob('id', 'key');
      expect(result.filename).toBeNull();
      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('handles unquoted plain filename (filename=foo.docx)', async () => {
      mockFetch(
        {
          'Content-Disposition': 'attachment; filename=plain-unquoted.docx',
        },
        new Blob(['x']),
      );

      const result = await streamDownloadBlob('id', 'key');
      expect(result.filename).toBe('plain-unquoted.docx');
    });

    it('falls back to plain filename when RFC 5987 has malformed percent-encoding', async () => {
      mockFetch(
        {
          // %ZZ is invalid percent-encoding → decodeURIComponent throws
          'Content-Disposition':
            'attachment; filename="fallback.docx"; filename*=UTF-8\'\'invalid%ZZ',
        },
        new Blob(['x']),
      );

      const result = await streamDownloadBlob('id', 'key');
      expect(result.filename).toBe('fallback.docx');
    });
  });

  describe('Error handling', () => {
    it('throws ContractsApiError on non-ok response', async () => {
      mockFetch(
        { 'Content-Disposition': 'attachment; filename="x.docx"' },
        new Blob(['x']),
        false,
      );

      await expect(streamDownloadBlob('id', 'key')).rejects.toBeInstanceOf(
        ContractsApiError,
      );
    });
  });
});
