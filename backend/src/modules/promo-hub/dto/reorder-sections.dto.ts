import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsMongoId } from 'class-validator';

/**
 * FEATURE-027 — PATCH /api/promo-hubs/:id/sections/reorder body.
 *
 * Caller passes new section order via array of section `_id` strings.
 * Service updates each section's `order` field to match index in array.
 *
 * Validation:
 *   - All IDs must be valid MongoIds.
 *   - All IDs must reference existing sections in the hub
 *     (extra IDs → 400 BadRequest; missing IDs → 400 BadRequest).
 *   - Reorder is atomic via `findOneAndUpdate` with `$set` per-element.
 */
export class ReorderSectionsDto {
  @ApiProperty({
    type: [String],
    description:
      'Ordered array of section _id strings — new order applied as index in array. Length must match current sections.length; all IDs must exist.',
    example: [
      '67451abc1234567890abcdef',
      '67451def1234567890abcdef',
      '67451fed1234567890abcdef',
    ],
  })
  @IsArray()
  @IsMongoId({ each: true })
  sectionIds!: string[];
}
