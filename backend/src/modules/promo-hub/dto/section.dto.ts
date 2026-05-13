import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
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
    description:
      'Optional ID. For edit operations: pass existing ObjectId hex (24 chars) to preserve. ' +
      'For new sections: omit OR pass any client-side temp ID (UUID v4 from ' +
      'crypto.randomUUID(), "tmp-*", etc.) — service layer auto-detects non-ObjectId ' +
      'and assigns fresh ObjectId. Validator accepts ANY string.',
  })
  @IsOptional()
  @IsString()
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
