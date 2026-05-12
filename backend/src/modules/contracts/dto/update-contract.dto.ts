import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { CreateContractDto } from './create-contract.dto';

const UPDATABLE_STATUSES = ['CANCELLED'] as const;

export class UpdateContractDto extends PartialType(CreateContractDto) {
  /**
   * F-024 Fix 2: chỉ cho phép update status sang CANCELLED qua endpoint này.
   * Mọi transition khác (DRAFT→ACTIVE, ACTIVE→COMPLETED) qua endpoint riêng
   * (activate / markPaymentPaid) để giữ business rule consistency.
   */
  @ApiPropertyOptional({ enum: UPDATABLE_STATUSES })
  @IsOptional()
  @IsIn(UPDATABLE_STATUSES as unknown as string[])
  status?: 'CANCELLED';

  /**
   * F-028 — link tới MySQL platform tenants + races để F-028 P&L pull
   * SUM(total_price) thay vì fallback estimatedFee.
   *
   * - Optional — không link → P&L fallback estimatedFee (banner warning UI)
   * - Chỉ TICKET_SALES mới được set (service-layer validate reject 400)
   * - Edit anytime (DRAFT/ACTIVE/COMPLETED) — metadata, không affect amount.
   *
   * Truyền `null` (chứ KHÔNG omit) để UNLINK — service-layer pick null
   * khi key có mặt trong DTO body với value === null.
   */
  @ApiPropertyOptional({
    description: 'MySQL platform tenants.id (TICKET_SALES only)',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  linkedTenantId?: number | null;

  @ApiPropertyOptional({
    description: 'MySQL platform races.race_id (TICKET_SALES only)',
    example: 148,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  linkedMysqlRaceId?: number | null;
}
