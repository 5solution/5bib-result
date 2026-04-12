import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateReconciliationStatusDto {
  @ApiProperty({
    description: 'New status',
    enum: ['draft', 'reviewed', 'sent', 'signed', 'completed'],
  })
  @IsIn(['draft', 'reviewed', 'sent', 'signed', 'completed'])
  status: string;

  @ApiPropertyOptional({ description: 'Signed date ISO string (for signed status)' })
  @IsOptional()
  @IsString()
  signed_at?: string;

  @ApiPropertyOptional({ description: 'Optional note' })
  @IsOptional()
  @IsString()
  note?: string;
}
