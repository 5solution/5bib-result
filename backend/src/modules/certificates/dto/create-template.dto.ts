import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  TEMPLATE_TYPES,
  TemplateType,
} from '../schemas/certificate-template.schema';
import { TemplateCanvasDto } from './template-canvas.dto';
import { TemplateLayerDto } from './template-layer.dto';
import { PhotoAreaDto } from './photo-area.dto';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Finisher Certificate — 70K' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '65f5e2b1a1b2c3d4e5f6a7b8' })
  @IsString()
  race_id: string;

  @ApiPropertyOptional({
    example: '70K',
    nullable: true,
    description: 'Null = applies to all courses in race',
  })
  @IsOptional()
  @IsString()
  course_id?: string | null;

  @ApiProperty({ enum: TEMPLATE_TYPES, example: 'certificate' })
  @IsEnum(TEMPLATE_TYPES)
  type: TemplateType;

  @ApiProperty({ type: TemplateCanvasDto })
  @ValidateNested()
  @Type(() => TemplateCanvasDto)
  canvas: TemplateCanvasDto;

  @ApiProperty({ type: [TemplateLayerDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TemplateLayerDto)
  layers: TemplateLayerDto[];

  @ApiPropertyOptional({ type: PhotoAreaDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => PhotoAreaDto)
  photo_area?: PhotoAreaDto | null;

  @ApiPropertyOptional({ example: 'https://cdn.5bib.com/placeholder.png' })
  @IsOptional()
  @IsString()
  placeholder_photo_url?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, photo_area and "photo" layers render BELOW canvas.backgroundImageUrl (for transparent PNG frames with a cut-out photo window, e.g. VMM finisher frame).',
  })
  @IsOptional()
  @IsBoolean()
  photo_behind_background?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_archived?: boolean;
}
