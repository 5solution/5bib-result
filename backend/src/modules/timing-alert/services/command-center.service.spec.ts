import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandCenterService } from './command-center.service';
import { Race } from '../../races/schemas/race.schema';
import { RaceResult } from '../../race-result/schemas/race-result.schema';
import { TimingAlert } from '../schemas/timing-alert.schema';
import { TimingAlertPollService } from './timing-alert-poll.service';

/**
 * FEATURE-005 — CommandCenterService unit tests.
 *
 * Coverage:
 * 1. getLiveLeaderboard — happy path top N sorted Finish ASC
 * 2. getLiveLeaderboard — non-finishers sorted by lastCheckpoint orderIndex DESC
 * 3. getLiveLeaderboard — empty race returns empty entries
 * 4. getSummaryCards — racekit/started/finished/dns/missRate computed
 * 5. forceRefresh — user lock SETNX hold 30s
 * 6. forceRefresh — race lock held → STAMPEDE_WAIT (cached fallback)
 * 7. forceRefresh — concurrent 2 users → 1 win user lock, 1 throws 409
 */
describe('CommandCenterService — F-005', () => {
  let service: CommandCenterService;
  let mockRedis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    pipeline: jest.Mock;
    scanStream: jest.Mock;
  };
  let mockRaceModel: { findById: jest.Mock };
  let mockResultModel: { aggregate: jest.Mock; countDocuments: jest.Mock };
  let mockAlertModel: Record<string, jest.Mock>;
  let mockPollService: { pollRace: jest.Mock };

  const baseRace = {
    _id: 'race-1',
    title: 'Test Race',
    status: 'live',
    courses: [
      {
        courseId: 'c-42',
        name: '42K',
        distanceKm: 42,
        checkpoints: [
          { key: 'Start', name: 'Start', distanceKm: 0 },
          { key: 'TM1', name: 'CP1', distanceKm: 10 },
          { key: 'TM2', name: 'CP2', distanceKm: 25 },
          { key: 'Finish', name: 'Finish', distanceKm: 42 },
        ],
      },
    ],
  };

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      pipeline: jest.fn().mockReturnValue({
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      scanStream: jest.fn().mockReturnValue({
        on: (event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'end') setImmediate(() => handler());
        },
      }),
    };

    mockRaceModel = {
      findById: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(baseRace) }),
      }),
    };

    mockResultModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: () => Promise.resolve([]),
      }),
      countDocuments: jest.fn().mockReturnValue({
        exec: () => Promise.resolve(0),
      }),
    };

    mockAlertModel = {};
    mockPollService = {
      pollRace: jest.fn().mockResolvedValue({ courses: [] }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CommandCenterService,
        { provide: getModelToken(Race.name), useValue: mockRaceModel },
        { provide: getModelToken(RaceResult.name), useValue: mockResultModel },
        { provide: getModelToken(TimingAlert.name), useValue: mockAlertModel },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
        { provide: TimingAlertPollService, useValue: mockPollService },
      ],
    }).compile();

    service = moduleRef.get<CommandCenterService>(CommandCenterService);
  });

  // ─────────── getLiveLeaderboard ───────────

  describe('getLiveLeaderboard()', () => {
    it('returns top N sorted by Finish ASC (happy path)', async () => {
      mockResultModel.aggregate.mockReturnValue({
        exec: () =>
          Promise.resolve([
            {
              bib: '101',
              name: 'Athlete A',
              gender: 'M',
              category: 'M30',
              chiptimes: JSON.stringify({
                Start: '00:00',
                TM1: '00:25:00',
                TM2: '01:30:00',
                Finish: '03:15:00',
              }),
              chipTime: '03:15:00',
            },
            {
              bib: '102',
              name: 'Athlete B',
              gender: 'F',
              category: 'F30',
              chiptimes: JSON.stringify({
                Start: '00:00',
                TM1: '00:30:00',
                TM2: '01:45:00',
                Finish: '03:00:00',
              }),
              chipTime: '03:00:00',
            },
            {
              bib: '103',
              name: 'Athlete C',
              gender: 'M',
              category: 'M40',
              chiptimes: JSON.stringify({
                Start: '00:00',
                TM1: '00:28:00',
                TM2: '01:35:00',
                Finish: '03:30:00',
              }),
              chipTime: '03:30:00',
            },
          ]),
      });

      const result = await service.getLiveLeaderboard('race-1', 'c-42', 3);

      expect(result.courseId).toBe('c-42');
      expect(result.entries).toHaveLength(3);
      // Athlete B has 3:00:00 → rank 1
      expect(result.entries[0].bib).toBe('102');
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].finishTime).toBe('03:00:00');
      expect(result.entries[0].gap).toBeNull();
      // Athlete A → rank 2
      expect(result.entries[1].bib).toBe('101');
      expect(result.entries[1].finishTime).toBe('03:15:00');
      expect(result.entries[1].gap).toBe('+15:00');
      // Athlete C → rank 3
      expect(result.entries[2].bib).toBe('103');
      expect(result.entries[2].gap).toBe('+30:00');
    });

    it('sorts non-finishers by lastCheckpoint orderIndex DESC (projected)', async () => {
      mockResultModel.aggregate.mockReturnValue({
        exec: () =>
          Promise.resolve([
            // Athlete X — only Start
            {
              bib: '201',
              name: 'X',
              gender: null,
              category: null,
              chiptimes: JSON.stringify({
                Start: '00:00',
                TM1: '',
                TM2: '',
                Finish: '',
              }),
              chipTime: null,
            },
            // Athlete Y — passed TM2 (further along)
            {
              bib: '202',
              name: 'Y',
              gender: null,
              category: null,
              chiptimes: JSON.stringify({
                Start: '00:00',
                TM1: '00:25:00',
                TM2: '01:30:00',
                Finish: '',
              }),
              chipTime: null,
            },
            // Athlete Z — passed TM1
            {
              bib: '203',
              name: 'Z',
              gender: null,
              category: null,
              chiptimes: JSON.stringify({
                Start: '00:00',
                TM1: '00:30:00',
                TM2: '',
                Finish: '',
              }),
              chipTime: null,
            },
          ]),
      });

      const result = await service.getLiveLeaderboard('race-1', 'c-42', 10);

      expect(result.entries).toHaveLength(3);
      // Y (TM2) > Z (TM1) > X (Start)
      expect(result.entries[0].bib).toBe('202');
      expect(result.entries[1].bib).toBe('203');
      expect(result.entries[2].bib).toBe('201');
      // None has finish time
      expect(result.entries.every((e) => e.finishTime === null)).toBe(true);
      // All flagged hasMissingFinish (intermediate but no Finish)
      expect(result.entries.every((e) => e.hasMissingFinish)).toBe(true);
    });

    it('returns empty entries for race with no athletes', async () => {
      mockResultModel.aggregate.mockReturnValue({
        exec: () => Promise.resolve([]),
      });

      const result = await service.getLiveLeaderboard('race-1', 'c-42', 10);

      expect(result.entries).toHaveLength(0);
      expect(result.courseId).toBe('c-42');
      expect(result.courseName).toBe('42K');
    });

    it('returns empty entries when race status is draft (BR-CC-01)', async () => {
      mockRaceModel.findById.mockReturnValue({
        lean: () => ({
          exec: () => Promise.resolve({ ...baseRace, status: 'draft' }),
        }),
      });

      const result = await service.getLiveLeaderboard('race-1', 'c-42', 10);

      expect(result.entries).toHaveLength(0);
      // Aggregation should NOT have been called (short-circuit on draft)
      expect(mockResultModel.aggregate).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when course does not exist', async () => {
      await expect(
        service.getLiveLeaderboard('race-1', 'unknown-course', 10),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────── getSummaryCards ───────────

  describe('getSummaryCards()', () => {
    it('computes all metrics for live race', async () => {
      mockResultModel.countDocuments.mockReturnValue({
        exec: () => Promise.resolve(500),
      });

      const summary = await service.getSummaryCards(
        'race-1',
        baseRace as never,
        { started: 480, finished: 200, suspectOpen: 12 },
      );

      expect(summary.totalRegistered).toBe(500);
      expect(summary.started).toBe(480);
      expect(summary.finished).toBe(200);
      expect(summary.dns).toBe(20); // 500 - 480
      expect(summary.missCount).toBe(12);
      // missRate = 12/480 * 100 = 2.5
      expect(summary.missRate).toBe(2.5);
      // racekitPickedUp placeholder per F-005 scope
      expect(summary.racekitPickedUp).toBe(0);
    });

    it('returns all zeros when race is draft/pre_race', async () => {
      const summary = await service.getSummaryCards(
        'race-1',
        { ...baseRace, status: 'pre_race' } as never,
        { started: 0, finished: 0, suspectOpen: 0 },
      );

      expect(summary.totalRegistered).toBe(0);
      expect(summary.started).toBe(0);
      expect(summary.dns).toBe(0);
      expect(summary.missRate).toBe(0);
      // countDocuments NOT called when draft
      expect(mockResultModel.countDocuments).not.toHaveBeenCalled();
    });
  });

  // ─────────── forceRefresh ───────────

  describe('forceRefresh()', () => {
    it('acquires user lock with TTL 30s NX before triggering poll', async () => {
      // user lock acquire returns OK; race locks NOT held (acquire OK then release)
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.forceRefresh('race-1', 'user-A');

      expect(result).toBe('TRIGGERED');
      // First set call MUST be user lock with NX 30s
      const firstCall = mockRedis.set.mock.calls[0];
      expect(firstCall[0]).toBe('master:cc-refresh-lock-user:race-1:user-A');
      expect(firstCall[1]).toBe('1');
      expect(firstCall[2]).toBe('EX');
      expect(firstCall[3]).toBe(30);
      expect(firstCall[4]).toBe('NX');
      expect(mockPollService.pollRace).toHaveBeenCalledWith(
        'race-1',
        'cc-refresh:user-A',
      );
    });

    it('returns STAMPEDE_WAIT when all course locks held by another poll', async () => {
      // User lock OK; race locks ALL held (set returns null/non-OK)
      let callIdx = 0;
      mockRedis.set.mockImplementation((key: string) => {
        callIdx += 1;
        if (key.startsWith('master:cc-refresh-lock-user:')) {
          return Promise.resolve('OK');
        }
        // master:discover-lock:* — held by another poll
        return Promise.resolve(null);
      });

      const result = await service.forceRefresh('race-1', 'user-A');

      expect(result).toBe('STAMPEDE_WAIT');
      // pollService should NOT have been called
      expect(mockPollService.pollRace).not.toHaveBeenCalled();
      expect(callIdx).toBeGreaterThanOrEqual(2); // user lock + at least 1 race lock check
    });

    it('throws ConflictException 409 when user lock already held (concurrent users)', async () => {
      // First user takes lock
      mockRedis.set.mockResolvedValueOnce('OK'); // user A acquires
      mockRedis.set.mockResolvedValue('OK'); // race lock checks for user A pass

      await service.forceRefresh('race-1', 'user-A');

      // Second user — user lock returns null (already held)
      mockRedis.set.mockResolvedValueOnce(null);

      await expect(service.forceRefresh('race-1', 'user-B')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
