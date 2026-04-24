import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { TEMPLATE_KEYS, SIZE_KEYS, GRADIENT_KEYS } from './result-image-query.dto';

export const SHARE_CHANNELS = [
  'download',
  'web-share',
  'copy-link',
  'unknown',
] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export class LogShareEventDto {
  @ApiProperty({ description: 'Race ObjectId', example: '69df18a13a61ffbbf040369e' })
  @IsMongoId()
  raceId!: string;

  @ApiProperty({ description: 'Athlete bib number', example: '21306' })
  @IsString()
  @Length(1, 32)
  bib!: string;

  @ApiProperty({ enum: TEMPLATE_KEYS, example: 'classic' })
  @IsIn(TEMPLATE_KEYS as unknown as string[])
  template!: string;

  @ApiProperty({ enum: SHARE_CHANNELS, example: 'web-share' })
  @IsIn(SHARE_CHANNELS as unknown as string[])
  channel!: ShareChannel;

  @ApiPropertyOptional({ enum: GRADIENT_KEYS })
  @IsOptional()
  @IsIn(GRADIENT_KEYS as unknown as string[])
  gradient?: string;

  @ApiPropertyOptional({ enum: SIZE_KEYS })
  @IsOptional()
  @IsIn(SIZE_KEYS as unknown as string[])
  size?: string;

  @ApiPropertyOptional({
    description: 'True when backend fell back to classic (template ineligible)',
  })
  @IsOptional()
  @IsBoolean()
  templateFallback?: boolean;
}

export class TemplateCountDto {
  @ApiProperty() template!: string;
  @ApiProperty() count!: number;
}

export class ChannelCountDto {
  @ApiProperty() channel!: string;
  @ApiProperty() count!: number;
}

export class ShareStatsDto {
  @ApiProperty() totalShares!: number;
  @ApiProperty() totalUniqueBibs!: number;
  @ApiProperty({ type: [TemplateCountDto] })
  byTemplate!: TemplateCountDto[];
  @ApiProperty({ type: [ChannelCountDto] })
  byChannel!: ChannelCountDto[];
  @ApiProperty({ example: 0.0234, description: 'Fraction of shares that hit template fallback (0..1)' })
  fallbackRate!: number;
}
