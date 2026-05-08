// @ts-nocheck — F-014 deferred spec (TD-F013-TESTSTACK locked, no RTL).
//   Activated via 1-line `testRegex` flip in admin jest config (future).
/**
 * F-014 BR-AS-01 — deriveAthleteStatus 9-status × signal matrix.
 *
 * Coverage:
 *   - DSQ via editHistory + via timingPoint sentinel + via dsqReason
 *   - DNF via dnf flag (number/boolean) + timingPoint
 *   - FIN via finish marker + meaningful chipTime + finite rank
 *   - DNS via timingPoint sentinel + race ended + chipFail
 *   - LIVE via startTime present
 *   - PICKED via racekitReceived
 *   - REG fallback default
 *   - MED / CUT via editHistory only (no vendor signal)
 */

import { deriveAthleteStatus } from '../lib/deriveAthleteStatus';

describe('deriveAthleteStatus (BR-AS-01 — 9-status enum)', () => {
  it('returns DSQ from editHistory manual override', () => {
    const row = {
      bib: 1,
      editHistory: [{ field: 'status', newValue: 'DSQ', reason: 'Cắt cua tại CP3' }],
    };
    expect(deriveAthleteStatus(row)).toBe('DSQ');
  });

  it('returns DSQ from timingPoint sentinel', () => {
    expect(deriveAthleteStatus({ bib: 2, timingPoint: 'DSQ-CP2' })).toBe('DSQ');
  });

  it('returns DSQ when dsqReason set', () => {
    expect(deriveAthleteStatus({ bib: 3, dsqReason: 'short course' })).toBe('DSQ');
  });

  it('returns MED only via editHistory (no vendor signal exists)', () => {
    const row = {
      bib: 4,
      editHistory: [{ field: 'status', newValue: 'MED', reason: 'Suy kiệt tại CP2 — giải y tế' }],
    };
    expect(deriveAthleteStatus(row)).toBe('MED');
  });

  it('returns CUT only via editHistory (manual flag)', () => {
    const row = {
      bib: 5,
      editHistory: [{ field: 'status', newValue: 'CUT', reason: 'Quá COT 2 phút' }],
    };
    expect(deriveAthleteStatus(row)).toBe('CUT');
  });

  it('returns DNF when dnf=1 (numeric)', () => {
    expect(deriveAthleteStatus({ bib: 6, dnf: 1 })).toBe('DNF');
  });

  it('returns DNF when dnf=true (boolean)', () => {
    expect(deriveAthleteStatus({ bib: 7, dnf: true })).toBe('DNF');
  });

  it('returns DNF from timingPoint sentinel', () => {
    expect(deriveAthleteStatus({ bib: 8, timingPoint: 'DNF' })).toBe('DNF');
  });

  it('returns FIN with finish marker + meaningful time + finite rank', () => {
    const row = {
      bib: 9,
      timingPoint: 'FINISH',
      chipTime: '01:23:45',
      OverallRank: '5',
    };
    expect(deriveAthleteStatus(row)).toBe('FIN');
  });

  it('rejects FIN when chipTime is sentinel "00:00:00"', () => {
    const row = {
      bib: 10,
      timingPoint: 'FINISH',
      chipTime: '00:00:00',
      OverallRank: '5',
    };
    // Falls back to LIVE (no finish data, but timingPoint isn't DNS/DNF/FINISH-meaningful)
    expect(deriveAthleteStatus(row)).not.toBe('FIN');
  });

  it('returns DNS when race ended + no signs of start + dnsChipFail=true', () => {
    const row = { bib: 11, dnsChipFail: true };
    expect(deriveAthleteStatus(row, 'ended')).toBe('DNS');
  });

  it('returns DNS via timingPoint=DNS', () => {
    expect(deriveAthleteStatus({ bib: 12, timingPoint: 'DNS' })).toBe('DNS');
  });

  it('returns LIVE when startTime present + no finish', () => {
    const row = { bib: 13, startTime: '2026-05-08T05:30:00Z' };
    expect(deriveAthleteStatus(row, 'live')).toBe('LIVE');
  });

  it('returns LIVE for partial split (timingPoint=TM1)', () => {
    expect(deriveAthleteStatus({ bib: 14, timingPoint: 'TM1' })).toBe('LIVE');
  });

  it('returns PICKED when racekitReceived=true and no startTime', () => {
    expect(deriveAthleteStatus({ bib: 15, racekitReceived: true })).toBe('PICKED');
  });

  it('returns PICKED via racekit_received snake_case variant', () => {
    expect(deriveAthleteStatus({ bib: 16, racekit_received: true })).toBe('PICKED');
  });

  it('returns REG fallback when no signal at all', () => {
    expect(deriveAthleteStatus({ bib: 17 })).toBe('REG');
  });

  it('manual editHistory takes precedence over vendor signal', () => {
    const row = {
      bib: 18,
      timingPoint: 'FINISH',
      chipTime: '01:00:00',
      OverallRank: '1',
      editHistory: [{ field: 'status', newValue: 'DSQ', reason: 'Cheating detected post-race' }],
    };
    expect(deriveAthleteStatus(row)).toBe('DSQ');
  });

  it('uses last status edit when multiple history entries', () => {
    const row = {
      bib: 19,
      editHistory: [
        { field: 'status', newValue: 'DNF', reason: 'r1' },
        { field: 'name', newValue: 'X', reason: 'typo' },
        { field: 'status', newValue: 'MED', reason: 'reclassified' },
      ],
    };
    expect(deriveAthleteStatus(row)).toBe('MED');
  });

  it('tolerates PascalCase vendor fields', () => {
    const row = {
      Bib: 20,
      TimingPoint: 'FINISH',
      ChipTime: '01:00:00',
      OverallRank: 1,
    };
    expect(deriveAthleteStatus(row)).toBe('FIN');
  });
});
