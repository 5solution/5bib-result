import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  CATEGORIES,
  Category,
  IncidentState,
  STATES,
} from '../schemas/medical-incident.schema';

/** F-018 BR-MI list view filters (Sec 4.1). */
export class ListIncidentsFilterDto {
  /** Severity multi-select (CSV "1,2,5" or repeated query params). */
  @ApiPropertyOptional({ type: [Number], example: [3, 4, 5] })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value.map((v) => parseInt(`${v}`, 10));
    if (typeof value === 'string') return value.split(',').map((v) => parseInt(v, 10));
    return [];
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  severity?: number[];

  @ApiPropertyOptional({ enum: STATES, isArray: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',');
    return [];
  })
  @IsArray()
  @IsIn(STATES as unknown as readonly string[], { each: true })
  state?: IncidentState[];

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES as unknown as readonly string[])
  category?: Category;

  @ApiPropertyOptional({ description: 'ISO 8601 — only incidents reportedAt >= this' })
  @IsOptional()
  @IsDateString()
  since?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() bib?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
