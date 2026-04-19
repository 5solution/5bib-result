import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  TEMPLATE_TYPES,
  TemplateType,
} from '../schemas/certificate-template.schema';

export class RenderQueryDto {
  @ApiProperty({ enum: TEMPLATE_TYPES, example: 'certificate' })
  @IsEnum(TEMPLATE_TYPES)
  type: TemplateType;

  @ApiPropertyOptional({
    example: '70K',
    description:
      'Course ID to resolve course-specific template override. If omitted, athlete course from result data is used.',
  })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'When false, photo_area and photo layers are skipped. The client can composite an athlete-uploaded photo over the returned PNG inside the photo_area bounds (returned by /certificates/render-meta).',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  includePhoto?: boolean;
}
