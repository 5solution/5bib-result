import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScenarioType } from '../schemas/timing-alert-simulation.schema';

const SCENARIO_TYPES: ScenarioType[] = [
  'MISS_FINISH',
  'MISS_MIDDLE_CP',
  'MISS_START',
  'MAT_FAILURE',
  'TOP_N_MISS_FINISH',
  'LATE_FINISHER',
  'PHANTOM_RUNNER',
];

export class SimulationCourseInputDto {
  @ApiProperty({ example: '5K' })
  @IsString()
  label!: string;

  @ApiProperty({ example: 'https://api.raceresult.com/396207/LE2KX...' })
  @IsString()
  sourceUrl!: string;
}

export class CreateSimulationDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, default: 1.0, description: '1.0 = realtime, 5.0 = 5x speed' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  speedFactor?: number;

  @ApiProperty({ required: false, default: 0, description: 'Skip vào T=N giây race' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  startOffsetSeconds?: number;

  @ApiProperty({ type: [SimulationCourseInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimulationCourseInputDto)
  courses!: SimulationCourseInputDto[];
}

export class UpdateSimulationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  speedFactor?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  startOffsetSeconds?: number;
}

export class SeekSimulationDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  seconds!: number;
}

export class SimulationCourseResponseDto {
  @ApiProperty() simCourseId!: string;
  @ApiProperty() label!: string;
  @ApiProperty() sourceUrl!: string;
  @ApiProperty({ nullable: true, type: String }) snapshotFetchedAt!: string | null;
  @ApiProperty() snapshotItems!: number;
  @ApiProperty({ nullable: true, type: Number }) earliestSeconds!: number | null;
  @ApiProperty({ nullable: true, type: Number }) latestSeconds!: number | null;
  @ApiProperty({ description: 'Public URL để paste vào course.apiUrl' })
  publicUrl!: string;
}

// ─────────── Scenario DTOs ───────────

export class CreateScenarioDto {
  @ApiProperty({
    enum: SCENARIO_TYPES,
    description:
      'MISS_FINISH | MISS_MIDDLE_CP | MISS_START | MAT_FAILURE | TOP_N_MISS_FINISH | LATE_FINISHER | PHANTOM_RUNNER',
  })
  @IsEnum(SCENARIO_TYPES)
  type!: ScenarioType;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Số athletes affected (count). TOP_N dùng topN thay thế.' })
  @IsNumber()
  @Min(0)
  count!: number;

  @ApiProperty({
    required: false,
    description: 'MAT_FAILURE: checkpoint key cụ thể (VD "TM2")',
  })
  @IsOptional()
  @IsString()
  checkpointKey?: string;

  @ApiProperty({ required: false, description: 'TOP_N_MISS_FINISH: số top athletes' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  topN?: number;

  @ApiProperty({ required: false, description: 'LATE_FINISHER: số phút shift Finish' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(600)
  shiftMinutes?: number;

  @ApiProperty({ required: false, description: 'Optional scope chỉ apply cho 1 course' })
  @IsOptional()
  @IsString()
  scopeSimCourseId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateScenarioDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  count?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  checkpointKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  topN?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(600)
  shiftMinutes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  scopeSimCourseId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class ScenarioResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: SCENARIO_TYPES }) type!: ScenarioType;
  @ApiProperty() enabled!: boolean;
  @ApiProperty() count!: number;
  @ApiProperty({ required: false }) checkpointKey?: string;
  @ApiProperty({ required: false }) topN?: number;
  @ApiProperty({ required: false }) shiftMinutes?: number;
  @ApiProperty({ required: false }) scopeSimCourseId?: string;
  @ApiProperty({ required: false }) description?: string;
}

export class SimulationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty() speedFactor!: number;
  @ApiProperty() startOffsetSeconds!: number;
  @ApiProperty() status!: string;
  @ApiProperty({ nullable: true, type: String }) startedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) pausedAt!: string | null;
  @ApiProperty() accumulatedSeconds!: number;
  @ApiProperty() currentSimSeconds!: number;
  @ApiProperty({ type: [SimulationCourseResponseDto] })
  courses!: SimulationCourseResponseDto[];
  @ApiProperty({ type: [ScenarioResponseDto] })
  scenarios!: ScenarioResponseDto[];
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
