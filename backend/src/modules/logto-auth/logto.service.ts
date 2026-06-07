import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { createHash } from 'crypto';
import type Redis from 'ioredis';
import { env } from 'src/config';

/**
 * Logto Management API wrapper — used when backend needs to update user
 * custom data (e.g. avatar upload → save custom S3 URL to user.customData)
 * OR lookup users by ID/email for admin assignment workflows (F-069 Merchant Portal).
 *
 * Uses M2M (machine-to-machine) credentials. In Logto Dashboard:
 *   1. Applications → Create → Machine-to-Machine
 *   2. Give it the default `Logto Management API` role
 *   3. Paste App ID + App Secret into env LOGTO_M2M_APP_ID / LOGTO_M2M_APP_SECRET
 *
 * Access tokens are cached in-memory until expiry. If env credentials are
 * missing, every method throws — callers should check `isConfigured()` getter
 * or call `lookupByIdWithCache` / `lookupByEmail` which return `null` gracefully
 * when M2M unconfigured (F-069 graceful degrade BR-MP-36).
 *
 * F-069 M1 (2026-06-04) — Added `lookupByEmail` + `lookupByIdWithCache` với
 * Redis cache TTL 300s cho admin Logto user lookup workflow. Cache key uses
 * SHA-256 hash của email (avoid raw PII trong Redis keys per BR-MP-36).
 */

/**
 * F-069 — Normalized Logto user info returned by lookup methods.
 * Subset of Logto Management API user object — chỉ field admin lookup cần.
 */
export interface LogtoUserInfo {
  userId: string;
  email: string;
  name: string | null;
  username: string | null;
}

/** F-069 — Redis cache TTL cho Logto lookup (BR-MP-36). */
const LOGTO_LOOKUP_CACHE_TTL_SECONDS = 300;

@Injectable()
export class LogtoService {
  private readonly logger = new Logger(LogtoService.name);
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  private get isConfigured(): boolean {
    return !!(env.logto.m2mAppId && env.logto.m2mAppSecret);
  }

