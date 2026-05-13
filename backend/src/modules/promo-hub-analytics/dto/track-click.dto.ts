import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * FEATURE-027 — POST /api/promo-hub-analytics/track-click body.
 *
 * Fired by frontend `<PromoHubTracker>` when user clicks a CTA / link
 * inside a published promo hub.
 *
 * Public endpoint (no auth) — rate-limited by Throttler at controller
 * level. Server adds IP hash + userAgent + referer from request headers,
 * never trusts client-supplied IP.
 */
export class TrackClickDto {
  @ApiProperty({ description: 'Promo hub _id (24-char Mongo ObjectId)' })
  @IsMongoId()
  hubId!: string;

  @ApiProperty({ description: 'Section _id where the clicked element rendered' })
  @IsMongoId()
  sectionId!: string;

  @ApiProperty({
    description: 'Human-readable label (button text / link anchor text)',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  label!: string;

  @ApiProperty({
    description: 'Destination URL (absolute or relative)',
    maxLength: 2000,
  })
  @IsString()
  @MaxLength(2000)
  url!: string;

  @ApiPropertyOptional({
    description:
      'Referer URL (optional — server still reads from `Referer` header as authoritative source)',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referer?: string;
}
