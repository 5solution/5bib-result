import { createCanvas } from '@napi-rs/canvas';
import { CLASSIC_TEMPLATE } from './classic';
import { CELEBRATION_TEMPLATE } from './celebration';
import { ENDURANCE_TEMPLATE } from './endurance';
import { STORY_TEMPLATE } from './story';
import { STICKER_TEMPLATE } from './sticker';
import { PODIUM_TEMPLATE } from './podium';
import {
  resolveTemplate,
  resolveTemplateResult,
  getTemplate,
} from './index';
import type { RenderData } from './types';
import { SIZE_DIMENSIONS, PREVIEW_DIMENSIONS } from './types';

function makeRenderData(overrides: Partial<RenderData> = {}): RenderData {
  const size = overrides.size ?? '4:5';
  const preview = overrides.preview ?? false;
  const dim = preview ? PREVIEW_DIMENSIONS[size] : SIZE_DIMENSIONS[size];
  return {
    athleteName: 'Nguyễn Văn Á',
    bib: '1234',
    chipTime: '3:45:22',
    gunTime: '3:45:35',
    pace: '5:20',
    overallRank: '42',
    totalFinishers: 500,
    genderRank: '20',
    categoryRank: '5',
    category: 'M30-34',
    gender: 'Male',
    gap: '+0:12:30',
    distance: '42km',
    raceName: 'Test Race 2026',
    raceSlug: 'test-race-2026',
    raceDate: '2026-04-24',
    courseName: 'Full Marathon',
    splits: [
      { name: 'CP1', time: '0:25:00', pace: '5:00' },
      { name: 'CP2', time: '0:50:00', pace: '5:10' },
      { name: 'Finish', time: '3:45:22', pace: '5:20' },
    ],
    badges: [],
    resultUrl: 'https://result.5bib.com/races/test-race-2026/1234',
    textColorScheme: 'light',
    template: overrides.template ?? 'classic',
    size,
    canvasWidth: dim.width,
    canvasHeight: dim.height,
    preview,
    gradientPreset: 'blue',
    assets: {
      logo5BIB: null,
      fontFamily: 'Be Vietnam Pro',
      monoFontFamily: 'Inter',
    },
    showSplits: true,
    showQrCode: false,
    showBadges: true,
    textColorMode: 'auto',
    ...overrides,
  };
}

function mkCanvasFor(data: RenderData) {
  const canvas = createCanvas(data.canvasWidth, data.canvasHeight);
  return canvas.getContext('2d');
}