  private async fetchM2MToken(): Promise<string> {
    if (!this.isConfigured) {
      throw new Error(
        'Logto Management API not configured (missing LOGTO_M2M_APP_ID / LOGTO_M2M_APP_SECRET)',
      );
    }

    // Reuse cached token if still valid for another 60s
    if (
      this.cachedToken &&
      this.cachedToken.expiresAt - Date.now() > 60_000
    ) {
      return this.cachedToken.token;
    }

    const basic = Buffer.from(
      `${env.logto.m2mAppId}:${env.logto.m2mAppSecret}`,
    ).toString('base64');

    const res = await fetch(`${env.logto.endpoint}/oidc/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        // Resource INDICATOR (audience) — self-hosted OSS = default.logto.app/api,
        // NOT the custom endpoint. HTTP base for actual calls stays ${endpoint}/api.
        resource: env.logto.managementResource,
        scope: 'all',
      }).toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to get M2M token: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  private async managementApi<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = await this.fetchM2MToken();
    const res = await fetch(`${env.logto.endpoint}/api${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Logto API ${path} failed: ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async getUser(userId: string) {
    return this.managementApi<Record<string, unknown>>(
      `/users/${encodeURIComponent(userId)}`,
    );
  }

  /** Merge patch into user.customData — used for avatar URL etc. */
  async mergeCustomData(userId: string, patch: Record<string, unknown>) {
    const user = (await this.getUser(userId)) as {
      customData?: Record<string, unknown>;
    };
    const next = { ...(user.customData || {}), ...patch };
    return this.managementApi<Record<string, unknown>>(
      `/users/${encodeURIComponent(userId)}/custom-data`,
      {
        method: 'PATCH',
        body: JSON.stringify({ customData: next }),
      },
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // F-069 M1 — Admin lookup methods cho Merchant Portal access config
  // ─────────────────────────────────────────────────────────────────────

  /**
   * F-069 — Normalize raw Logto Management API user payload → LogtoUserInfo.
   *
   * Logto Management API `GET /users/{id}` trả về object lớn với nhiều field
   * (avatar, identities, customData, applicationId, ...) — F-069 admin lookup
   * chỉ cần 4 field: userId, email, name, username. Strip rest để response
   * gọn + tránh leak internal Logto fields qua admin endpoint downstream.
   */
  private normalizeLogtoUser(raw: Record<string, unknown>): LogtoUserInfo {
    return {
      userId: String(raw.id ?? ''),
      email: typeof raw.primaryEmail === 'string' ? raw.primaryEmail : '',
      name: typeof raw.name === 'string' ? raw.name : null,
      username: typeof raw.username === 'string' ? raw.username : null,
    };
  }

  /**
   * F-069 BR-MP-36 — Lookup user by Logto userId với Redis cache 300s.
   *
   * Reuses `getUser(userId)` existing method nhưng wrap với:
   *   1. Redis cache `logto-lookup:byid:<userId>` TTL 300s
   *   2. Normalize payload thành `LogtoUserInfo` (strip internal fields)
   *   3. Graceful degrade: trả về `null` khi M2M unconfigured / 404 / network error
   *
   * Returns:
   *   - `LogtoUserInfo` nếu user tồn tại
   *   - `null` nếu user not found, M2M unconfigured, hoặc Logto API unreachable
   *
   * Caller (admin endpoint) phải distinguish null = "not found / unreachable"
   * và trả về proper HTTP status (404 hoặc 503) tương ứng. Service không throw
   * vì BR-MP-36 mandate graceful degrade — admin có thể nhập manual.
   */
  async lookupByIdWithCache(userId: string): Promise<LogtoUserInfo | null> {
    if (!userId) return null;
    const cacheKey = `logto-lookup:byid:${userId}`;

    // 1. Cache hit → return immediately
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        // Sentinel "NULL" → confirmed not-found, KHÔNG hit API again
        if (cached === 'NULL') return null;
        return JSON.parse(cached) as LogtoUserInfo;
      }
    } catch (err) {
      this.logger.warn(
        `Redis cache read failed for ${cacheKey}: ${(err as Error).message}`,
      );
      // Continue to API fallback
    }

    // 2. Cache miss → hit Logto Management API
    if (!this.isConfigured) {
      this.logger.warn(
        `lookupByIdWithCache(${userId}) called but M2M unconfigured — returning null`,
      );
      return null;
    }

    try {
      const raw = await this.getUser(userId);
      const normalized = this.normalizeLogtoUser(raw);

      // 3. Cache positive result
      try {
        await this.redis.set(
          cacheKey,
          JSON.stringify(normalized),
          'EX',
          LOGTO_LOOKUP_CACHE_TTL_SECONDS,
        );
      } catch (err) {
        this.logger.warn(
          `Redis cache write failed for ${cacheKey}: ${(err as Error).message}`,
        );
      }

      return normalized;
    } catch (err) {
      const msg = (err as Error).message;
      // 4. Logto returned 404 → cache negative sentinel (avoid repeated 404 spam)
      if (/\b404\b/.test(msg)) {
        try {
          await this.redis.set(
            cacheKey,
            'NULL',
            'EX',
            LOGTO_LOOKUP_CACHE_TTL_SECONDS,
          );
        } catch {
          // Ignore — degraded silently
        }
        return null;
      }
      // 5. 5xx / network error → log + null (BR-MP-36 graceful degrade, NO throw)
      this.logger.warn(
        `lookupByIdWithCache(${userId}) failed: ${msg} — returning null (admin can enter manually)`,
      );
      return null;
    }
  }

  /**
   * F-069 BR-MP-36 — Lookup user by email với Redis cache 300s.
   *
   * Cache key uses SHA-256 hash của lowercased email (BR-MP-36 — avoid raw PII
   * trong Redis keys). Same email → same hash → cache hit.
   *
   * Logto Management API endpoint: `GET /users?search=<email>` returns array
   * of matching users. F-069 filter by exact `primaryEmail` match (case-insensitive)
   * vì `search` Logto là fuzzy/partial.
   *
   * Returns:
   *   - `LogtoUserInfo` nếu duy nhất 1 user match email
   *   - `null` nếu 0 match, multiple match (ambiguous), unconfigured, hoặc API error
   *
   * Note: Logto allows email uniqueness as a tenant policy — multiple match
   * highly unlikely trong 5BIB tenant context, nhưng F-069 vẫn handle defensive
   * (return null thay vì pick arbitrary user).
   */
  async lookupByEmail(email: string): Promise<LogtoUserInfo | null> {
    if (!email || !email.includes('@')) return null;
    const normalizedEmail = email.trim().toLowerCase();
    const hash = createHash('sha256').update(normalizedEmail).digest('hex');
    const cacheKey = `logto-lookup:byemail:${hash}`;

    // 1. Cache hit
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        if (cached === 'NULL') return null;
        return JSON.parse(cached) as LogtoUserInfo;
      }
    } catch (err) {
      this.logger.warn(
        `Redis cache read failed for ${cacheKey}: ${(err as Error).message}`,
      );
    }

    // 2. M2M gate
    if (!this.isConfigured) {
      this.logger.warn(
        `lookupByEmail called but M2M unconfigured — returning null`,
      );
      return null;
    }

    // 3. Hit Logto Management API
    try {
      const raw = await this.managementApi<Record<string, unknown>[]>(
        `/users?search=${encodeURIComponent(normalizedEmail)}`,
      );

      // 4. Filter exact match (search là fuzzy — phải verify primaryEmail equality)
      const matches = (Array.isArray(raw) ? raw : []).filter((u) => {
        const email = u?.primaryEmail;
        return (
          typeof email === 'string' && email.toLowerCase() === normalizedEmail
        );
      });

      // 5. Ambiguous (>1 match) hoặc no match → null
      if (matches.length !== 1) {
        try {
          await this.redis.set(
            cacheKey,
            'NULL',
            'EX',
            LOGTO_LOOKUP_CACHE_TTL_SECONDS,
          );
        } catch {
          // Ignore
        }
        if (matches.length > 1) {
          this.logger.warn(
            `lookupByEmail(<hash:${hash.slice(0, 8)}>) ambiguous: ${matches.length} matches — returning null`,
          );
        }
        return null;
      }

      const normalized = this.normalizeLogtoUser(matches[0]);

      // 6. Cache positive
      try {
        await this.redis.set(
          cacheKey,
          JSON.stringify(normalized),
          'EX',
          LOGTO_LOOKUP_CACHE_TTL_SECONDS,
        );
      } catch (err) {
        this.logger.warn(
          `Redis cache write failed for ${cacheKey}: ${(err as Error).message}`,
        );
      }

      return normalized;
    } catch (err) {
      this.logger.warn(
        `lookupByEmail(<hash:${hash.slice(0, 8)}>) failed: ${(err as Error).message} — returning null`,
      );
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // F-069 M3b — Auto-provision merchant user (create + assign role)
  //
  // KHÁC lookup methods: 3 method dưới THROW khi fail (không graceful null) vì
  // tạo user thất bại PHẢI surface lên admin để hiển thị lỗi rõ — không được
  // âm thầm tạo record access cho user không tồn tại. Caller (access service)
  // catch + map sang HTTP error VN.
  //
  // PREREQUISITE (G1): M2M app phải có Management API scope `create users` +
  // `read roles` + `manage user roles`. Thiếu → Logto trả 403 → throw lên.
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Tạo Logto user mới (passwordless — KHÔNG set password; user nhận magic-link
   * / email-code sign-in). Returns userId mới.
   * @throws Error nếu M2M unconfigured hoặc Logto API fail (vd 403 thiếu scope,
   *   422 email đã tồn tại).
   */
  async createUser(email: string, name: string): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('LOGTO_M2M_UNCONFIGURED');
    }
    const created = await this.managementApi<{ id?: string }>('/users', {
      method: 'POST',
      body: JSON.stringify({
        primaryEmail: email.trim().toLowerCase(),
        name: name.trim(),
      }),
    });
    if (!created?.id) {
      throw new Error('Logto createUser returned no id');
    }
    return created.id;
  }

  /**
   * Resolve role NAMES → role IDs qua `GET /api/roles`. Bỏ qua name không match.
   * @throws Error nếu Logto API fail.
   */
  async resolveRoleIdsByNames(names: string[]): Promise<string[]> {
    if (!this.isConfigured) {
      throw new Error('LOGTO_M2M_UNCONFIGURED');
    }
    const wanted = new Set(names);
    const roles = await this.managementApi<
      Array<{ id?: string; name?: string }>
    >('/roles');
    return (Array.isArray(roles) ? roles : [])
      .filter((r) => typeof r?.name === 'string' && wanted.has(r.name))
      .map((r) => String(r.id))
      .filter(Boolean);
  }

  /**
   * Gán role IDs cho user qua `POST /api/users/{id}/roles`. No-op nếu roleIds rỗng.
   * @throws Error nếu Logto API fail.
   */
  async assignUserRoles(userId: string, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;
    if (!this.isConfigured) {
      throw new Error('LOGTO_M2M_UNCONFIGURED');
    }
    await this.managementApi<unknown>(
      `/users/${encodeURIComponent(userId)}/roles`,
      {
        method: 'POST',
        body: JSON.stringify({ roleIds }),
      },
    );
  }
}
