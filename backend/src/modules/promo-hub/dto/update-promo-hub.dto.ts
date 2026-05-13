import { PartialType } from '@nestjs/swagger';
import { CreatePromoHubDto } from './create-promo-hub.dto';

/**
 * FEATURE-027 — PATCH /api/promo-hubs/:id body.
 *
 * All fields from create DTO become optional. Class-validator still
 * enforces field-level rules (slug regex, length, enum) when provided.
 *
 * Slug change: allowed but service-layer triggers cache invalidation
 * of BOTH old slug AND new slug.
 */
export class UpdatePromoHubDto extends PartialType(CreatePromoHubDto) {}
