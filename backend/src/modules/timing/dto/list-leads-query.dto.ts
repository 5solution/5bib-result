import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const STATUSES = ['new', 'contacted', 'quoted', 'closed_won', 'closed_lost'] as const;
type LeadStatus = (typeof STATUSES)[number];

export class ListLeadsQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiProperty({ required: false, enum: STATUSES })
  @IsOptional()
  @IsEnum(STATUSES)
  status?: LeadStatus;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  include_archived?: boolean = false;
}
