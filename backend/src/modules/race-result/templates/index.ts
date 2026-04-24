import type { TemplateKey } from '../dto/result-image-query.dto';
import type { RenderData, TemplateConfig } from './types';
import { CLASSIC_TEMPLATE } from './classic';
import { CELEBRATION_TEMPLATE } from './celebration';

/**
 * Phase 1: Classic + Celebration implemented fully.
 * Phase 2 will add: endurance, story, sticker, podium.
 *
 * Until Phase 2 lands, unknown templates fall back to Classic.
 * This matches PRD test case: Podium requested by non-top-3 → fallback to Classic (not 4xx).
 */
const REGISTRY: Partial<Record<TemplateKey, TemplateConfig>> = {
  classic: CLASSIC_TEMPLATE,
  celebration: CELEBRATION_TEMPLATE,
  // endurance: ENDURANCE_TEMPLATE, // Phase 2
  // story: STORY_TEMPLATE,         // Phase 2
  // sticker: STICKER_TEMPLATE,     // Phase 2
  // podium: PODIUM_TEMPLATE,       // Phase 2
};

export function getTemplate(key: TemplateKey): TemplateConfig {
  return REGISTRY[key] ?? CLASSIC_TEMPLATE;
}

/**
 * Check template eligibility + return effective template to render.
 *
 * Rules:
 * - Podium: requires overallRank ≤ 3 OR categoryRank ≤ 3 — else fallback to Classic
 * - Story: 9:16 only — caller should auto-correct size (normalizeImageConfig does this)
 * - Celebration: always allowed (graceful fallback to Classic-look if no badges)
 * - Unknown / Phase 2 pending: fallback to Classic
 */
export function resolveTemplate(
  requested: TemplateKey,
  data: RenderData,
): TemplateConfig {
  if (requested === 'podium') {
    const overallOk = isTop3(data.overallRank);
    const categoryOk = isTop3(data.categoryRank);
    if (!overallOk && !categoryOk) {
      return CLASSIC_TEMPLATE; // graceful fallback per PRD test case
    }
  }
  return getTemplate(requested);
}

function isTop3(rank: string | number): boolean {
  const n = typeof rank === 'number' ? rank : parseInt(rank, 10);
  return !isNaN(n) && n >= 1 && n <= 3;
}

export * from './types';
