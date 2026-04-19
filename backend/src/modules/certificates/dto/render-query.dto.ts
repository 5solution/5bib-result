import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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
}
