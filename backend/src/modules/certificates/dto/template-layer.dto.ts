import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  LAYER_TYPES,
  LayerType,
  SHAPE_TYPES,
  ShapeType,
  TEXT_ALIGNS,
  TextAlign,
} from '../schemas/certificate-template.schema';

export class TemplateLayerDto {
  @ApiProperty({ enum: LAYER_TYPES, example: 'text' })
  @IsEnum(LAYER_TYPES)
  type: LayerType;

  @ApiProperty({ example: 100 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  y: number;

  @ApiPropertyOptional({ example: 400 })
  @IsOptional()
  @IsNumber()
  width?: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  rotation?: number;

  @ApiPropertyOptional({
    example: '{runner_name}',
    description:
      'Text or template. Supported vars: {runner_name}, {bib}, {finish_time}, {pace}, {distance}, {event_name}, {event_date}, {nation}, {gender_rank}, {ag_rank}, {overall_rank}',
  })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ example: 'Inter' })
  @IsOptional()
  @IsString()
  fontFamily?: string;

  @ApiPropertyOptional({ example: 48 })
  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(400)
  fontSize?: number;

  @ApiPropertyOptional({ example: '700' })
  @IsOptional()
  @IsString()
  fontWeight?: string;

  @ApiPropertyOptional({ enum: TEXT_ALIGNS, example: 'center' })
  @IsOptional()
  @IsEnum(TEXT_ALIGNS)
  textAlign?: TextAlign;

  @ApiPropertyOptional({ example: '#1c1917' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  letterSpacing?: number;

  @ApiPropertyOptional({ example: 1.2 })
  @IsOptional()
  @IsNumber()
  lineHeight?: number;

  @ApiPropertyOptional({ example: 'https://cdn.5bib.com/logo.png' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ enum: SHAPE_TYPES, example: 'rounded_rect' })
  @IsOptional()
  @IsEnum(SHAPE_TYPES)
  shape?: ShapeType;

  @ApiPropertyOptional({ example: '#1d4ed8' })
  @IsOptional()
  @IsString()
  fill?: string;

  @ApiPropertyOptional({ example: '#000000' })
  @IsOptional()
  @IsString()
  stroke?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  strokeWidth?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  borderRadius?: number;

  @ApiPropertyOptional({ example: 9999 })
  @IsOptional()
  @IsNumber()
  photoBorderRadius?: number;

  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional()
  @IsString()
  photoBorderColor?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  photoBorderWidth?: number;
}
