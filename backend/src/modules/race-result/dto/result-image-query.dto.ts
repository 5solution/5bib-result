import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export const TEMPLATE_KEYS = [
  'classic',
  'celebration',
  'endurance',
  'story',
  'sticker',
  'podium',
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const SIZE_KEYS = ['4:5', '1:1', '9:16'] as const;
export type SizeKey = (typeof SIZE_KEYS)[number];

export const GRADIENT_KEYS = [
  'blue',
  'dark',
  'sunset',
  'forest',
  'purple',
] as const;
export type GradientKey = (typeof GRADIENT_KEYS)[number];

export const TEXT_COLOR_MODES = ['auto', 'light', 'dark'] as const;
export type TextColorMode = (typeof TEXT_COLOR_MODES)[number];

/**
 * Body params for POST /race-results/result-image/:raceId/:bib
 * Also used as query params for GET preview endpoint (with preview=1).
 *
 * Backward-compat: `bg` → alias to `gradient`, `ratio` → alias to `size`.
 */
export class ResultImageQueryDto {
  @ApiProperty({ enum: TEMPLATE_KEYS, default: 'classic', required: false })
  @IsOptional()
  @IsIn([...TEMPLATE_KEYS])
  template?: TemplateKey = 'classic';

  @ApiProperty({ enum: SIZE_KEYS, default: '4:5', required: false })
  @IsOptional()
  @IsIn([...SIZE_KEYS])
  size?: SizeKey = '4:5';

  @ApiProperty({ enum: GRADIENT_KEYS, default: 'blue', required: false })
  @IsOptional()
  @IsIn([...GRADIENT_KEYS])
  gradient?: GradientKey = 'blue';

  /**
   * Deprecated alias for `gradient` — kept for backward compat with old frontend.
   */
  @ApiProperty({ required: false, deprecated: true })
  @IsOptional()
  @IsString()
  bg?: string;

  /**
   * Deprecated alias for `size` — kept for backward compat.
   */
  @ApiProperty({ required: false, deprecated: true })
  @IsOptional()
  @IsString()
  ratio?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  showSplits?: boolean = false;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  showQrCode?: boolean = false;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === true || value === 'true' || value === '1',
  )
  @IsBoolean()
  showBadges?: boolean = true;

  @ApiProperty({ required: false, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customMessage?: string;

  @ApiProperty({
    enum: TEXT_COLOR_MODES,
    default: 'auto',
    required: false,
  })
  @IsOptional()
  @IsEnum(TEXT_COLOR_MODES)
  textColor?: TextColorMode = 'auto';

  /** Internal flag — GET preview endpoint sets this to true. Not part of public DTO. */
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  preview?: boolean = false;
}

/**
 * Normalize DTO: resolve backward-compat aliases + auto-correct invalid combos.
 * Returns a strict, validated config ready for template dispatch.
 */
export interface NormalizedImageConfig {
  template: TemplateKey;
  size: SizeKey;
  gradient: GradientKey;
  showSplits: boolean;
  showQrCode: boolean;
  showBadges: boolean;
  customMessage?: string;
  textColor: TextColorMode;
  preview: boolean;
}

export function normalizeImageConfig(
  dto: ResultImageQueryDto,
): NormalizedImageConfig {
  // Backward-compat: `bg` and `ratio` from old endpoint
  const rawGradient = (dto.gradient ?? dto.bg ?? 'blue') as GradientKey;
  const rawSize = (dto.size ?? dto.ratio ?? '4:5') as SizeKey;

  const gradient: GradientKey = GRADIENT_KEYS.includes(rawGradient)
    ? rawGradient
    : 'blue';
  let size: SizeKey = SIZE_KEYS.includes(rawSize) ? rawSize : '4:5';
  let template: TemplateKey = TEMPLATE_KEYS.includes(
    dto.template as TemplateKey,
  )
    ? (dto.template as TemplateKey)
    : 'classic';

  // Story template is 9:16 only — auto-correct
  if (template === 'story' && size !== '9:16') {
    size = '9:16';
  }

  return {
    template,
    size,
    gradient,
    showSplits: dto.showSplits ?? false,
    showQrCode: dto.showQrCode ?? false,
    showBadges: dto.showBadges ?? true,
    customMessage: dto.customMessage?.slice(0, 50),
    textColor: dto.textColor ?? 'auto',
    preview: dto.preview ?? false,
  };
}
