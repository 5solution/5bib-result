import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class EditResultDto {
  @ApiPropertyOptional({ description: 'Chip time (HH:MM:SS)', example: '3:20:15' })
  @IsOptional()
  @IsString()
  chipTime?: string;

  @ApiPropertyOptional({ description: 'Gun time (HH:MM:SS)', example: '3:20:28' })
  @IsOptional()
  @IsString()
  gunTime?: string;

  @ApiPropertyOptional({ description: 'Athlete name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Result status',
    enum: ['Finisher', 'DNF', 'DNS', 'DSQ'],
  })
  @IsOptional()
  @IsEnum(['Finisher', 'DNF', 'DNS', 'DSQ'])
  status?: 'Finisher' | 'DNF' | 'DNS' | 'DSQ';

  @ApiPropertyOptional({ description: 'Override overall rank (use with caution)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  overallRank?: number;

  @ApiProperty({
    description: 'Reason for edit (min 10 chars, required per BR-03)',
    example: 'Lỗi timing system, thời gian chip bị ghi thừa 2 phút',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  reason: string;
}

export class ResolveClaimV2Dto {
  @ApiProperty({
    description: 'Resolution action',
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  @IsString()
  @IsEnum(['approved', 'rejected'])
  action: 'approved' | 'rejected';

  @ApiProperty({
    description: 'Resolution note (required, min 5 chars)',
    example: 'Đã kiểm tra tracklog, xác nhận đúng',
    minLength: 5,
  })
  @IsString()
  @MinLength(5)
  resolutionNote: string;
}
