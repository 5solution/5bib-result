import { daysBefore, cumulativeCurve, YOY_MAX_DAYS } from './yoy.util';

const evt = new Date('2026-06-08T00:00:00Z');

describe('yoy.util (F-074)', () => {
  describe('daysBefore', () => {
    it('TC-01 computes days between payment and race', () => {
      expect(daysBefore(evt, new Date('2026-05-09T00:00:00Z'))).toBe(30);
      expect(daysBefore(evt, new Date('2026-06-08T00:00:00Z'))).toBe(0);
    });
    it('TC-02 placed after race day → 0', () => {
      expect(daysBefore(evt, new Date('2026-06-20T00:00:00Z'))).toBe(0);
    });
    it('TC-03 clamps to maxDays', () => {
      expect(daysBefore(evt, new Date('2024-01-01T00:00:00Z'), 180)).toBe(180);
    });
    it('TC-04 null on invalid dates', () => {
      expect(daysBefore(null, evt)).toBeNull();
      expect(daysBefore(evt, null)).toBeNull();
    });
  });

  describe('cumulativeCurve', () => {
    it('TC-05 cumulative increases toward race day; ordered maxDays..0', () => {
      // orders at 90, 60, 60, 30, 0 days before
      const pts = cumulativeCurve([90, 60, 60, 30, 0]);
      expect(pts[0].daysBefore).toBe(YOY_MAX_DAYS);
      expect(pts[pts.length - 1].daysBefore).toBe(0);
      const at90 = pts.find((p) => p.daysBefore === 90)!.cum;
      const at60 = pts.find((p) => p.daysBefore === 60)!.cum;
      const at0 = pts.find((p) => p.daysBefore === 0)!.cum;
      expect(at90).toBe(1); // only the D-90 order placed by then
      expect(at60).toBe(3); // +2 at D-60
      expect(at0).toBe(5); // all 5
    });
    it('TC-06 empty → all zero, final cum 0', () => {
      const pts = cumulativeCurve([]);
      expect(pts[pts.length - 1].cum).toBe(0);
      expect(pts).toHaveLength(YOY_MAX_DAYS + 1);
    });
    it('TC-07 ignores negatives, clamps large', () => {
      const pts = cumulativeCurve([-5, 999], 180);
      expect(pts.find((p) => p.daysBefore === 180)!.cum).toBe(1); // 999→180
      expect(pts.find((p) => p.daysBefore === 0)!.cum).toBe(1); // -5 ignored
    });
  });
});
