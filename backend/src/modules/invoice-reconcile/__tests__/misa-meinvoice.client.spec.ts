/**
 * F-076 TC-17 → TC-23 — MISA client tests.
 *
 * Verify:
 *  - Token cache via Redis
 *  - Defensive parse of double-encoded JSON (TC-21 critical — Manager verified PROD shape)
 *  - Paging loop until TotalCount reached
 *  - 429/5xx retry exhaust → MisaUnavailableError
 *  - 401 + TokenExpiredCode → refresh + retry
 */
import axios from 'axios';
import {
  MisaAuthFailError,
  MisaMeinvoiceClient,
  MisaUnavailableError,
} from '../services/misa-meinvoice.client';
import { env } from 'src/config';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MisaMeinvoiceClient', () => {
  let client: MisaMeinvoiceClient;
  let mockPost: jest.Mock;
  let mockRedisGet: jest.Mock;
  let mockRedisSet: jest.Mock;
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPost = jest.fn();
    mockedAxios.create.mockReturnValue({ post: mockPost } as any);
    mockRedisGet = jest.fn().mockResolvedValue(null);
    mockRedisSet = jest.fn().mockResolvedValue('OK');
    mockRedis = {
      get: mockRedisGet,
      set: mockRedisSet,
      ttl: jest.fn().mockResolvedValue(-1),
    };
    env.invoiceReconcile.misa.appId = 'app-id';
    env.invoiceReconcile.misa.taxCode = '0110398986';
    env.invoiceReconcile.misa.username = 'ketoan@5bib.com';
    env.invoiceReconcile.misa.password = 'pw';
    client = new MisaMeinvoiceClient(mockRedis);
  });

  describe('isConfigured', () => {
    it('returns true when all env set', () => {
      expect(client.isConfigured()).toBe(true);
    });

    it('returns false when username missing', () => {
      env.invoiceReconcile.misa.username = '';
      expect(client.isConfigured()).toBe(false);
    });
  });

  describe('getToken (TC-17 cache hit)', () => {
    // TC-17 — token cache hit returns cached without POST
    it('TC-17: returns cached token without calling /auth/token', async () => {
      mockRedisGet.mockResolvedValueOnce('cached-jwt-token');
      const token = await client.getToken();
      expect(token).toBe('cached-jwt-token');
      expect(mockPost).not.toHaveBeenCalled();
    });

    // TC-18 — forced refresh
    it('TC-18: forced refresh calls /auth/token and caches new token', async () => {
      mockPost.mockResolvedValue({
        status: 200,
        data: { success: true, data: 'new-jwt' },
      });
      const token = await client.getToken(true);
      expect(token).toBe('new-jwt');
      expect(mockPost).toHaveBeenCalledWith(
        '/auth/token',
        expect.objectContaining({
          appid: 'app-id',
          taxcode: '0110398986',
          username: 'ketoan@5bib.com',
          password: 'pw',
        }),
      );
      expect(mockRedisSet).toHaveBeenCalled();
    });

    it('throws MisaAuthFailError when credentials missing', async () => {
      env.invoiceReconcile.misa.username = '';
      await expect(client.getToken(true)).rejects.toThrow(MisaAuthFailError);
    });

    it('throws MisaAuthFailError when MISA returns success=false', async () => {
      mockPost.mockResolvedValue({
        status: 200,
        data: { success: false, errorCode: 'InvalidAppID', data: null },
      });
      await expect(client.getToken(true)).rejects.toThrow(MisaAuthFailError);
    });
  });

  describe('listInvoicesByDateRange (TC-20 + TC-21 + TC-23)', () => {
    beforeEach(() => {
      // Pre-cache token to skip /auth/token
      mockRedisGet.mockResolvedValue('cached-token');
    });

    // TC-21 — Defensive parse double-encoded JSON (CRITICAL — verified PROD)
    it('TC-21: defensive parse handles double-encoded JSON nested', async () => {
      // Real PROD shape: outer.data is JSON string, PageData inside is also JSON string
      const innerPageData = JSON.stringify([
        {
          RefID: '200029420-20260608172739',
          InvNo: '00000023',
          InvSeries: '1C26MBB',
          InvDate: '2026-06-08T00:00:00+07:00',
          TotalAmount: 12000,
          BuyerFullName: 'Hiền Nghiêm',
          ReferenceType: null,
        },
      ]);
      const outerData = JSON.stringify({
        PageData: innerPageData,
        TotalCount: 1,
        Summary: null,
      });
      mockPost.mockResolvedValue({
        status: 200,
        data: { success: true, errorCode: null, data: outerData },
      });
      const invoices = await client.listInvoicesByDateRange(
        '2026-06-08',
        '2026-06-09',
      );
      expect(invoices).toHaveLength(1);
      expect(invoices[0].RefID).toBe('200029420-20260608172739');
      expect(invoices[0].InvNo).toBe('00000023');
    });

    // TC-20 — Paging loop
    it('TC-20: loops paging until TotalCount reached', async () => {
      const page1 = makePage(100, 0, 250);
      const page2 = makePage(100, 100, 250);
      const page3 = makePage(50, 200, 250);
      mockPost
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true, data: page1 },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true, data: page2 },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true, data: page3 },
        });
      const invoices = await client.listInvoicesByDateRange(
        '2026-06-08',
        '2026-06-09',
      );
      expect(invoices).toHaveLength(250);
      expect(mockPost).toHaveBeenCalledTimes(3);
    });

    // TC-23 — All retries exhaust → MisaUnavailableError
    // Backoff 1s+2s+4s = 7s — extend jest timeout
    it(
      'TC-23: all retries exhaust throws MisaUnavailableError',
      async () => {
        mockPost.mockRejectedValue(new Error('ECONNREFUSED'));
        await expect(
          client.listInvoicesByDateRange('2026-06-08', '2026-06-09'),
        ).rejects.toThrow(MisaUnavailableError);
        // 1 initial + 3 retries = 4 calls
        expect(mockPost).toHaveBeenCalledTimes(4);
      },
      15_000,
    );

    // TC-19 — 401 TokenExpiredCode triggers refresh
    // Use cached token so first paging call hits 401, refresh, retry success
    it(
      'TC-19: 401 + TokenExpiredCode refreshes token and retries',
      async () => {
        // Pre-cache token (mockRedisGet returns cached on first read)
        mockRedisGet.mockResolvedValue('initial-token');
        mockPost
          // Paging #1 — 401 expired (token from cache)
          .mockResolvedValueOnce({
            status: 401,
            data: { errorCode: 'TokenExpiredCode' },
          })
          // Refresh token via POST /auth/token
          .mockResolvedValueOnce({
            status: 200,
            data: { success: true, data: 'new-token' },
          })
          // Paging #2 — success with new token
          .mockResolvedValueOnce({
            status: 200,
            data: { success: true, data: makePage(1, 0, 1) },
          });
        const invoices = await client.listInvoicesByDateRange(
          '2026-06-08',
          '2026-06-09',
        );
        expect(invoices).toHaveLength(1);
      },
      10_000,
    );

    it('401 non-TokenExpired throws MisaAuthFailError', async () => {
      mockPost.mockResolvedValue({
        status: 401,
        data: { errorCode: 'InvalidTokenCode' },
      });
      await expect(
        client.listInvoicesByDateRange('2026-06-08', '2026-06-09'),
      ).rejects.toThrow(MisaAuthFailError);
    });
  });

  describe('F-086 countInvoicesInRange (TC-86-06)', () => {
    beforeEach(() => {
      mockRedisGet.mockResolvedValue('cached-token');
    });

    it('TC-86-06: trả TotalCount từ page đầu, KHÔNG kéo full list (take=1)', async () => {
      // PageData chỉ 1 item nhưng TotalCount = 147 → đếm dựa TotalCount.
      mockPost.mockResolvedValue({
        status: 200,
        data: { success: true, data: makePage(1, 0, 147) },
      });
      const n = await client.countInvoicesInRange('2026-06-08', '2026-06-16');
      expect(n).toBe(147);
      // 1 HTTP call duy nhất (không loop paging vì chỉ đọc page đầu)
      expect(mockPost).toHaveBeenCalledTimes(1);
      // take=1 trong body
      const body = mockPost.mock.calls[0][1];
      expect(body.Take).toBe(1);
      expect(body.FromDate).toBe('2026-06-08');
      expect(body.ToDate).toBe('2026-06-16');
    });

    it('TC-86-06b: range rỗng → TotalCount 0', async () => {
      mockPost.mockResolvedValue({
        status: 200,
        data: { success: true, data: makePage(0, 0, 0) },
      });
      const n = await client.countInvoicesInRange('2026-06-08', '2026-06-16');
      expect(n).toBe(0);
    });
  });
});

// Helper: build PROD-shape MISA paging response data (double-encoded JSON)
function makePage(
  count: number,
  startIndex: number,
  totalCount: number,
): string {
  const arr = Array.from({ length: count }, (_, i) => ({
    RefID: `2000${startIndex + i}-20260608172739`,
    InvNo: String(startIndex + i).padStart(8, '0'),
    InvSeries: '1C26MBB',
    InvDate: '2026-06-08T00:00:00+07:00',
    TotalAmount: 12000,
    BuyerFullName: 'Test',
    ReferenceType: null,
  }));
  return JSON.stringify({
    PageData: JSON.stringify(arr),
    TotalCount: totalCount,
    Summary: null,
  });
}
