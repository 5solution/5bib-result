import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsIn } from 'class-validator';

export class ApproveMerchantDto {
  @ApiPropertyOptional({ description: 'true = duyệt, false = từ chối' })
  @IsOptional()
  @IsBoolean()
  is_approved?: boolean;

  @ApiPropertyOptional({ enum: ['pending', 'active', 'suspended', 'terminated'] })
  @IsOptional()
  @IsIn(['pending', 'active', 'suspended', 'terminated'])
  contract_status?: string;

  @ApiPropertyOptional({ description: 'Ghi chú khi từ chối' })
  @IsOptional()
  rejection_note?: string;
}
