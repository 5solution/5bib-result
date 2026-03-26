import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResolveClaimDto {
  @ApiProperty({
    description: 'Claim resolution status',
    enum: ['resolved', 'rejected'],
    example: 'resolved',
  })
  @IsString()
  @IsIn(['resolved', 'rejected'])
  status: string;

  @ApiPropertyOptional({ description: 'Admin note', example: 'Verified and corrected.' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}
