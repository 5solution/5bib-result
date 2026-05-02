import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  TEMPLATE_TYPES,
  TemplateType,
} from '../schemas/certificate-template.schema';

export class ListTemplatesQueryDto {
  @ApiPropertyOptional({ example: '65f5e2b1a1b2c3d4e5f6a7b8' })
  @IsOptional()
  @IsString()
  raceId?: string;

  @ApiPropertyOptional({ example: '70K' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ enum: TEMPLATE_TYPES })
  @IsOptional()
  @IsEnum(TEMPLATE_TYPES)
  type?: TemplateType;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 200 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
