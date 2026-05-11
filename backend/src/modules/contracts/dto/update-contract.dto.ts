import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
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
}
