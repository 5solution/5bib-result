import { Test, TestingModule } from '@nestjs/testing';
import { RaceSyncCron, RACE_SYNC_CRON_INTERVAL_MINUTES } from './race-sync.cron';
import { RaceResultService } from './race-result.service';

describe('RaceSyncCron (F-068)', () => {
  let cron: RaceSyncCron;
  let mockService: { syncAllRaceResults: jest.Mock };

  beforeEach(async () => {
    mockService = { syncAllRaceResults: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RaceSyncCron,
        { provide: RaceResultService, useValue: mockService },
      ],
    }).compile();
    cron = module.get<RaceSyncCron>(RaceSyncCron);
  });

  describe('isCurrentlySync()', () => {
    it('returns false by default', () => {
      expect(cron.isCurrentlySync()).toBe(false);
    });

    it('returns true while handleCron in-flight, false when done', async () => {
      // Pause sync by holding promise
      let resolveSync: () => void = () => {};
      mockService.syncAllRaceResults.mockImplementation(
        () => new Promise<void>((r) => (resolveSync = r)),
      );

      const cronPromise = cron.handleCron();
      // Synchronous tick — by now isSyncing should be true
      expect(cron.isCurrentlySync()).toBe(true);
      resolveSync();
      await cronPromise;
      expect(cron.isCurrentlySync()).toBe(false);
    });
  });

  describe('getNextScheduledRunAt()', () => {
    it('returns null when isSyncing=true', async () => {
      let resolveSync: () => void = () => {};
      mockService.syncAllRaceResults.mockImplementation(
        () => new Promise<void>((r) => (resolveSync = r)),
      );
      const cronPromise = cron.handleCron();
      expect(cron.getNextScheduledRunAt()).toBeNull();
      resolveSync();
      await cronPromise;
    });

    it('rounds UP to next 10-min mark — mid-interval', () => {
      const now = new Date('2026-05-31T12:34:00.000Z');
      const next = cron.getNextScheduledRunAt(now);
      expect(next?.toISOString()).toBe('2026-05-31T12:40:00.000Z');
    });

    it('rounds UP to next 10-min mark — exactly on a mark', () => {
      const now = new Date('2026-05-31T12:30:00.000Z');
      const next = cron.getNextScheduledRunAt(now);
      // Must NOT return 12:30 (would be in the past once tick started)
      expect(next?.toISOString()).toBe('2026-05-31T12:40:00.000Z');
    });

    it('handles hour rollover when minute >= 50', () => {
      const now = new Date('2026-05-31T12:55:00.000Z');
      const next = cron.getNextScheduledRunAt(now);
      expect(next?.toISOString()).toBe('2026-05-31T13:00:00.000Z');
    });

    it('handles edge case 12:59:30', () => {
      const now = new Date('2026-05-31T12:59:30.000Z');
      const next = cron.getNextScheduledRunAt(now);
      expect(next?.toISOString()).toBe('2026-05-31T13:00:00.000Z');
    });

    it('handles UTC day rollover at 23:55', () => {
      const now = new Date('2026-05-31T23:55:00.000Z');
      const next = cron.getNextScheduledRunAt(now);
      expect(next?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    });
  });

  describe('RACE_SYNC_CRON_INTERVAL_MINUTES export', () => {
    it('exports the cron interval as 10 (matches @Cron decorator)', () => {
      expect(RACE_SYNC_CRON_INTERVAL_MINUTES).toBe(10);
    });
  });
});
