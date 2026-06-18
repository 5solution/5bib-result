import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TemplateCanvasDto } from '../../certificates/dto/template-canvas.dto';
import { TemplateLayerDto } from '../../certificates/dto/template-layer.dto';
import { PhotoAreaDto } from '../../certificates/dto/photo-area.dto';

/** FEATURE-091 — phôi Border Pass (reuse certificates sub-DTO, giống F-090). */
export class BibPassTemplateDto {
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

export class BibPassStaticFieldsDto {
  @ApiPropertyOptional({ example: 'Sa Pa, Lào Cai' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({ example: '21/06/2026' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  raceDay?: string;

  @ApiPropertyOptional({ example: '42KM' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  distance?: string;

  @ApiPropertyOptional({ example: 'VM2026-', description: 'Tiền tố passport: {passport_no} = prefix + bib' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  passportPrefix?: string;
}

export class BibPassEmailDto {
  @ApiPropertyOptional({ example: '[5BIB] Border Pass của bạn — {event_name}' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiPropertyOptional({ description: 'HTML body. Token {name}/{bib}/{event_name} interpolate khi gửi.' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  bodyHtml?: string;

  @ApiPropertyOptional({ example: '5BIB' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  fromName?: string;
}

/** Upsert config cho 1 giải (raceId trên URL param). */
export class UpsertBibPassConfigDto {
  @ApiPropertyOptional({ example: 'Vietnam Mountain Marathon 2026' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  raceName?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: BibPassTemplateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BibPassTemplateDto)
  template?: BibPassTemplateDto;

  @ApiPropertyOptional({ type: BibPassStaticFieldsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BibPassStaticFieldsDto)
  staticFields?: BibPassStaticFieldsDto;

  @ApiPropertyOptional({ type: BibPassEmailDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BibPassEmailDto)
  email?: BibPassEmailDto;

  @ApiPropertyOptional({ example: 'border-pass-{bib}.png' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  attachmentFilename?: string;
}

/**
 * Body cho POST draft-preview (LIVE preview). Mang theo raceName + staticFields
 * để preview phản ánh giá trị CHƯA lưu (config có thể chưa tồn tại — preview
 * KHÔNG được 404 khi giải chưa cấu hình lần nào).
 */
export class BibPassPreviewDto {
  @ApiProperty({ type: BibPassTemplateDto })
  @ValidateNested()
  @Type(() => BibPassTemplateDto)
  template!: BibPassTemplateDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  raceName?: string;

  @ApiPropertyOptional({ type: BibPassStaticFieldsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BibPassStaticFieldsDto)
  staticFields?: BibPassStaticFieldsDto;
}

/** Body cho POST test-send. */
export class TestSendDto {
  @ApiProperty({ example: 'me@example.com', description: 'Email nhận thử (BẮT BUỘC — KHÔNG gửi cho VĐV thật).' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  toEmail!: string;

  @ApiPropertyOptional({ description: 'athletes_id để render bằng dữ liệu thật. Bỏ trống → dùng dữ liệu mẫu.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  athletesId?: number;
}
