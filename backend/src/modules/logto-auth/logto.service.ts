import { Injectable, Logger } from '@nestjs/common';
import { env } from 'src/config';

/**
 * Logto Management API wrapper — used when backend needs to update user
 * custom data (e.g. avatar upload → save custom S3 URL to user.customData).
 *
 * Uses M2M (machine-to-machine) credentials. In Logto Dashboard:
 *   1. Applications → Create → Machine-to-Machine
 *   2. Give it the default `Logto Management API` role
 *   3. Paste App ID + App Secret into env LOGTO_M2M_APP_ID / LOGTO_M2M_APP_SECRET
 *
 * Access tokens are cached in-memory until expiry. If env credentials are
 * missing, every method throws — callers should check `env.logto.m2mAppId`
 * before relying on this service.
 */
@Injectable()
export class LogtoService {
  private readonly logger = new Logger(LogtoService.name);
  private cachedToken: { token: string; expiresAt: number } | null = null;

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
        resource: `${env.logto.endpoint}/api`, // Management API resource
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
}
