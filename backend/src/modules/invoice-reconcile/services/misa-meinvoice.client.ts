/**
 * F-076 — MISA Meinvoice REST API client (PRD section 3.5 + BR-14, BR-15, BR-16, BR-21).
 *
 * Endpoints (Tích hợp sâu AIO):
 *   - POST /auth/token            → get JWT, TTL 14 ngày (BR-14)
 *   - POST /invoice/paging        → list invoices by date range (BR-15)
 *   - POST /invoice/status        → query status per RefID batch (Phase 1.1, không dùng v1)
 *
 * Token cache Redis `misa:token` TTL = MISA expiry - 5min. Refresh khi 401 +
 * TokenExpiredCode hoặc TTL gần hết.
 *
 * Defensive parse — MISA quirk: `response.data` của paging là JSON string
 * nested (Manager session verified PROD 2026-06-08). Parse 2-lần: outer JSON
 * trả `{data: "[...]"}`, parse `data` thành `{PageData, TotalCount, Summary}`,
 * rồi parse `PageData` lần nữa nếu là string.
 *
 * MUST NOT log raw token / password / chat_id (security check).
 */
import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import axios, { AxiosError, AxiosInstance } from 'axios';
import Redis from 'ioredis';
import { env } from 'src/config';
import { MisaInvoiceLite } from './reconcile-classifier';

const TOKEN_CACHE_KEY = 'misa:token';
const TOKEN_TTL_DEFAULT_SECONDS = 13 * 24 * 3600; // 13 ngày (MISA cấp 14, refresh 1 ngày trước)
const REQUEST_TIMEOUT_MS = 10_000;

/** Throw khi MISA API down sau tất cả retry. */
export class MisaUnavailableError extends Error {
  constructor(public readonly lastError: string) {
    super(`MISA Meinvoice unreachable: ${lastError}`);
    this.name = 'MisaUnavailableError';
  }
}

/** Throw khi 401 không phải TokenExpiredCode (credentials sai). */
export class MisaAuthFailError extends Error {
  constructor(public readonly errorBody: string) {
    super(`MISA auth fail: ${errorBody}`);
    this.name = 'MisaAuthFailError';
  }
}

/** Response shape PagingData sau khi parse. */
interface MisaPagingData {
  PageData: MisaInvoiceLite[] | string;
  TotalCount: number;
  Summary: unknown;
}

/** Outer envelope of MISA API responses. */
interface MisaEnvelope<T> {
  success: boolean;
  errorCode: string | null;
  descriptionErrorCode: string | null;
  errors: unknown[];
  data: T | string | null;
  customData: unknown;
}

@Injectable()
export class MisaMeinvoiceClient {
  private readonly logger = new Logger(MisaMeinvoiceClient.name);
  private readonly http: AxiosInstance;
  private lastStatus: 'OK' | 'DEGRADED' | 'UNAVAILABLE' | null = null;
  private lastTokenSetAt: Date | null = null;

  constructor(@Optional() @InjectRedis() private readonly redis?: Redis) {
    this.http = axios.create({
      baseURL: env.invoiceReconcile.misa.baseUrl,
      timeout: REQUEST_TIMEOUT_MS,
      // KHÔNG follow redirect (SSRF defense TD-CRIT-04 — defense-in-depth)
      maxRedirects: 0,
      validateStatus: () => true, // handle errors ourselves
    });
  }

  /** Public: get MISA token expiry from cache (for health endpoint). */
  async getTokenExpiry(): Promise<Date | null> {
    if (!this.redis) return null;
    try {
      const ttl = await this.redis.ttl(TOKEN_CACHE_KEY);
      if (ttl <= 0) return null;
      return new Date(Date.now() + ttl * 1000);
    } catch {
      return null;
    }
  }

  /** Public: last call status (for health endpoint). */
  getLastStatus(): 'OK' | 'DEGRADED' | 'UNAVAILABLE' | null {
    return this.lastStatus;
  }

  /** Public: indicate whether MISA env credentials are configured. */
  isConfigured(): boolean {
    const m = env.invoiceReconcile.misa;
    return Boolean(m.username && m.password && m.taxCode && m.appId);
  }

