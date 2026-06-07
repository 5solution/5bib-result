import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * F-069 — DTOs cho 2 admin search endpoints phục vụ dialog "Gán quyền BTC":
 *   - GET /admin/merchant-portal/tenants/search  → search BTC tổ chức giải
 *   - GET /admin/merchant-portal/races/search     → search giải (per-race grant)
 *
 * Tax/MST column trong bảng `tenant` của 5bib_platform_live = `vat`
 * (tên cột là `vat` nhưng thực tế lưu mã số thuế / mã DN — xem Tenant entity).
 */

export class AdminSearchQueryDto {
  @ApiPropertyOptional({
    description:
      'Từ khóa tìm kiếm (optional). Tenant: khớp name / mã số thuế / id. ' +
      'Race: khớp title / race_id. Bỏ trống → trả 50 kết quả đầu.',
    maxLength: 254,
    example: 'Marathon',
  })
  @IsString()
  @MaxLength(254)
  @IsOptional()
  q?: string;
}

export class AdminTenantSearchItemDto {
  @ApiProperty({ description: 'Tenant (BTC) ID', example: 42 })
  id!: number;

  @ApiProperty({ description: 'Tên BTC', example: 'CLB Chạy Bộ Sài Gòn' })
  name!: string;

  @ApiProperty({
    description: 'Mã số thuế / mã DN (cột `vat`). null nếu chưa có.',
    nullable: true,
    example: '0312345678',
  })
  taxCode!: string | null;
}

export class AdminTenantSearchResponseDto {
  @ApiProperty({ type: [AdminTenantSearchItemDto] })
  items!: AdminTenantSearchItemDto[];
}

export class AdminRaceSearchItemDto {
  @ApiProperty({ description: 'MySQL race_id', example: 501 })
  raceId!: number;

  @ApiProperty({ description: 'Tên giải', example: 'VnExpress Marathon 2026' })
  title!: string;

  @ApiProperty({
    description: 'Trạng thái giải (enum gốc, vd COMPLETE/ONGOING)',
    example: 'COMPLETE',
  })
  status!: string;

  @ApiProperty({ description: 'Tenant (BTC) ID sở hữu giải', example: 42 })
  tenantId!: number;

  @ApiProperty({
    description: 'Tên BTC (context). null nếu tenant đã bị xóa.',
    nullable: true,
    example: 'CLB Chạy Bộ Sài Gòn',
  })
  tenantName!: string | null;
}

export class AdminRaceSearchResponseDto {
  @ApiProperty({ type: [AdminRaceSearchItemDto] })
  items!: AdminRaceSearchItemDto[];
}
