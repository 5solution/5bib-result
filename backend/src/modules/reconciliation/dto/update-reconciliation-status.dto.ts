import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateReconciliationStatusDto {
  @ApiProperty({
    description: 'New status',
    enum: ['draft', 'flagged', 'ready', 'approved', 'sent', 'reviewed', 'signed', 'completed'],
  })
  @IsIn(['draft', 'flagged', 'ready', 'approved', 'sent', 'reviewed', 'signed', 'completed'])
  status: string;

  @ApiPropertyOptional({ description: 'Admin user id (for approved status)' })
  @IsOptional()
  @IsNumber()
  approved_by?: number;

  @ApiPropertyOptional({ description: 'Signed date ISO string (for signed status)' })
  @IsOptional()
  @IsString()
  signed_at?: string;

  @ApiPropertyOptional({ description: 'Optional note' })
  @IsOptional()
  @IsString()
  note?: string;
}
