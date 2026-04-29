import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ApiKeyDocument = HydratedDocument<ApiKey>;

@Schema({
  collection: 'api_keys',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class ApiKey {
  _id: string;

  /** Display name shown in admin (e.g. "5bib.com homepage", "5sport.vn widget"). */
  @Prop({ required: true }) name: string;

  /** First 12 chars of the full key — used for O(1) lookup. Format: `ak_xxxxxxxxx`. */
  @Prop({ required: true, unique: true, index: true }) keyPrefix: string;

  /** SHA-256 hex of the FULL key (prefix + secret). Verified via timingSafeEqual. */
  @Prop({ required: true }) keyHash: string;

  /** Optional CORS-style origin allowlist. Empty array = allow any origin. */
  @Prop({ type: [String], default: [] }) allowedOrigins: string[];

  /** Per-minute request cap. 0 = unlimited (use sparingly). */
  @Prop({ default: 1000 }) rateLimitPerMinute: number;

  /** Toggle to disable a key without deleting it. Cache invalidates within 60s. */
  @Prop({ default: true, index: true }) isActive: boolean;

  /** Last successful auth timestamp — useful for "delete idle keys" admin op. */
  @Prop() lastUsedAt: Date | null;

  /** Lifetime successful auth count. */
  @Prop({ default: 0 }) usageCount: number;

  /** Free-text note (which environment, who issued, expiration plan). */
  @Prop({ default: '' }) notes: string;

  /**
   * Permissions this key holds. Default empty = read-only widget access
   * (article-categories list/detail, articles list/detail). For write
   * operations grant scopes like `['articles:write']`. Checked by
   * LogtoOrApiKeyWriteGuard on admin endpoints that opt in to API-key auth.
   *
   * Known scopes (extend list as new write endpoints opt in):
   *   - articles:write  → create / update / publish / unpublish / delete articles
   *   - upload:write    → POST /api/upload (image upload)
   */
  @Prop({ type: [String], default: [] }) scopes: string[];

  createdAt: Date;
  updatedAt: Date;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);
