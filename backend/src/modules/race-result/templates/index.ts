import type { TemplateKey } from '../dto/result-image-query.dto';
import type { RenderData, TemplateConfig } from './types';
import { CLASSIC_TEMPLATE } from './classic';
import { CELEBRATION_TEMPLATE } from './celebration';
import { ENDURANCE_TEMPLATE } from './endurance';
import { STORY_TEMPLATE } from './story';
import { STICKER_TEMPLATE } from './sticker';
import { PODIUM_TEMPLATE } from './podium';

/**
 * Phase 2: All 6 templates implemented.
 *
 * Eligibility / fallback rules:
 *   - Podium: requires overallRank ≤ 3 OR categoryRank ≤ 3 → else fallback to Classic
 *   - Story: 9:16 only — DTO normalizer enforces size
 *   - Celebration: always allowed (no badges → generic "AMAZING RUN!" banner)
 *   - Classic / Endurance / Sticker: always allowed
 *
 * Unknown keys (future-compat / bad client) → fallback to Classic.
 */
const REGISTRY: Record<TemplateKey, TemplateConfig> = {
  classic: CLASSIC_TEMPLATE,
  celebration: CELEBRATION_TEMPLATE,
  endurance: ENDURANCE_TEMPLATE,
  story: STORY_TEMPLATE,
  sticker: STICKER_TEMPLATE,
  podium: PODIUM_TEMPLATE,
};

export function getTemplate(key: TemplateKey): TemplateConfig {
  return REGISTRY[key] ?? CLASSIC_TEMPLATE;
}

/**
 * Check template eligibility + return effective template to render.
 *
 * Returns `{ template, fallback }` where `fallback=true` means the caller
 * should expose X-Template-Fallback header (QC D-8 item in Sprint 3).
 */
export interface ResolvedTemplate {
  template: TemplateConfig;
  fallback: boolean;
  reason?: string;
}

export function resolveTemplateResult(
  requested: TemplateKey,
  data: RenderData,
): ResolvedTemplate {
  const config = REGISTRY[requested];
  if (!config) {
    return {
      template: CLASSIC_TEMPLATE,
      fallback: true,
      reason: `unknown-template:${requested}`,
    };
  }
  if (config.eligible && !config.eligible(data)) {
    return {
      template: CLASSIC_TEMPLATE,
      fallback: true,
      reason: `ineligible:${requested}`,
    };
  }
  return { template: config, fallback: false };
}

/**
 * Backward-compat helper — returns just the TemplateConfig (drops fallback flag).
 * Use `resolveTemplateResult` in new code when you need the fallback signal.
 */
export function resolveTemplate(
  requested: TemplateKey,
  data: RenderData,
): TemplateConfig {
  return resolveTemplateResult(requested, data).template;
}

export * from './types';
