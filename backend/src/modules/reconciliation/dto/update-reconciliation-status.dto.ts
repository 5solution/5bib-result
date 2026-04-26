import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateReconciliationStatusDto {
  @ApiProperty({
    description: 'New status',
    enum: ['draft', 'flagged', 'ready', 'approved', 'sent', 'reviewed', 'signed', 'completed'],
  })
  @IsIn(['draft', 'flagged', 'ready', 'approved', 'sent', 'reviewed', 'signed', 'completed'])
  status: string;

  @ApiPropertyOptional({ description: 'Admin user id \u2014 Mongo ObjectId string (for reviewed status)' })
  @IsOptional()
  @IsString()
  reviewed_by?: string;

  @ApiPropertyOptional({ description: 'Admin user id \u2014 Mongo ObjectId string (for approved status)' })
  @IsOptional()
  @IsString()
  approved_by?: string;

  @ApiPropertyOptional({ description: 'Signed date ISO string (for signed status)' })
  @IsOptional()
  @IsString()
  signed_at?: string;

  @ApiPropertyOptional({ description: 'Optional note' })
  @IsOptional()
  @IsString()
  note?: string;
}
