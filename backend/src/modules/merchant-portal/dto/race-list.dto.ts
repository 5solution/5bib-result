import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * F-069 M2b-1 BR-MP-26 — GET /api/merchant-portal/races response.
 *
 * Race list metadata (NO financial fields) + tổng vé bán (paid count).
 * Schema source: R3 verified MySQL `races` columns (race_id PK, title, status
 * UPPERCASE, event_start_date). `status` raw value — frontend maps qua dictionary
 * RACE_STATUS (BR-MP-05): COMPLETE→"Đã kết thúc", GENERATED_CODE→"Đang bán vé", etc.
 */
export class MerchantRaceItemDto {
  @ApiProperty({ description: 'MySQL race_id', example: 501 })
  raceId!: number;

  @ApiProperty({ example: 'Trail Marathon Đà Lạt 2026' })
  title!: string;

  @ApiProperty({
    description:
      'MySQL races.status raw value (COMPLETE/GENERATED_CODE/CANCEL/ONGOING) — frontend maps VN label. DRAFT đã filtered out.',
    example: 'GENERATED_CODE',
  })
  status!: string;

  @ApiProperty({
    description: 'Ngày tổ chức (races.event_start_date)',
    nullable: true,
  })
  eventStartDate!: Date | null;

  @ApiProperty({ description: 'MySQL tenant_id (BTC)', example: 42 })
  tenantId!: number;

  @ApiProperty({
    description: 'Tổng vé đã bán (paid orders)',
    example: 1234,
  })
  ticketsSold!: number;

  @ApiProperty({
    description: 'URL ảnh bìa giải (races.images) — null nếu chưa có',
    nullable: true,
    example: 'https://.../cover.jpg',
  })
  coverUrl!: string | null;
}

export class MerchantRaceListResponseDto {
  @ApiProperty({ type: [MerchantRaceItemDto] })
  races!: MerchantRaceItemDto[];

  @ApiProperty({ example: 5 })
  total!: number;
}

export class MerchantRaceListQueryDto {
  @ApiPropertyOptional({
    description: 'Filter theo 1 tenant (agency multi-tenant). Phải thuộc user scope.',
    example: 42,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tenantId?: number;
}
