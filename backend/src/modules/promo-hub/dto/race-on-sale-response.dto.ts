import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * FEATURE-033 — Query DTO cho GET /api/promo-hub/races-on-sale.
 *
 * `sort` whitelist enum để chống SQL injection (raw string into ORDER BY
 * caller-controlled = OWASP-classic vuln). class-validator IsEnum reject
 * non-whitelist values với 400.
 */
export const RACE_ON_SALE_SORT_VALUES = [
  'registration_start_time',
  'event_date',
] as const;
export type RaceOnSaleSort = (typeof RACE_ON_SALE_SORT_VALUES)[number];

export class RacesOnSaleQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 20,
    default: 6,
    description: 'Số race trả về (max 20 — match F-027 race_calendar limit).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiPropertyOptional({
    enum: RACE_ON_SALE_SORT_VALUES,
    default: 'registration_start_time',
    description:
      'Sort key. `registration_start_time` = race sắp mở bán hiển thị trước (BR-PH33-04 default). ' +
      '`event_date` = race sắp diễn ra hiển thị trước.',
  })
  @IsOptional()
  @IsEnum(RACE_ON_SALE_SORT_VALUES)
  sort?: RaceOnSaleSort;
}

/**
 * Public response DTO. Strip sensitive fields: tenant_id, is_show,
 * is_delete, created_by_id, metadata. Pre-compute `ticketUrl` để frontend
 * KHÔNG cần biết 5Ticket domain pattern.
 */
export class RaceOnSaleResponseDto {
  @ApiProperty({ description: 'race_id as string (bigint).' })
  raceId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ description: 'url_name slug — already filtered NOT NULL (BR-PH33-03).' })
  urlName: string;

  @ApiPropertyOptional()
  logoUrl: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  eventStartDate: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  registrationEndTime: string | null;

  @ApiPropertyOptional()
  location: string | null;

  @ApiPropertyOptional()
  brand: string | null;

  @ApiProperty({
    description:
      'Pre-computed 5Ticket URL: https://5ticket.vn/event/<urlName> (BR-PH33-05). ' +
      'Frontend dùng cho race card CTA — KHÔNG cần hard-code domain.',
  })
  ticketUrl: string;
}

export class RacesOnSaleListResponseDto {
  @ApiProperty({ type: [RaceOnSaleResponseDto] })
  data: RaceOnSaleResponseDto[];
}
