import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class BatchCreateReconciliationDto {
  @ApiProperty({ example: '2026-03' })
  @IsString()
  period: string;

  @ApiProperty({ description: 'Array of merchant IDs or "all"' })
  @IsOptional()
  merchant_ids: number[] | 'all';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  skip_errors?: boolean;
}
