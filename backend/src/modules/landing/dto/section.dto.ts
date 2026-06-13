import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  LANDING_SECTION_TYPES,
  LandingSectionType,
} from '../landing.constants';

/**
 * FEATURE-083 — BR-83-04. One section in a landing. `variant` is validated
 * against `VARIANTS_BY_TYPE[type]` at the service layer (BR-83-07) — kept a
 * plain string here so new variants don't require a DTO redeploy.
 * `data` shape is type-specific (Mixed); richtext/url fields sanitized server-side.
 */
export class SectionInputDto {
  @ApiPropertyOptional({ description: 'Existing section _id (omit to create new)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ enum: LANDING_SECTION_TYPES })
  @IsEnum(LANDING_SECTION_TYPES, { message: 'Loại section không hợp lệ' })
  type!: LandingSectionType;

  @ApiProperty({ example: 'image', description: 'Variant theo type (BR-83-07)' })
  @IsString()
  variant!: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  order!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  anchor?: string;

  @ApiProperty({ type: 'object', additionalProperties: true, default: {} })
  @IsObject()
  data!: Record<string, unknown>;
}