describe('Template smoke tests — all 6 render without throwing', () => {
  const templates = [
    ['classic', CLASSIC_TEMPLATE],
    ['celebration', CELEBRATION_TEMPLATE],
    ['endurance', ENDURANCE_TEMPLATE],
    ['story', STORY_TEMPLATE],
    ['sticker', STICKER_TEMPLATE],
    ['podium', PODIUM_TEMPLATE],
  ] as const;

  it.each(templates)('%s — full-res 4:5', async (name, tpl) => {
    const size = name === 'story' ? '9:16' : '4:5';
    const data = makeRenderData({ template: name, size });
    const ctx = mkCanvasFor(data);
    await expect(tpl.render(ctx, data)).resolves.toBeUndefined();
  });

  it.each(templates)('%s — preview mode', async (name, tpl) => {
    const size = name === 'story' ? '9:16' : '4:5';
    const data = makeRenderData({ template: name, size, preview: true });
    const ctx = mkCanvasFor(data);
    await expect(tpl.render(ctx, data)).resolves.toBeUndefined();
  });

  it('classic renders with badges', async () => {
    const data = makeRenderData({
      badges: [
        {
          type: 'PB',
          label: '🏆 Personal Best',
          shortLabel: 'PB',
          color: '#dc2626',
          meta: { delta: '0:05:23' },
        },
      ],
    });
    const ctx = mkCanvasFor(data);
    await expect(CLASSIC_TEMPLATE.render(ctx, data)).resolves.toBeUndefined();
  });

  it('celebration renders with PB badge', async () => {
    const data = makeRenderData({
      template: 'celebration',
      badges: [
        {
          type: 'PB',
          label: '🏆 Personal Best',
          shortLabel: 'PB',
          color: '#dc2626',
          meta: { delta: '0:08:21' },
        },
      ],
    });
    const ctx = mkCanvasFor(data);
    await expect(CELEBRATION_TEMPLATE.render(ctx, data)).resolves.toBeUndefined();
  });

  it('endurance with no splits renders fallback message', async () => {
    const data = makeRenderData({ template: 'endurance', splits: [] });
    const ctx = mkCanvasFor(data);
    await expect(ENDURANCE_TEMPLATE.render(ctx, data)).resolves.toBeUndefined();
  });

  it('podium with overall rank 1 renders gold theme', async () => {
    const data = makeRenderData({ template: 'podium', overallRank: '1' });
    const ctx = mkCanvasFor(data);
    await expect(PODIUM_TEMPLATE.render(ctx, data)).resolves.toBeUndefined();
  });

  it('podium with cat rank 2 (not overall) renders silver theme', async () => {
    const data = makeRenderData({
      template: 'podium',
      overallRank: '50',
      categoryRank: '2',
    });
    const ctx = mkCanvasFor(data);
    await expect(PODIUM_TEMPLATE.render(ctx, data)).resolves.toBeUndefined();
  });

  it('story renders with custom photo null gracefully', async () => {
    const data = makeRenderData({ template: 'story', size: '9:16' });
    const ctx = mkCanvasFor(data);
    await expect(STORY_TEMPLATE.render(ctx, data)).resolves.toBeUndefined();
  });

  it('sticker renders with no badges (generic finisher)', async () => {
    const data = makeRenderData({ template: 'sticker', badges: [] });
    const ctx = mkCanvasFor(data);
    await expect(STICKER_TEMPLATE.render(ctx, data)).resolves.toBeUndefined();
  });

  it('handles empty/missing fields gracefully', async () => {
    const data = makeRenderData({
      athleteName: '',
      chipTime: '',
      overallRank: '',
      categoryRank: '',
      distance: '',
      courseName: '',
      raceName: '',
    });
    const ctx = mkCanvasFor(data);
    await expect(CLASSIC_TEMPLATE.render(ctx, data)).resolves.toBeUndefined();
  });

  it('handles long athlete name (wraps to 2 lines, truncates further)', async () => {
    const data = makeRenderData({
      athleteName: 'Nguyen Van Rat La Dai Hoa Hong Bong Co Co Ten Rat La Dai Thu',
    });
    const ctx = mkCanvasFor(data);
    await expect(CLASSIC_TEMPLATE.render(ctx, data)).resolves.toBeUndefined();
  });
});

describe('resolveTemplate / resolveTemplateResult', () => {
  it('returns classic for classic', () => {
    const r = resolveTemplateResult('classic', makeRenderData({ template: 'classic' }));
    expect(r.template.name).toBe('classic');
    expect(r.fallback).toBe(false);
  });

  it('returns celebration for celebration', () => {
    const r = resolveTemplateResult(
      'celebration',
      makeRenderData({ template: 'celebration' }),
    );
    expect(r.template.name).toBe('celebration');
  });

  it('falls back to classic when podium requested by non-top-3', () => {
    const r = resolveTemplateResult(
      'podium',
      makeRenderData({ template: 'podium', overallRank: '50', categoryRank: '20' }),
    );
    expect(r.template.name).toBe('classic');
    expect(r.fallback).toBe(true);
    expect(r.reason).toContain('ineligible');
  });

  it('allows podium when overall rank 1', () => {
    const r = resolveTemplateResult(
      'podium',
      makeRenderData({ template: 'podium', overallRank: '1' }),
    );
    expect(r.template.name).toBe('podium');
    expect(r.fallback).toBe(false);
  });

  it('allows podium when category rank ≤ 3 (even if overall >> 3)', () => {
    const r = resolveTemplateResult(
      'podium',
      makeRenderData({ template: 'podium', overallRank: '75', categoryRank: '3' }),
    );
    expect(r.template.name).toBe('podium');
  });

  it('resolveTemplate returns template config directly (back-compat)', () => {
    const t = resolveTemplate('endurance', makeRenderData({ template: 'endurance' }));
    expect(t.name).toBe('endurance');
  });

  it('getTemplate returns classic fallback for unknown key', () => {
    // cast because the signature wouldn't allow 'bogus'
    const t = getTemplate('bogus' as 'classic');
    expect(t.name).toBe('classic');
  });
});