  /**
   * BR-14 — get or refresh token. Cached Redis, key `misa:token`.
   */
  async getToken(forceRefresh = false): Promise<string> {
    if (this.redis && !forceRefresh) {
      try {
        const cached = await this.redis.get(TOKEN_CACHE_KEY);
        if (cached) return cached;
      } catch (e) {
        this.logger.warn(
          `[misa] redis get token fail: ${(e as Error).message}`,
        );
      }
    }
    const token = await this.fetchToken();
    if (this.redis) {
      try {
        await this.redis.set(
          TOKEN_CACHE_KEY,
          token,
          'EX',
          TOKEN_TTL_DEFAULT_SECONDS,
        );
        this.lastTokenSetAt = new Date();
      } catch (e) {
        this.logger.warn(
          `[misa] redis set token fail: ${(e as Error).message}`,
        );
      }
    }
    return token;
  }

  /**
   * BR-14 — POST /auth/token. KHÔNG retry — credentials sai = fail fast.
   */
  private async fetchToken(): Promise<string> {
    const m = env.invoiceReconcile.misa;
    if (!this.isConfigured()) {
      throw new MisaAuthFailError('MISA env credentials chưa cấu hình');
    }
    const body = {
      appid: m.appId,
      taxcode: m.taxCode,
      username: m.username,
      password: m.password,
    };
    try {
      const res = await this.http.post<MisaEnvelope<string>>(
        '/auth/token',
        body,
      );
      // MISA quirk: response wraps either { success, data: "<jwt>" } or
      // { Success: ..., Data: ... } per doc — handle both.
      const env1 = res.data as unknown as Record<string, unknown>;
      const success =
        (env1.success as boolean | undefined) ??
        (env1.Success as boolean | undefined) ??
        false;
      const data =
        (env1.data as string | undefined) ?? (env1.Data as string | undefined);
      const errorCode =
        (env1.errorCode as string | undefined) ??
        (env1.ErrorCode as string | undefined);
      if (!success || !data) {
        throw new MisaAuthFailError(
          `errorCode=${errorCode ?? 'unknown'} status=${res.status}`,
        );
      }
      return data;
    } catch (e) {
      if (e instanceof MisaAuthFailError) throw e;
      const msg = e instanceof AxiosError ? e.message : (e as Error).message;
      throw new MisaUnavailableError(`/auth/token: ${msg}`);
    }
  }

  /**
   * BR-15 — POST /invoice/paging loop pagination.
   * Filter B2C qua classifier `isB2cRefId` ở caller (KHÔNG filter ở đây
   * vì orphan detection cần raw RefID).
   *
   * Retry policy (BR-16):
   *   - timeout / 5xx: retry 3× với 1s/2s/4s exp backoff
   *   - 401 + TokenExpiredCode: refresh token + retry 1×
   *   - 401 khác: throw MisaAuthFailError
   *   - 4xx khác (non-401): log + skip tick (throw transient error)
   */
  async listInvoicesByDateRange(
    fromDate: string,
    toDate: string,
  ): Promise<MisaInvoiceLite[]> {
    if (!this.isConfigured()) {
      throw new MisaAuthFailError('MISA env credentials chưa cấu hình');
    }
    const all: MisaInvoiceLite[] = [];
    let skip = 0;
    const take = 100;
    let totalCount = 0;
    let pageDegradedOnce = false;

    do {
      const page = await this.fetchPageWithRetry(
        fromDate,
        toDate,
        skip,
        take,
        (degraded) => {
          if (degraded) pageDegradedOnce = true;
        },
      );
      totalCount = page.totalCount;
      for (const inv of page.invoices) all.push(inv);
      skip += take;
      if (skip >= totalCount || page.invoices.length === 0) break;
      // Soft cap defense — large date ranges
      if (skip > 10_000) {
        this.logger.warn(
          `[misa] paging hit 10K soft cap, breaking (totalCount=${totalCount})`,
        );
        break;
      }
    } while (true);

    this.lastStatus = pageDegradedOnce ? 'DEGRADED' : 'OK';
    return all;
  }

