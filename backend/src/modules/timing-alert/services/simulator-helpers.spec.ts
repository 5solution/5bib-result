import { __test__ } from './simulator.service';

const {
  filterAthlete,
  filterMapField,
  filterTimesField,
  deriveScalarsFromTimes,
  extractVisibleKeysFromJson,
  safeParseMap,
} = __test__;

/**
 * FEATURE-002 TD-008 — Unit tests cho 4 simulator helpers + filterAthlete extend.
 *
 * Cover:
 * - safeParseMap → 4 cases (valid, null/undef/empty, malformed, non-object)
 * - extractVisibleKeysFromJson → 3 cases
 * - filterMapField → 3 cases (BR-B1)
 * - filterTimesField → returns visibleKeys
 * - deriveScalarsFromTimes → 4 cases (BR-B3 post-scenario re-derive)
 * - filterAthlete → 5 cases (5 map fields + 11 scalars BR-B1, BR-B2, BR-B5)
 */

describe('simulator helpers (TD-008)', () => {
  describe('safeParseMap', () => {
    it('parses valid JSON object', () => {
      expect(safeParseMap('{"Start":"00:00","TM1":"05:00"}')).toEqual({
        Start: '00:00',
        TM1: '05:00',
      });
    });
    it('returns null for null/undefined/empty raw', () => {
      expect(safeParseMap(null)).toBeNull();
      expect(safeParseMap(undefined)).toBeNull();
      expect(safeParseMap('')).toBeNull();
      expect(safeParseMap('   ')).toBeNull();
    });
    it('returns null for malformed JSON', () => {
      expect(safeParseMap('not json {{{')).toBeNull();
    });
    it('returns null for non-object JSON (array)', () => {
      expect(safeParseMap('[1,2,3]')).toBeNull();
    });
  });

  describe('extractVisibleKeysFromJson', () => {
    it('extracts keys with non-empty values', () => {
      const result = extractVisibleKeysFromJson(
        '{"Start":"00:00","TM1":"","Finish":"01:00"}',
      );
      expect([...result].sort()).toEqual(['Finish', 'Start']);
    });
    it('returns empty set for null/malformed', () => {
      expect(extractVisibleKeysFromJson(null).size).toBe(0);
      expect(extractVisibleKeysFromJson('not json').size).toBe(0);
    });
    it('skips whitespace-only values', () => {
      const result = extractVisibleKeysFromJson(
        '{"Start":"  ","TM1":"05:00"}',
      );
      expect([...result]).toEqual(['TM1']);
    });
  });

  describe('filterMapField (BR-B1)', () => {
    it('keeps keys in visibleSet, sets "" for keys outside', () => {
      const visible = new Set(['Start', 'TM1']);
      const result = filterMapField(
        '{"Start":"00:00","TM1":"05:00","TM2":"10:00","Finish":"15:00"}',
        visible,
      );
      expect(result).toBe(
        '{"Start":"00:00","TM1":"05:00","TM2":"","Finish":""}',
      );
    });
    it('returns null for null/malformed input', () => {
      expect(filterMapField(null, new Set())).toBeNull();
      expect(filterMapField('not json', new Set())).toBeNull();
    });
    it('preserves all keys even when visibleSet empty', () => {
      const result = filterMapField(
        '{"Start":"00:00","TM1":"05:00"}',
        new Set(),
      );
      expect(result).toBe('{"Start":"","TM1":""}');
    });
  });

  describe('filterTimesField returns visibleKeys', () => {
    it('returns Set with keys having time ≤ cutoff', () => {
      const result = filterTimesField(
        '{"Start":"00:00","TM1":"00:30","TM2":"02:00"}',
        60, // cutoff = 60s
      );
      // Start=0, TM1=30 → visible. TM2=120 → not visible
      expect([...result.visibleKeys].sort()).toEqual(['Start', 'TM1']);
      expect(result.lastVisibleKey).toBe('TM1');
    });
    it('empty visibleKeys when cutoff = -1 (fresh reset)', () => {
      const result = filterTimesField(
        '{"Start":"00:00","TM1":"05:00"}',
        -1,
      );
      // Start=0 → 0 <= -1 FALSE → not visible
      expect(result.visibleKeys.size).toBe(0);
      expect(result.lastVisibleKey).toBeNull();
    });
    it('returns empty for null raw', () => {
      const result = filterTimesField(null, 100);
      expect(result.json).toBeNull();
      expect(result.visibleKeys.size).toBe(0);
    });
  });

  describe('deriveScalarsFromTimes (BR-B3 post-scenario re-derive)', () => {
    const baseItem = {
      Bib: 1234,
      Name: 'Test',
      Chiptimes: '{"Start":"00:00","TM1":"30:00","Finish":""}',
      Guntimes: '{"Start":"","TM1":"30:00","Finish":""}',
      Paces: '{"Start":"","TM1":"5:00","Finish":"5:30"}',
      TODs: '{"Start":"06:00:00","TM1":"06:30:00","Finish":"07:00:00"}',
      Sectors: '{"Start":"00:00","TM1":"30:00","Finish":"30:00"}',
      OverallRanks: '{"Start":"5","TM1":"3","Finish":"1"}',
      GenderRanks: '{"Start":"2","TM1":"1","Finish":"1"}',
      ChipTime: '01:00:00',
      GunTime: '01:00:30',
      Pace: '5:30',
      OverallRank: 1,
      GenderRank: 1,
      CatRank: 1,
      OverrankLive: 1,
      Gap: '+0',
      TimingPoint: 'Finish',
      Certi: 'Y',
      Certificate: 'Y',
      Finished: 1,
      Started: 1,
    } as Record<string, unknown>;

    it('clears scalar finals when Finish chip empty (post-scenario MISS_FINISH)', () => {
      const result = deriveScalarsFromTimes(baseItem as never) as unknown as Record<string, unknown>;
      // Chip Finish="" → finished=false → all scalar finals cleared
      expect(result.ChipTime).toBe('');
      expect(result.GunTime).toBe('');
      expect(result.Pace).toBe('');
      expect(result.OverallRank).toBe(0);
      expect(result.GenderRank).toBe(0);
      expect(result.OverrankLive).toBe(0);
      expect(result.Gap).toBe('');
      expect(result.Finished).toBe(0);
      expect(result.TimingPoint).toBe('TM1'); // last visible chip
    });

    it('keeps scalar finals when Finish chip has value', () => {
      const item = {
        ...baseItem,
        Chiptimes: '{"Start":"00:00","TM1":"30:00","Finish":"01:00:00"}',
      } as Record<string, unknown>;
      const result = deriveScalarsFromTimes(item as never) as unknown as Record<string, unknown>;
      expect(result.ChipTime).toBe('01:00:00');
      expect(result.OverallRank).toBe(1);
      expect(result.Finished).toBe(1);
      expect(result.TimingPoint).toBe('Finish');
    });

    it('filters map fields theo visibleKeys (Start+TM1 visible, Finish empty)', () => {
      const result = deriveScalarsFromTimes(baseItem as never) as unknown as Record<string, unknown>;
      // Chip Start="00:00" non-empty → visibleKeys.has('Start')=TRUE → keep
      // Paces.Start = "" (vendor convention pace at start luôn empty)
      expect(result.Paces).toBe('{"Start":"","TM1":"5:00","Finish":""}');
      // TODs.Start kept vì Start in visibleKeys
      expect(result.TODs).toBe(
        '{"Start":"06:00:00","TM1":"06:30:00","Finish":""}',
      );
      // OverallRanks.Start kept, TM1 kept, Finish clear
      expect(result.OverallRanks).toBe(
        '{"Start":"5","TM1":"3","Finish":""}',
      );
    });

    it('Started=0 when no chip key visible (athlete chưa start)', () => {
      const item = {
        ...baseItem,
        Chiptimes: '{"Start":"","TM1":"","Finish":""}',
        Guntimes: '{"Start":"","TM1":"","Finish":""}',
      } as Record<string, unknown>;
      const result = deriveScalarsFromTimes(item as never) as unknown as Record<string, unknown>;
      expect(result.Started).toBe(0);
      expect(result.Finished).toBe(0);
      expect(result.TimingPoint).toBe('');
    });
  });

  describe('filterAthlete (BR-B1, BR-B2, BR-B5)', () => {
    const sourceItem = {
      Bib: 5566,
      Name: 'Source',
      Chiptimes:
        '{"Start":"00:00","TM1":"30:00","TM2":"60:00","Finish":"90:00"}',
      Guntimes:
        '{"Start":"00:30","TM1":"30:30","TM2":"60:30","Finish":"90:30"}',
      Paces: '{"Start":"","TM1":"5:00","TM2":"5:00","Finish":"5:30"}',
      TODs:
        '{"Start":"06:00:00","TM1":"06:30:00","TM2":"07:00:00","Finish":"07:30:00"}',
      Sectors: '{"Start":"00:00","TM1":"30:00","TM2":"30:00","Finish":"30:00"}',
      OverallRanks: '{"Start":"5","TM1":"3","TM2":"2","Finish":"1"}',
      GenderRanks: '{"Start":"2","TM1":"1","TM2":"1","Finish":"1"}',
      ChipTime: '01:30:30',
      GunTime: '01:31:00',
      Pace: '5:15',
      OverallRank: 1,
      GenderRank: 1,
      CatRank: 1,
      OverrankLive: 1,
      Gap: '+0',
      TimingPoint: 'Finish',
      Certi: 'Y',
      Certificate: 'Y',
      Finished: 1,
      Started: 1,
    } as Record<string, unknown>;

    it('cutoff=-1 (fresh reset) → mọi map fields empty + scalars cleared', () => {
      const result = filterAthlete(sourceItem as never, -1) as unknown as Record<string, unknown>;
      expect(result.Chiptimes).toBe(
        '{"Start":"","TM1":"","TM2":"","Finish":""}',
      );
      expect(result.Paces).toBe(
        '{"Start":"","TM1":"","TM2":"","Finish":""}',
      );
      expect(result.OverallRanks).toBe(
        '{"Start":"","TM1":"","TM2":"","Finish":""}',
      );
      expect(result.Finished).toBe(0);
      expect(result.Started).toBe(0);
      expect(result.OverallRank).toBe(0);
      expect(result.ChipTime).toBe('');
    });

    it('cutoff đủ Start+TM1 → keep partial', () => {
      // 30:00 = 1800s. Cutoff = 1800 → Start+TM1 visible.
      const result = filterAthlete(sourceItem as never, 1800) as unknown as Record<string, unknown>;
      const chip = JSON.parse(result.Chiptimes as string) as Record<
        string,
        string
      >;
      expect(chip.Start).toBe('00:00');
      expect(chip.TM1).toBe('30:00');
      expect(chip.TM2).toBe('');
      expect(chip.Finish).toBe('');
      // TM2/Finish trong các map fields cũng phải empty
      const paces = JSON.parse(result.Paces as string) as Record<string, string>;
      expect(paces.TM2).toBe('');
      expect(paces.Finish).toBe('');
      // Scalars cleared (Finish chưa visible)
      expect(result.Finished).toBe(0);
      expect(result.OverallRank).toBe(0);
    });

    it('cutoff đủ qua Finish → keep all + scalars preserved', () => {
      // 90:00 = 5400s. Cutoff = 5500 → đủ qua Finish.
      const result = filterAthlete(sourceItem as never, 5500) as unknown as Record<string, unknown>;
      expect(result.Finished).toBe(1);
      expect(result.OverallRank).toBe(1);
      expect(result.ChipTime).toBe('01:30:30');
      expect(result.TimingPoint).toBe('Finish');
    });

    it('TimingPoint = last visible CP (BR-B5 visibleKeys SoT)', () => {
      // Cutoff đủ Start+TM1+TM2 nhưng KHÔNG đủ Finish → last visible = TM2
      const result = filterAthlete(sourceItem as never, 3700) as unknown as Record<string, unknown>;
      expect(result.TimingPoint).toBe('TM2');
    });

    it('5 map fields filter symmetric với chip visibility', () => {
      // Cutoff Start only
      const result = filterAthlete(sourceItem as never, 100) as unknown as Record<string, unknown>;
      const tods = JSON.parse(result.TODs as string) as Record<string, string>;
      // Start=00:00:00 visible (chip Start=00:00 = 0 ≤ 100), TM1+TM2+Finish "":
      expect(tods.Start).toBe('06:00:00');
      expect(tods.TM1).toBe('');
      expect(tods.TM2).toBe('');
      expect(tods.Finish).toBe('');
    });
  });
});
