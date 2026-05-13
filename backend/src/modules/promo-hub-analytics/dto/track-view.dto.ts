import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * FEATURE-027 — POST /api/promo-hub-analytics/track-view body.
 *
 * Fired by frontend `<PromoHubTracker>` on page-load. Server-side
 * rate-limit per IP+hub: 1 view per 5 minutes (BR-PH-09) via
 * `ratelimit:promo-view:<slug>:<ip-hash>` Redis key.
 */
export class TrackViewDto {
  @ApiProperty({ description: 'Promo hub _id (24-char Mongo ObjectId)' })
  @IsMongoId()
  hubId!: string;

  /**
   * Hub slug used for rate-limit key. Optional — server can resolve
   * via hubId lookup, but passing speeds up rate check (skip DB).
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referer?: string;
}
