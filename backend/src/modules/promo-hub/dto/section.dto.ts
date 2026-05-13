import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { SECTION_TYPES, SectionType } from '../schemas/promo-hub.schema';

export class SectionScheduleDto {
  @ApiProperty({ default: false })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class SectionInputDto {
  @ApiPropertyOptional({
    description: 'Optional ID — for edit operations preserve existing section _id.',
  })
  @IsOptional()
  @IsMongoId()
  _id?: string;

  @ApiProperty({ enum: SECTION_TYPES })
  @IsEnum(SECTION_TYPES)
  type!: SectionType;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  order!: number;

  @ApiProperty({ default: true })
  @IsBoolean()
  visible!: boolean;

  /**
   * Type-specific config. Discriminated by `type`. Schema validates
   * primitive shape — service layer additionally calls type-specific
   * sanitizers (e.g. `sanitize-html` on rich_text.html).
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Type-specific config payload (shape varies by section type)',
  })
  @IsObject()
  config!: Record<string, unknown>;

  @ApiPropertyOptional({ type: SectionScheduleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SectionScheduleDto)
  schedule?: SectionScheduleDto;
}

export class SectionResponseDto extends SectionInputDto {
  @ApiProperty()
  _id!: string;
}
