import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { SectionInputDto } from './section.dto';

/**
 * FEATURE-083 — PATCH /api/landings/:id/sections. Replaces the full section
 * array (add / remove / toggle enabled / reorder ▲▼ — template fill-in, no
 * drag-drop). Service re-numbers `order` by array position + validates
 * variant-by-type (BR-83-07) + sanitizes richtext.
 */
export class ReorderSectionsDto {
  @ApiProperty({ type: [SectionInputDto] })
  @IsArray()
  @ArrayMaxSize(40, { message: 'Tối đa 40 section' })
  @ValidateNested({ each: true })
  @Type(() => SectionInputDto)
  sections!: SectionInputDto[];
}
