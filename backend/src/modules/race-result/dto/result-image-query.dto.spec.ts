import {
  normalizeImageConfig,
  ResultImageQueryDto,
  TEMPLATE_KEYS,
  SIZE_KEYS,
  GRADIENT_KEYS,
} from './result-image-query.dto';

function build(partial: Partial<ResultImageQueryDto>): ResultImageQueryDto {
  const dto = new ResultImageQueryDto();
  Object.assign(dto, partial);
  return dto;
}

describe('ResultImageQueryDto.normalizeImageConfig', () => {
  describe('defaults', () => {
    it('returns sensible defaults for empty DTO', () => {
      const out = normalizeImageConfig(build({}));
      expect(out.template).toBe('classic');
      expect(out.size).toBe('4:5');
      expect(out.gradient).toBe('blue');
      expect(out.showSplits).toBe(false);
      expect(out.showQrCode).toBe(false);
      expect(out.showBadges).toBe(true);
      expect(out.textColor).toBe('auto');
      expect(out.preview).toBe(false);
      expect(out.customMessage).toBeUndefined();
    });
  });

  describe('backward-compat aliases', () => {
    it('accepts `bg` alias and maps to gradient', () => {
      const out = normalizeImageConfig(build({ bg: 'sunset' }));
      expect(out.gradient).toBe('sunset');
    });

    it('accepts `ratio` alias and maps to size', () => {
      const out = normalizeImageConfig(build({ ratio: '1:1' }));
      expect(out.size).toBe('1:1');
    });

    it('prefers explicit `gradient` over `bg` alias', () => {
      const out = normalizeImageConfig(build({ gradient: 'forest', bg: 'sunset' }));
      expect(out.gradient).toBe('forest');
    });

    it('prefers explicit `size` over `ratio` alias', () => {
      const out = normalizeImageConfig(build({ size: '9:16', ratio: '1:1' }));
      expect(out.size).toBe('9:16');
    });
  });

  describe('sanitization — invalid values fall back to defaults', () => {
    it('unknown gradient → blue', () => {
      const out = normalizeImageConfig(build({ bg: 'neon-nightmare' }));
      expect(out.gradient).toBe('blue');
    });

    it('unknown size → 4:5', () => {
      const out = normalizeImageConfig(build({ ratio: '42:1' }));
      expect(out.size).toBe('4:5');
    });

    it('unknown template → classic', () => {
      const dto = build({});
      // bypass enum validator for this targeted test
      (dto as unknown as { template: string }).template = 'nonsense';
      const out = normalizeImageConfig(dto);
      expect(out.template).toBe('classic');
    });
  });

  describe('story template size enforcement', () => {
    it('forces 9:16 when template=story and size=4:5', () => {
      const out = normalizeImageConfig(build({ template: 'story', size: '4:5' }));
      expect(out.template).toBe('story');
      expect(out.size).toBe('9:16');
    });

    it('keeps 9:16 when template=story', () => {
      const out = normalizeImageConfig(build({ template: 'story', size: '9:16' }));
      expect(out.size).toBe('9:16');
    });

    it('does not force size for non-story templates', () => {
      const out = normalizeImageConfig(build({ template: 'classic', size: '1:1' }));
      expect(out.size).toBe('1:1');
    });
  });

  describe('customMessage truncation', () => {
    it('truncates customMessage to 50 chars', () => {
      const long = 'a'.repeat(80);
      const out = normalizeImageConfig(build({ customMessage: long }));
      expect(out.customMessage).toBe('a'.repeat(50));
    });

    it('passes short messages through', () => {
      const out = normalizeImageConfig(build({ customMessage: 'nice run' }));
      expect(out.customMessage).toBe('nice run');
    });

    it('handles undefined customMessage', () => {
      const out = normalizeImageConfig(build({}));
      expect(out.customMessage).toBeUndefined();
    });
  });

  describe('boolean flags', () => {
    it('keeps showBadges default=true when undefined', () => {
      const out = normalizeImageConfig(build({}));
      expect(out.showBadges).toBe(true);
    });

    it('honors showBadges=false explicitly', () => {
      const out = normalizeImageConfig(build({ showBadges: false }));
      expect(out.showBadges).toBe(false);
    });

    it('honors preview=true', () => {
      const out = normalizeImageConfig(build({ preview: true }));
      expect(out.preview).toBe(true);
    });
  });

  describe('constants', () => {
    it('TEMPLATE_KEYS has all 6 templates', () => {
      expect(TEMPLATE_KEYS).toEqual([
        'classic',
        'celebration',
        'endurance',
        'story',
        'sticker',
        'podium',
      ]);
    });

    it('SIZE_KEYS has 3 sizes', () => {
      expect(SIZE_KEYS).toEqual(['4:5', '1:1', '9:16']);
    });

    it('GRADIENT_KEYS has 5 presets', () => {
      expect(GRADIENT_KEYS).toEqual(['blue', 'dark', 'sunset', 'forest', 'purple']);
    });
  });
});
