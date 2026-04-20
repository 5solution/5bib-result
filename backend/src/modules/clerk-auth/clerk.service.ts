import { Injectable, Logger } from '@nestjs/common';
import { createClerkClient, ClerkClient } from '@clerk/backend';
import { env } from 'src/config';

/**
 * Wrapper gọi Clerk Backend API (khi cần cập nhật user metadata, fetch user info…).
 * Instance tạo lazy — nếu chưa config thì throw khi dùng.
 */
@Injectable()
export class ClerkService {
  private readonly logger = new Logger(ClerkService.name);
  private _client: ClerkClient | null = null;

  private get client(): ClerkClient {
    if (!this._client) {
      if (!env.clerk.secretKey) {
        throw new Error('CLERK_SECRET_KEY is not configured');
      }
      this._client = createClerkClient({ secretKey: env.clerk.secretKey });
    }
    return this._client;
  }

  async getUser(clerkId: string) {
    return this.client.users.getUser(clerkId);
  }

  /**
   * Cập nhật publicMetadata của user — giới hạn 1.2KB.
   * Chỉ set fields được pass, giữ nguyên các field cũ khác.
   */
  async mergePublicMetadata(
    clerkId: string,
    patch: Record<string, unknown>,
  ) {
    const user = await this.getUser(clerkId);
    const current =
      (user.publicMetadata as Record<string, unknown> | undefined) || {};
    return this.client.users.updateUser(clerkId, {
      publicMetadata: { ...current, ...patch },
    });
  }
}
