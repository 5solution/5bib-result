import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { DashboardSnapshotService } from './dashboard-snapshot.service';
import { CommandCenterService } from './command-center.service';
import { Race } from '../../races/schemas/race.schema';
import { RaceResult } from '../../race-result/schemas/race-result.schema';
import { TimingAlert } from '../schemas/timing-alert.schema';
import { TimingAlertPoll } from '../schemas/timing-alert-poll.schema';
import { NotificationDispatcherService } from './notification-dispatcher.service';

/**
 * FEATURE-005 — DashboardSnapshotService extension tests.
 *
 * Verifies:
 * 1. Response shape includes new `liveLeaderboard` + `summary` fields (F-005)
 * 2. Backward compatibility — existing F-002 fields shape unchanged
 *    (race / raceStats / courses / checkpointProgression / recentActivity / generatedAt)
 */
describe('DashboardSnapshotService — F-005 extension', () => {
  let service: DashboardSnapshotService;
  let mockRedis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let mockCommandCenter: {
    aggregateLeaderboardForAllCourses: jest.Mock;
    getSummaryCards: jest.Mock;
  };

  const liveRace = {
    _id: 'race-1',
    title: 'Test',
    status: 'live',
    startDate: new Date('2026-05-01T00:00:00Z'),
    endDate: null,
    statusHistory: [],
    courses: [],
  };

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockCommandCenter = {
      aggregateLeaderboardForAllCourses: jest.fn().mockResolvedValue([
        {
          courseId: 'c-42',
          courseName: '42K',
          distanceKm: 42,
          entries: [],
        },
      ]),
      getSummaryCards: jest.fn().mockResolvedValue({
        totalRegistered: 100,
        racekitPickedUp: 0,
        started: 80,
        finished: 30,
        dns: 20,
        missCount: 4,
        missRate: 5,
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardSnapshotService,
        {
          provide: getModelToken(Race.name),
          useValue: {
            findById: jest.fn().mockReturnValue({
              lean: () => ({ exec: () => Promise.resolve(liveRace) }),
            }),
          },
        },
        {
          provide: getModelToken(RaceResult.name),
          useValue: {
            aggregate: jest
              .fn()
              .mockReturnValue({ exec: () => Promise.resolve([]) }),
            countDocuments: jest
              .fn()
              .mockReturnValue({ exec: () => Promise.resolve(0) }),
          },
        },
        {
          provide: getModelToken(TimingAlert.name),
          useValue: {
            aggregate: jest
              .fn()
              .mockReturnValue({ exec: () => Promise.resolve([]) }),
            find: jest.fn().mockReturnValue({
              sort: () => ({
                limit: () => ({
                  select: () => ({
                    lean: () => ({ exec: () => Promise.resolve([]) }),
                  }),
                }),
              }),
            }),
          },
        },
        {
          provide: getModelToken(TimingAlertPoll.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: () => ({
                limit: () => ({
                  select: () => ({
                    lean: () => ({ exec: () => Promise.resolve([]) }),
                  }),
                }),
              }),
            }),
          },
        },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
        {
          provide: NotificationDispatcherService,
          useValue: { dispatchAnomaly: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: CommandCenterService, useValue: mockCommandCenter },
      ],
    }).compile();

    service = moduleRef.get<DashboardSnapshotService>(DashboardSnapshotService);
  });

  it('snapshot response includes new liveLeaderboard + summary fields (F-005)', async () => {
    const snapshot = await service.getSnapshot('race-1');

    expect(snapshot.liveLeaderboard).toBeDefined();
    expect(Array.isArray(snapshot.liveLeaderboard)).toBe(true);
    expect(snapshot.liveLeaderboard).toHaveLength(1);
    expect(snapshot.liveLeaderboard[0].courseId).toBe('c-42');

    expect(snapshot.summary).toBeDefined();
    expect(snapshot.summary.totalRegistered).toBe(100);
    expect(snapshot.summary.missRate).toBe(5);

    expect(mockCommandCenter.aggregateLeaderboardForAllCourses).toHaveBeenCalled();
    expect(mockCommandCenter.getSummaryCards).toHaveBeenCalled();
  });

  it('preserves existing F-002 fields shape (backward compat)', async () => {
    const snapshot = await service.getSnapshot('race-1');

    // F-002 race meta
    expect(snapshot.race).toBeDefined();
    expect(snapshot.race.id).toBe('race-1');
    expect(snapshot.race.title).toBe('Test');
    expect(snapshot.race.status).toBe('live');
    expect(snapshot.race.startedAt).toBeDefined();
    expect(snapshot.race.startedAtSource).toBeDefined();

    // F-002 raceStats
    expect(snapshot.raceStats).toBeDefined();
    expect(typeof snapshot.raceStats.started).toBe('number');
    expect(typeof snapshot.raceStats.finished).toBe('number');
    expect(typeof snapshot.raceStats.progress).toBe('number');

    // F-002 collections still arrays
    expect(Array.isArray(snapshot.courses)).toBe(true);
    expect(Array.isArray(snapshot.checkpointProgression)).toBe(true);
    expect(Array.isArray(snapshot.recentActivity)).toBe(true);

    // F-002 generatedAt timestamp
    expect(typeof snapshot.generatedAt).toBe('string');
    expect(snapshot.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
