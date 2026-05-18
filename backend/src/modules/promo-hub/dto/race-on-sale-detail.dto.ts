import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * FEATURE-037 — Course DTO trong on-sale race detail response.
 *
 * Maps `race_course` table cols cần cho SEO detail page rendering.
 * Strip: `wave`, `add_ons`, admin-internal fields.
 */
export class RaceCourseDto {
  @ApiProperty({ description: 'Course ID (bigint as string)' })
  id!: string;

  @ApiProperty({ description: 'Course display prefix (e.g. "M42K")' })
  prefix!: string;

  @ApiPropertyOptional({ description: 'Course name VN' })
  name?: string | null;

  @ApiPropertyOptional({ description: 'Distance label (e.g. "42KM")' })
  distance?: string | null;

  @ApiPropertyOptional({
    description: 'Course description (HTML, will be sanitized server-side)',
  })
  description?: string | null;

  @ApiPropertyOptional({ description: 'Price in VND', minimum: 0 })
  price?: number | null;

  @ApiPropertyOptional({ description: 'Max participants', minimum: 0 })
  maxParticipate?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 120 })
  minAge?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 120 })
  maxAge?: number | null;

  @ApiPropertyOptional({ description: 'Registration window open' })
  openForSaleDateTime?: string | null;

  @ApiPropertyOptional({ description: 'Registration window close' })
  closeForSaleDateTime?: string | null;

  @ApiPropertyOptional({ description: 'Course route image URL' })
  routeImageUrl?: string | null;

  @ApiPropertyOptional({ description: 'Course map image URL' })
  routeMapImageUrl?: string | null;

  @ApiPropertyOptional({ description: 'Medal image URL' })
  medalUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Elevation gain e.g. "1500m+"',
  })
  gain?: string | null;

  @ApiPropertyOptional({
    description: 'Course type',
    enum: ['ORDINARY', 'VIRTUAL', 'CHARITY'],
  })
  courseType?: string | null;
}

/**
 * FEATURE-037 — Full on-sale race detail response.
 *
 * Returned by `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName`.
 * Strip sensitive: `tenant_id`, `is_delete`, `is_show`, `metadata.internal`,
 * `created_by_id`, `template_id`, `email_template_id`.
 *
 * Pre-computed `sellingWebUrl` per BR-37-09 (selling-web BR-12 format).
 */
export class RaceOnSaleDetailDto {
  @ApiProperty({ description: 'race_id (bigint as string)' })
  raceId!: string;

  @ApiProperty({ description: 'Race title' })
  title!: string;

  @ApiProperty({
    description:
      'URL slug (url_name OR fallback raceId nếu NULL — F-033 TD-F033-06)',
  })
  urlName!: string;

  @ApiPropertyOptional({
    description: 'Race long-form description (HTML, sanitized server-side)',
  })
  description?: string | null;

  @ApiPropertyOptional({ description: 'Logo / banner image URL' })
  logoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Additional images (CSV or JSON)' })
  images?: string | null;

  @ApiPropertyOptional()
  eventStartDate?: string | null;

  @ApiPropertyOptional()
  eventEndDate?: string | null;

  @ApiPropertyOptional()
  registrationStartTime?: string | null;

  @ApiPropertyOptional()
  registrationEndTime?: string | null;

  @ApiPropertyOptional({ description: 'Race location (text)' })
  location?: string | null;

  @ApiPropertyOptional()
  province?: string | null;

  @ApiPropertyOptional()
  district?: string | null;

  @ApiPropertyOptional({ description: 'Google Maps URL' })
  locationUrl?: string | null;

  @ApiPropertyOptional({ description: 'Organizer brand name' })
  brand?: string | null;

  @ApiPropertyOptional({ description: 'event_type field (e.g. "RUNNING")' })
  eventType?: string | null;

  @ApiPropertyOptional({
    description: 'race_type field (e.g. "MARATHON", "TRAIL", "ULTRA")',
  })
  raceType?: string | null;

  @ApiPropertyOptional()
  season?: string | null;

  @ApiProperty({
    description: 'Pre-built selling-web URL with UTM tracking (BR-37-09)',
    example:
      'https://5bib.com/vi/events/175_175?ref=seo-giai-chay&utm_source=organic&utm_medium=seo&utm_campaign=giai-chay',
  })
  sellingWebUrl!: string;

  @ApiProperty({
    type: [RaceCourseDto],
    description: 'Course list filtered deleted=0',
  })
  courses!: RaceCourseDto[];

  @ApiProperty({
    description: 'Source marker for frontend dual-source logic',
    enum: ['on-sale'],
  })
  source!: 'on-sale';
}
