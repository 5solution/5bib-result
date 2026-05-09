import { applyScenarios } from './scenario-engine';
import { RaceResultApiItem } from '../../race-result/types/race-result-api.types';
import { SimulationScenario } from '../schemas/timing-alert-simulation.schema';

/**
 * Phase A unit tests — scenarios drop key with value="" symmetric.
 *
 * BR-02: scenarios PHẢI strip key khỏi cả Chiptimes + Guntimes,
 * SET value="" thay vì delete (match real RR vendor schema).
 */

function makeAthlete(
  bib: string,
  chipFinish: string = '02:00:00',
  gunFinish: string = '02:05:00',
): RaceResultApiItem {
  return {
    Bib: bib as any,
    Name: 'Test',
    OverallRank: 1,
    GenderRank: 1,
    CatRank: 1,
    Gender: 'M',
    Category: '',
    ChipTime: chipFinish,
    GunTime: gunFinish,
    TimingPoint: 'Finish',
    Pace: '',
    Certi: '',
    Certificate: '',
    OverallRanks: '',
    GenderRanks: '',
    Chiptimes: JSON.stringify({
      Start: '00:00',
      TM1: '00:30:00',
      TM2: '01:00:00',
      TM3: '01:30:00',
      Finish: chipFinish,
    }),
    Guntimes: JSON.stringify({
      Start: '00:00',
      TM1: '00:30:00',
      TM2: '01:00:00',
      TM3: '01:30:00',
      Finish: gunFinish,
    }),
    Paces: '',
    TODs: '',
    Sectors: '',
    OverrankLive: 1,
    Gap: '',
    Nationality: '',
    Nation: '',
    Started: 0,
    Finished: 0,
    DNF: 0,
    Email: '',
  } as RaceResultApiItem;
}

function scenario(
  partial: Partial<SimulationScenario> & { type: SimulationScenario['type']; count: number },
): SimulationScenario {
  return {
    id: 'sc-' + partial.type,
    enabled: true,
    ...partial,
  } as SimulationScenario;
}

describe('Scenario Engine — Phase A behavior (BR-02)', () => {
  describe('MISS_FINISH — drop with value=""', () => {
    it('sets Finish="" in BOTH Chiptimes + Guntimes (symmetric)', () => {
      const items = [makeAthlete('100'), makeAthlete('101')];
      const result = applyScenarios(
        items,
        [scenario({ type: 'MISS_FINISH', count: 2 })],
        'sim-test',
      );
      const a0Chip = JSON.parse(result.items[0].Chiptimes);
      const a0Gun = JSON.parse(result.items[0].Guntimes);
      expect(a0Chip.Finish).toBe('');
      expect(a0Gun.Finish).toBe('');
      // Other keys preserved
      expect(a0Chip.Start).toBe('00:00');
      expect(a0Chip.TM1).toBe('00:30:00');
    });

    it('keeps all 5 keys in output (NOT delete)', () => {
      const items = [makeAthlete('100')];
      const result = applyScenarios(
        items,
        [scenario({ type: 'MISS_FINISH', count: 1 })],
        'sim-test',
      );
      const out = JSON.parse(result.items[0].Chiptimes);
      expect(Object.keys(out)).toEqual(['Start', 'TM1', 'TM2', 'TM3', 'Finish']);
    });

    it('exactly N athletes affected (deterministic)', () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        makeAthlete(`bib-${i}`),
      );
      const result = applyScenarios(
        items,
        [scenario({ type: 'MISS_FINISH', count: 3 })],
        'sim-test',
      );
      const dropped = result.items.filter(
        (it) => JSON.parse(it.Chiptimes).Finish === '',
      ).length;
      expect(dropped).toBe(3);
    });

    it('reset+replay produces identical affected set', () => {
      const items = Array.from({ length: 20 }, (_, i) =>
        makeAthlete(`bib-${i}`),
      );
      const r1 = applyScenarios(
        items,
        [scenario({ type: 'MISS_FINISH', count: 5 })],
        'sim-deterministic',
      );
      const r2 = applyScenarios(
        items,
        [scenario({ type: 'MISS_FINISH', count: 5 })],
        'sim-deterministic',
      );
      const dropped1 = r1.items
        .map((it, idx) =>
          JSON.parse(it.Chiptimes).Finish === '' ? idx : null,
        )
        .filter((i) => i !== null);
      const dropped2 = r2.items
        .map((it, idx) =>
          JSON.parse(it.Chiptimes).Finish === '' ? idx : null,
        )
        .filter((i) => i !== null);
      expect(dropped1).toEqual(dropped2);
    });
  });

  describe('LATE_FINISHER — shift time both fields', () => {
    it('shifts Finish time +30 min in BOTH Chiptimes + Guntimes', () => {
      const items = [makeAthlete('100')];
      const result = applyScenarios(
        items,
        [scenario({ type: 'LATE_FINISHER', count: 1, shiftMinutes: 30 })],
        'sim-late',
      );
      const out = JSON.parse(result.items[0].Chiptimes);
      const outGun = JSON.parse(result.items[0].Guntimes);
      // Original 02:00:00 = 7200s, +30min = 9000s = 02:30:00
      expect(out.Finish).toBe('02:30:00');
      // Guntimes original 02:05:00 = 7500s, +30min = 9300s = 02:35:00
      expect(outGun.Finish).toBe('02:35:00');
    });

    it('keeps schema 5 keys after shift (no delete)', () => {
      const items = [makeAthlete('100')];
      const result = applyScenarios(
        items,
        [scenario({ type: 'LATE_FINISHER', count: 1, shiftMinutes: 30 })],
        'sim-late',
      );
      const out = JSON.parse(result.items[0].Chiptimes);
      expect(Object.keys(out)).toEqual(['Start', 'TM1', 'TM2', 'TM3', 'Finish']);
    });
  });

  describe('Edge cases', () => {
    it('count=0 → no-op', () => {
      const items = [makeAthlete('100'), makeAthlete('101')];
      const result = applyScenarios(
        items,
        [scenario({ type: 'MISS_FINISH', count: 0 })],
        'sim-test',
      );
      const dropped = result.items.filter(
        (it) => JSON.parse(it.Chiptimes).Finish === '',
      ).length;
      expect(dropped).toBe(0);
    });

    it('count > total athletes → cap at total', () => {
      const items = [makeAthlete('100'), makeAthlete('101')];
      const result = applyScenarios(
        items,
        [scenario({ type: 'MISS_FINISH', count: 999 })],
        'sim-test',
      );
      const dropped = result.items.filter(
        (it) => JSON.parse(it.Chiptimes).Finish === '',
      ).length;
      expect(dropped).toBe(2); // capped at items.length
    });

    it('disabled scenario → no effect', () => {
      const items = [makeAthlete('100')];
      const result = applyScenarios(
        items,
        [{ ...scenario({ type: 'MISS_FINISH', count: 1 }), enabled: false }],
        'sim-test',
      );
      const out = JSON.parse(result.items[0].Chiptimes);
      expect(out.Finish).toBe('02:00:00');
    });
  });
});
