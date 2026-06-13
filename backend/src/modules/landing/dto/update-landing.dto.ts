import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  DomainInputDto,
  MetaInputDto,
  ThemeInputDto,
} from './landing-parts.dto';

/**
 * FEATURE-083 — PATCH /api/landings/:id. Partial update of meta/theme/domain
 * + internal label. Sections updated via PATCH /:id/sections (ReorderSectionsDto).
 */
export class UpdateLandingDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  internalName?: string;

  @ApiPropertyOptional({ type: MetaInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetaInputDto)
  meta?: MetaInputDto;

  @ApiPropertyOptional({ type: ThemeInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ThemeInputDto)
  theme?: ThemeInputDto;

  @ApiPropertyOptional({ type: DomainInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DomainInputDto)
  domain?: DomainInputDto;
}