  private async fetchPageWithRetry(
    fromDate: string,
    toDate: string,
    skip: number,
    take: number,
    onDegraded: (b: boolean) => void,
  ): Promise<{ invoices: MisaInvoiceLite[]; totalCount: number }> {
    const delays = [1000, 2000, 4000];
    let lastErr = '';
    let retriedTokenOnce = false;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const token = await this.getToken();
        const res = await this.http.post<MisaEnvelope<MisaPagingData | string>>(
          '/invoice/paging?InvoiceWithCode=true',
          {
            FromDate: fromDate,
            ToDate: toDate,
            Skip: skip,
            Take: take,
            ListInvTemplate: [],
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        // 401 handling
        if (res.status === 401) {
          const errCode = this.extractErrorCode(res.data);
          if (!retriedTokenOnce && errCode === 'TokenExpiredCode') {
            retriedTokenOnce = true;
            await this.getToken(true);
            continue; // retry without consuming attempt
          }
          throw new MisaAuthFailError(
            `401 errorCode=${errCode ?? 'unknown'}`,
          );
        }
        // 5xx → retry
        if (res.status >= 500) {
          lastErr = `5xx status=${res.status}`;
          onDegraded(true);
          if (attempt < delays.length) {
            await this.sleep(delays[attempt]);
            continue;
          }
          throw new MisaUnavailableError(lastErr);
        }
        // Other 4xx → skip
        if (res.status >= 400) {
          throw new HttpException(
            `MISA paging 4xx status=${res.status}`,
            res.status,
          );
        }
        // 200 — parse defensive
        const env1 = res.data as MisaEnvelope<MisaPagingData | string>;
        if (!env1.success) {
          throw new HttpException(
            `MISA paging errorCode=${env1.errorCode ?? 'unknown'}`,
            500,
          );
        }
        const parsed = this.defensiveParsePaging(env1.data);
        return parsed;
      } catch (e) {
        if (e instanceof MisaAuthFailError) throw e;
        if (e instanceof HttpException) throw e;
        // Network / timeout / unknown
        lastErr = e instanceof Error ? e.message : String(e);
        onDegraded(true);
        if (attempt < delays.length) {
          await this.sleep(delays[attempt]);
          continue;
        }
        throw new MisaUnavailableError(lastErr);
      }
    }
    throw new MisaUnavailableError(lastErr);
  }

  /**
   * BR-21 + TC-21 — defensive parse cho double-encoded JSON.
   *
   * Real PROD response shape (verified Manager session):
   *   `outer.data = "{\"PageData\":\"[{\\\"RefID\\\":...}]\",...}"`
   *
   * Tức outer.data là STRING, parse ra `{PageData, TotalCount}` rồi
   * PageData cũng có thể là STRING → parse lần 2.
   */
  private defensiveParsePaging(
    data: MisaPagingData | string | null,
  ): { invoices: MisaInvoiceLite[]; totalCount: number } {
    if (data == null) return { invoices: [], totalCount: 0 };
    let outer: MisaPagingData;
    if (typeof data === 'string') {
      try {
        outer = JSON.parse(data) as MisaPagingData;
      } catch (e) {
        throw new MisaUnavailableError(
          `defensive parse outer fail: ${(e as Error).message}`,
        );
      }
    } else {
      outer = data;
    }
    let pageData: MisaInvoiceLite[];
    if (typeof outer.PageData === 'string') {
      try {
        pageData = JSON.parse(outer.PageData) as MisaInvoiceLite[];
      } catch (e) {
        throw new MisaUnavailableError(
          `defensive parse PageData fail: ${(e as Error).message}`,
        );
      }
    } else if (Array.isArray(outer.PageData)) {
      pageData = outer.PageData;
    } else {
      pageData = [];
    }
    return {
      invoices: pageData ?? [],
      totalCount: outer.TotalCount ?? 0,
    };
  }

  private extractErrorCode(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    return (d.errorCode as string | undefined) ?? null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }
}
