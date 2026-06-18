import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TemplateCanvasDto } from '../../certificates/dto/template-canvas.dto';
import { TemplateLayerDto } from '../../certificates/dto/template-layer.dto';
import { PhotoAreaDto } from '../../certificates/dto/photo-area.dto';

/** FEATURE-090 — embedded template config (reuse certificates DTO). */
export class CrewTemplateDto {
  @ApiProperty({ type: TemplateCanvasDto })
  @ValidateNested()
  @Type(() => TemplateCanvasDto)
  canvas!: TemplateCanvasDto;

  @ApiProperty({ type: [TemplateLayerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateLayerDto)
  layers!: TemplateLayerDto[];

  @ApiPropertyOptional({ type: PhotoAreaDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => PhotoAreaDto)
  photoArea?: PhotoAreaDto | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeholderPhotoUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  photoBehindBackground?: boolean;
}

export class CreateBatchDto {
  @ApiProperty({ example: 'Crew Lào Cai Marathon 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  eventName!: string;

  @ApiProperty({ example: 'crew-lao-cai-2026', description: 'Slug public 3–60 [a-z0-9-]' })
  @IsString()
  @Matches(/^[a-z0-9-]{3,60}$/, { message: 'Slug chỉ gồm a-z, 0-9, - (3–60 ký tự)' })
  slug!: string;
}

export class UpdateBatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  eventName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{3,60}$/, { message: 'Slug chỉ gồm a-z, 0-9, - (3–60 ký tự)' })
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraFields?: string[];

  @ApiPropertyOptional({ type: CrewTemplateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CrewTemplateDto)
  template?: CrewTemplateDto;
}
