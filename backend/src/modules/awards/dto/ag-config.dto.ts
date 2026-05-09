import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  COMPOUNDING_MODES,
  CompoundingMode,
} from '../schemas/podium.schema';

const PRESET_KEYS = [
  'vn_road_default',
  'road_5_year',
  'trail_itra',
  'trail_lite',
  'open_only',
] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

export class AGBracketDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsInt()
  min: number;

  @ApiProperty({ description: '-1 = no upper cap (e.g. 60+)' })
  @IsInt()
  max: number;
}

export class AGOverrideDto {
  @ApiProperty({ type: [AGBracketDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AGBracketDto)
  bracketsM: AGBracketDto[];

  @ApiProperty({ type: [AGBracketDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AGBracketDto)
  bracketsF: AGBracketDto[];

  @ApiPropertyOptional({ enum: ['upper', 'lower'] })
  @IsOptional()
  @IsIn(['upper', 'lower'])
  boundaryMode?: 'upper' | 'lower';
}

export class AGConfigDto {
  @ApiProperty({ enum: PRESET_KEYS })
  @IsIn(PRESET_KEYS as unknown as string[])
  presetKey: PresetKey;

  @ApiPropertyOptional({ enum: COMPOUNDING_MODES })
  @IsOptional()
  @IsEnum(COMPOUNDING_MODES)
  compoundingMode?: CompoundingMode;

  @ApiPropertyOptional({ description: 'Top N podium per AG, 1..10' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  agTopN?: number;

  @ApiPropertyOptional({ type: AGOverrideDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AGOverrideDto)
  override?: AGOverrideDto;

  @ApiPropertyOptional({
    description:
      'Pace threshold lower bound (sec/km) override per course. Default từ race-level config.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paceThresholdOverride?: number;
}

export class UpdateCoursePresetDto {
  @ApiProperty()
  @IsString()
  courseId: string;

  @ApiProperty({ type: AGConfigDto })
  @ValidateNested()
  @Type(() => AGConfigDto)
  config: AGConfigDto;
}

export class RaceAGConfigResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'object' } })
  byCourse: Record<string, AGConfigDto>;
}
