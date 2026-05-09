/**
 * F-019 v2 — AgeComputerService unit tests.
 *
 * Coverage: computeAge UTC math + leap year + race-day boundary.
 * MySQL queries skipped (TypeORM repo mocked).
 */
import { AgeComputerService } from '../services/age-computer.service';

describe('AgeComputerService', () => {
  let svc: AgeComputerService;

  beforeEach(() => {
    // Provide stub repos — only computeAge() pure function tested.
    svc = new AgeComputerService(
      {} as never,
      {} as never,
      {} as never,
    );
  });

  describe('computeAge (WA-style UTC math)', () => {
    it('happy path — 30 years exact birthday', () => {
      const dob = new Date(Date.UTC(1996, 4, 9));
      const raceDay = new Date(Date.UTC(2026, 4, 9));
      expect(svc.computeAge(dob, raceDay)).toBe(30);
    });

    it('birthday not yet reached → age - 1', () => {
      const dob = new Date(Date.UTC(1996, 4, 10));
      const raceDay = new Date(Date.UTC(2026, 4, 9));
      expect(svc.computeAge(dob, raceDay)).toBe(29);
    });

    it('leap year DOB 29/02 — race on 28/02 next year', () => {
      const dob = new Date(Date.UTC(2000, 1, 29));
      const raceDay = new Date(Date.UTC(2026, 1, 28));
      expect(svc.computeAge(dob, raceDay)).toBe(25);
    });

    it('leap year DOB 29/02 — race on 01/03 next year', () => {
      const dob = new Date(Date.UTC(2000, 1, 29));
      const raceDay = new Date(Date.UTC(2026, 2, 1));
      expect(svc.computeAge(dob, raceDay)).toBe(26);
    });

    it('boundary — race day = day before DOB anniversary', () => {
      const dob = new Date(Date.UTC(1990, 5, 15));
      const raceDay = new Date(Date.UTC(2026, 5, 14));
      expect(svc.computeAge(dob, raceDay)).toBe(35);
    });

    it('cross-year boundary — January race, December DOB', () => {
      const dob = new Date(Date.UTC(1985, 11, 31));
      const raceDay = new Date(Date.UTC(2026, 0, 1));
      expect(svc.computeAge(dob, raceDay)).toBe(40);
    });
  });
});
