import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const STATUSES = ['new', 'contacted', 'quoted', 'closed_won', 'closed_lost'] as const;
type LeadStatus = (typeof STATUSES)[number];

export class UpdateLeadDto {
  @ApiProperty({ required: false, enum: STATUSES })
  @IsOptional()
  @IsEnum(STATUSES)
  status?: LeadStatus;

  @ApiProperty({ required: false, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  staff_notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_archived?: boolean;
}
