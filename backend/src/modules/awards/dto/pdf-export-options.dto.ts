import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class PdfExportOptionsDto {
  @ApiPropertyOptional({
    description: 'Include footer 5BIB watermark (default true).',
  })
  @IsOptional()
  @IsBoolean()
  includeWatermark?: boolean;

  @ApiPropertyOptional({
    description:
      'Include race-organizer signature line (Phase 1 typed name; default true).',
  })
  @IsOptional()
  @IsBoolean()
  includeSignatureLine?: boolean;
}

export class PodiumPdfResponseDto {
  @ApiProperty() s3Key: string;
  @ApiProperty() signedUrl: string;
  @ApiProperty() expiresAtIso: string;
  @ApiProperty() bytes: number;
  @ApiProperty() generatedAt: string;
  @ApiPropertyOptional() warning?: string;
}
