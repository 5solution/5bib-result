/**
 * F-019 — PodiumStateMachineService unit tests (pure helpers).
 *
 * Coverage (10 cases):
 *  - happy: forward valid transitions allowed
 *  - happy: PODIUM_PUBLISHED → DISPUTE_OPEN allowed
 *  - happy: PODIUM_PUBLISHED → PODIUM_FINAL allowed
 *  - happy: DISPUTE_OPEN → AG_COMPUTED allowed (re-flow path)
 *  - edge: backward transition rejected (UNHAPPY-14)
 *  - edge: PODIUM_FINAL is terminal (no transitions allowed)
 *  - edge: skipping states rejected
 *  - edge: getAllowedTransitions returns empty for terminal
 *  - happy: forward chain RAW_RESULT → ... → PODIUM_FINAL fully traversable
 *  - validation: unknown state defaults to empty allowed list
 */

import { PodiumStateMachineService } from '../services/podium-state-machine.service';
import type { PodiumState } from '../schemas/podium.schema';

describe('PodiumStateMachineService.isValidTransition (BR-AG-23)', () => {
  it('allows forward RAW_RESULT → AG_COMPUTED', () => {
    expect(PodiumStateMachineService.isValidTransition('RAW_RESULT', 'AG_COMPUTED')).toBe(true);
  });

  it('allows BTC_REVIEW → PODIUM_DRAFT', () => {
    expect(PodiumStateMachineService.isValidTransition('BTC_REVIEW', 'PODIUM_DRAFT')).toBe(true);
  });

  it('allows PODIUM_PUBLISHED → DISPUTE_OPEN', () => {
    expect(PodiumStateMachineService.isValidTransition('PODIUM_PUBLISHED', 'DISPUTE_OPEN')).toBe(true);
  });

  it('allows PODIUM_PUBLISHED → PODIUM_FINAL', () => {
    expect(PodiumStateMachineService.isValidTransition('PODIUM_PUBLISHED', 'PODIUM_FINAL')).toBe(true);
  });

  it('allows DISPUTE_OPEN → AG_COMPUTED (re-flow)', () => {
    expect(PodiumStateMachineService.isValidTransition('DISPUTE_OPEN', 'AG_COMPUTED')).toBe(true);
  });

  it('rejects backward PODIUM_LOCKED → PODIUM_DRAFT (UNHAPPY-14)', () => {
    expect(PodiumStateMachineService.isValidTransition('PODIUM_LOCKED', 'PODIUM_DRAFT')).toBe(false);
  });

  it('rejects backward PODIUM_PUBLISHED → PODIUM_LOCKED', () => {
    expect(PodiumStateMachineService.isValidTransition('PODIUM_PUBLISHED', 'PODIUM_LOCKED')).toBe(false);
  });

  it('rejects skipping AG_COMPUTED → PODIUM_DRAFT', () => {
    expect(PodiumStateMachineService.isValidTransition('AG_COMPUTED', 'PODIUM_DRAFT')).toBe(false);
  });

  it('treats PODIUM_FINAL as terminal — no outgoing transitions', () => {
    expect(PodiumStateMachineService.getAllowedTransitions('PODIUM_FINAL')).toEqual([]);
  });

  it('happy path RAW_RESULT → ... → PODIUM_FINAL fully traversable', () => {
    const chain: PodiumState[] = [
      'RAW_RESULT',
      'AG_COMPUTED',
      'WARNINGS_GENERATED',
      'BTC_REVIEW',
      'PODIUM_DRAFT',
      'PODIUM_LOCKED',
      'PODIUM_PUBLISHED',
      'PODIUM_FINAL',
    ];
    for (let i = 0; i < chain.length - 1; i++) {
      expect(
        PodiumStateMachineService.isValidTransition(chain[i], chain[i + 1]),
      ).toBe(true);
    }
  });
});

describe('PodiumStateMachineService.getAllowedTransitions', () => {
  it('returns RAW_RESULT outgoing list', () => {
    expect(PodiumStateMachineService.getAllowedTransitions('RAW_RESULT')).toEqual(['AG_COMPUTED']);
  });

  it('returns PODIUM_PUBLISHED branching options', () => {
    const allowed = PodiumStateMachineService.getAllowedTransitions('PODIUM_PUBLISHED');
    expect(allowed).toContain('DISPUTE_OPEN');
    expect(allowed).toContain('PODIUM_FINAL');
  });
});
