import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class MerchantRaceItemDto {
  @ApiProperty({ description: 'MySQL race_id', example: 501 })
  raceId: number;

  @ApiProperty({ example: 'Trail Marathon Đà Lạt 2026' })
  title: string;

  @ApiProperty({
    description:
      'MySQL races.status raw value (COMPLETE/GENERATED_CODE/CANCEL/ONGOING) — frontend maps VN label. DRAFT đã filtered out.',
    example: 'GENERATED_CODE',
  })
  status: string;

  @ApiProperty({
    description: 'Ngày tổ chức (races.event_start_date)',
    nullable: true,
  })
  eventStartDate: Date | null;

  @ApiProperty({ description: 'MySQL tenant_id (BTC)', example: 42 })
  tenantId: number;

  @ApiProperty({
    description: 'Tổng vé đã bán (paid orders)',
    example: 1234,
  })
  ticketsSold: number;
}

export class MerchantRaceListResponseDto {
  @ApiProperty({ type: [MerchantRaceItemDto] })
  races: MerchantRaceItemDto[];

  @ApiProperty({ example: 5 })
  total: number;
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
