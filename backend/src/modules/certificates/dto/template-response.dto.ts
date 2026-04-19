import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateCanvasDto } from './template-canvas.dto';
import { TemplateLayerDto } from './template-layer.dto';
import { PhotoAreaDto } from './photo-area.dto';
import {
  TEMPLATE_TYPES,
  TemplateType,
} from '../schemas/certificate-template.schema';

export class TemplateResponseDto {
  @ApiProperty({ example: '65f5e2b1a1b2c3d4e5f6a7b8' })
  id: string;

  @ApiProperty({ example: 'Finisher Certificate — 70K' })
  name: string;

  @ApiProperty({ example: '65f5e2b1a1b2c3d4e5f6a7b8' })
  race_id: string;

  @ApiPropertyOptional({ example: '70K', nullable: true })
  course_id?: string | null;

  @ApiProperty({ enum: TEMPLATE_TYPES })
  type: TemplateType;

  @ApiProperty({ type: TemplateCanvasDto })
  canvas: TemplateCanvasDto;

  @ApiProperty({ type: [TemplateLayerDto] })
  layers: TemplateLayerDto[];

  @ApiPropertyOptional({ type: PhotoAreaDto, nullable: true })
  photo_area?: PhotoAreaDto | null;

  @ApiPropertyOptional({ example: 'https://cdn.5bib.com/placeholder.png' })
  placeholder_photo_url?: string;

  @ApiProperty({ example: false })
  is_archived: boolean;

  @ApiProperty({ example: '2026-04-19T01:00:00Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-04-19T01:00:00Z' })
  updated_at: Date;
}

export class TemplateListResponseDto {
  @ApiProperty({ type: [TemplateResponseDto] })
  data: TemplateResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}
