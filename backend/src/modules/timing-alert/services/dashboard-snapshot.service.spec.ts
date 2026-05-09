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
import { TimingAlertConfigService } from './timing-alert-config.service';

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
        {
          provide: TimingAlertConfigService,
          useValue: {
            getByRaceId: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<DashboardSnapshotService>(DashboardSnapshotService);
  });

  it('snapshot response includes F-008 dnsCount + throughputHistory + checkpointHealthMatrix fields', async () => {
    const snapshot = await service.getSnapshot('race-1');
    expect(typeof snapshot.dnsCount).toBe('number');
    expect(Array.isArray(snapshot.throughputHistory)).toBe(true);
    expect(snapshot.throughputHistory).toHaveLength(12);
    expect(Array.isArray(snapshot.checkpointHealthMatrix)).toBe(true);
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

/**
 * FEATURE-008 — Command Center Refactor compute method tests (12 tests).
 *
 * Verifies BR-CC-02 (DNS), BR-CC-03 (throughput history), BR-CC-05/06
 * (checkpoint health matrix) per coder mandate.
 */
describe('DashboardSnapshotService — F-008 compute methods', () => {
  async function getService(rows: Array<{ courseId: string; bib: string; chiptimes: string }> = []): Promise<DashboardSnapshotService> {
    const aggregate = jest.fn().mockImplementation((pipeline: unknown) => ({
      exec: () => {
        // Filter rows by courseId from $match stage
        const stages = pipeline as Array<Record<string, unknown>>;
        const match = stages.find((s) => '$match' in s)?.['$match'] as
          | { courseId?: string }
          | undefined;
        const filtered = match?.courseId
          ? rows.filter((r) => r.courseId === match.courseId)
          : rows;
        return Promise.resolve(
          filtered.map((r) => ({ bib: r.bib, chiptimes: r.chiptimes })),
        );
      },
    }));
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardSnapshotService,
        {
          provide: getModelToken(Race.name),
          useValue: {
            findById: jest.fn().mockReturnValue({
              lean: () => ({ exec: () => Promise.resolve(null) }),
            }),
          },
        },
        {
          provide: getModelToken(RaceResult.name),
          useValue: {
            aggregate,
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
        {
          provide: getRedisConnectionToken(),
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
            del: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: NotificationDispatcherService,
          useValue: { dispatchAnomaly: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: CommandCenterService,
          useValue: {
            aggregateLeaderboardForAllCourses: jest
              .fn()
              .mockResolvedValue([]),
            getSummaryCards: jest.fn().mockResolvedValue({
              totalRegistered: 0,
              racekitPickedUp: 0,
              started: 0,
              finished: 0,
              dns: 0,
              missCount: 0,
              missRate: 0,
            }),
          },
        },
        {
          provide: TimingAlertConfigService,
          useValue: {
            getByRaceId: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();
    return moduleRef.get<DashboardSnapshotService>(DashboardSnapshotService);
  }

  // Race fixtures
  const raceLive = {
    _id: 'race-1',
    title: 'Test',
    status: 'live',
    startDate: new Date('2026-05-01T00:00:00Z'),
    endDate: null,
    statusHistory: [
      {
        from: 'pre_race',
        to: 'live',
        reason: 'start',
        changedBy: 'admin',
        changedAt: new Date(Date.now() - 60 * 60 * 1000), // 60 min ago
      },
    ],
    courses: [
      {
        courseId: 'c-42',
        name: '42K',
        distanceKm: 42,
        checkpoints: [
          { key: 'Start', name: 'Start', distanceKm: 0 },
          { key: 'CP1', name: 'CP1', distanceKm: 21 },
          { key: 'Finish', name: 'Finish', distanceKm: 42 },
        ],
      },
    ],
  } as unknown as import('../../races/schemas/race.schema').RaceDocument;

  const raceDraft = {
    ...raceLive,
    status: 'draft',
    statusHistory: [],
  } as unknown as import('../../races/schemas/race.schema').RaceDocument;

  const raceEnded = {
    ...raceLive,
    status: 'ended',
  } as unknown as import('../../races/schemas/race.schema').RaceDocument;

  // ─── computeDnsCount × 4 ───

  it('computeDnsCount: happy — registered minus started', async () => {
    const rows = [
      // Started athlete
      {
        courseId: 'c-42',
        bib: 'A',
        chiptimes: JSON.stringify({ Start: '00:00:00', Finish: '03:00:00' }),
      },
      // Started but not finished
      {
        courseId: 'c-42',
        bib: 'B',
        chiptimes: JSON.stringify({ Start: '00:00:05' }),
      },
      // DNS — no Start time
      { courseId: 'c-42', bib: 'C', chiptimes: JSON.stringify({}) },
      // DNS — Start key empty string
      {
        courseId: 'c-42',
        bib: 'D',
        chiptimes: JSON.stringify({ Start: '' }),
      },
    ];
    const svc = await getService(rows);
    const dns = await svc.computeDnsCount('race-1', raceLive);
    expect(dns).toBe(2); // C + D
  });

  it('computeDnsCount: race draft → 0', async () => {
    const rows = [
      {
        courseId: 'c-42',
        bib: 'A',
        chiptimes: JSON.stringify({ Start: '00:00:00' }),
      },
    ];
    const svc = await getService(rows);
    const dns = await svc.computeDnsCount('race-1', raceDraft);
    expect(dns).toBe(0);
  });

  it('computeDnsCount: race ended — still computes', async () => {
    const rows = [
      {
        courseId: 'c-42',
        bib: 'A',
        chiptimes: JSON.stringify({ Start: '00:00:00' }),
      },
      { courseId: 'c-42', bib: 'B', chiptimes: JSON.stringify({}) },
    ];
    const svc = await getService(rows);
    const dns = await svc.computeDnsCount('race-1', raceEnded);
    expect(dns).toBe(1);
  });

  it('computeDnsCount: 0 registered → 0', async () => {
    const svc = await getService([]);
    const dns = await svc.computeDnsCount('race-1', raceLive);
    expect(dns).toBe(0);
  });

  // ─── computeThroughputHistory × 4 ───

  it('computeThroughputHistory: returns 12 buckets ordered oldest→newest', async () => {
    const svc = await getService([]);
    const buckets = await svc.computeThroughputHistory('race-1', raceLive);
    expect(buckets).toHaveLength(12);
    for (let i = 1; i < buckets.length; i++) {
      expect(new Date(buckets[i].timestamp).getTime()).toBeGreaterThan(
        new Date(buckets[i - 1].timestamp).getTime(),
      );
      expect(buckets[i].finishersCount).toBe(0);
    }
  });

  it('computeThroughputHistory: race chưa start → flat 0', async () => {
    const svc = await getService([
      {
        courseId: 'c-42',
        bib: 'A',
        chiptimes: JSON.stringify({ Finish: '03:00:00' }),
      },
    ]);
    const buckets = await svc.computeThroughputHistory('race-1', raceDraft);
    expect(buckets).toHaveLength(12);
    for (const b of buckets) {
      expect(b.finishersCount).toBe(0);
    }
  });

  it('computeThroughputHistory: bucket counts athletes finishing within window', async () => {
    // race started 60 min ago. An athlete finishing at "00:30:00" relative
    // (30 min after start) → absolute 30 min ago → bucket index ≈ 6.
    // Result: at least 1 bucket > 0.
    const svc = await getService([
      {
        courseId: 'c-42',
        bib: 'A',
        chiptimes: JSON.stringify({ Finish: '00:30:00' }),
      },
      {
        courseId: 'c-42',
        bib: 'B',
        chiptimes: JSON.stringify({ Finish: '00:31:00' }),
      },
    ]);
    const buckets = await svc.computeThroughputHistory('race-1', raceLive);
    const total = buckets.reduce((s, b) => s + b.finishersCount, 0);
    expect(total).toBe(2);
  });

  it('computeThroughputHistory: athlete finishing OUTSIDE 60-min window not counted', async () => {
    const svc = await getService([
      // Finish 5 hours after race start → way outside last-60-min window
      {
        courseId: 'c-42',
        bib: 'A',
        chiptimes: JSON.stringify({ Finish: '05:00:00' }),
      },
    ]);
    const buckets = await svc.computeThroughputHistory('race-1', raceLive);
    const total = buckets.reduce((s, b) => s + b.finishersCount, 0);
    expect(total).toBe(0);
  });

  // ─── computeCheckpointHealthMatrix × 4 ───

  it('computeCheckpointHealthMatrix: happy — per-cp current/expected/healthPercent', async () => {
    // 10 athletes, all passed Start, 5 passed CP1, 0 passed Finish.
    const rows = Array.from({ length: 10 }, (_, i) => ({
      courseId: 'c-42',
      bib: String(i),
      chiptimes: JSON.stringify({
        Start: '00:00:00',
        ...(i < 5 ? { CP1: '02:00:00' } : {}),
      }),
    }));
    const svc = await getService(rows);
    const matrix = await svc.computeCheckpointHealthMatrix('race-1', raceLive);
    expect(matrix).toHaveLength(1);
    const course = matrix[0];
    expect(course.totalAthletes).toBe(10);
    expect(course.checkpoints).toHaveLength(3);
    const start = course.checkpoints[0];
    expect(start.current).toBe(10);
    // Linear ratio Start: 0/42 → expected = max(1, 0) = 1, current=10 → 100%.
    expect(start.healthPercent).toBe(100);
    const cp1 = course.checkpoints[1];
    // CP1 distanceKm 21 / 42 = 0.5; expected = round(10 × 0.5) = 5; current=5 → 100%.
    expect(cp1.expected).toBe(5);
    expect(cp1.current).toBe(5);
    expect(cp1.healthPercent).toBe(100);
    const finish = course.checkpoints[2];
    // Finish 42/42 → expected = 10, current = 0 → 0%
    expect(finish.expected).toBe(10);
    expect(finish.current).toBe(0);
    expect(finish.healthPercent).toBe(0);
  });

  it('computeCheckpointHealthMatrix: race draft (0 athletes) → all 0% no NaN', async () => {
    const svc = await getService([]);
    const matrix = await svc.computeCheckpointHealthMatrix(
      'race-1',
      raceDraft,
    );
    expect(matrix).toHaveLength(1);
    expect(matrix[0].totalAthletes).toBe(0);
    expect(matrix[0].overallPercent).toBe(0);
    for (const cp of matrix[0].checkpoints) {
      expect(cp.current).toBe(0);
      expect(cp.healthPercent).toBe(0);
      expect(Number.isFinite(cp.healthPercent)).toBe(true);
    }
  });

  it('computeCheckpointHealthMatrix: course với 0 checkpoints config → empty cells', async () => {
    const raceNoCps = {
      ...raceLive,
      courses: [
        {
          courseId: 'c-empty',
          name: 'Empty',
          distanceKm: 10,
          checkpoints: [],
        },
      ],
    } as unknown as import('../../races/schemas/race.schema').RaceDocument;
    const svc = await getService([]);
    const matrix = await svc.computeCheckpointHealthMatrix(
      'race-1',
      raceNoCps,
    );
    expect(matrix).toHaveLength(1);
    expect(matrix[0].checkpoints).toHaveLength(0);
    expect(matrix[0].overallPercent).toBe(0);
  });

  it('computeCheckpointHealthMatrix: green/amber/red threshold accuracy', async () => {
    // 10 athletes registered. CP1 distanceKm 21/42 → expected = 5.
    // 5 passed → 100% (green ≥90).
    // 4 passed → 80% (amber 70-90).
    // 1 passed → 20% (red <70).
    const buildRows = (cp1Count: number) =>
      Array.from({ length: 10 }, (_, i) => ({
        courseId: 'c-42',
        bib: String(i),
        chiptimes: JSON.stringify({
          Start: '00:00:00',
          ...(i < cp1Count ? { CP1: '02:00:00' } : {}),
        }),
      }));
    const greenSvc = await getService(buildRows(5));
    const greenMatrix = await greenSvc.computeCheckpointHealthMatrix(
      'race-1',
      raceLive,
    );
    expect(greenMatrix[0].checkpoints[1].healthPercent).toBeGreaterThanOrEqual(
      90,
    );
    const amberSvc = await getService(buildRows(4));
    const amberMatrix = await amberSvc.computeCheckpointHealthMatrix(
      'race-1',
      raceLive,
    );
    const amberPct = amberMatrix[0].checkpoints[1].healthPercent;
    expect(amberPct).toBeGreaterThanOrEqual(70);
    expect(amberPct).toBeLessThan(90);
    const redSvc = await getService(buildRows(1));
    const redMatrix = await redSvc.computeCheckpointHealthMatrix(
      'race-1',
      raceLive,
    );
    expect(redMatrix[0].checkpoints[1].healthPercent).toBeLessThan(70);
  });
});

/**
 * FEATURE-008 v2 — `computeLastPollAt` tests (BR-CC2-28).
 *
 * 2 new tests covering happy path (config has last_polled_at) + null edge
 * (config missing or never polled). Wires TimingAlertConfigService mock with
 * varying responses per test.
 */
describe('DashboardSnapshotService — F-008 v2 computeLastPollAt', () => {
  async function buildService(
    configResponse: { last_polled_at: Date | null } | null,
  ): Promise<DashboardSnapshotService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardSnapshotService,
        {
          provide: getModelToken(Race.name),
          useValue: {
            findById: jest.fn().mockReturnValue({
              lean: () => ({ exec: () => Promise.resolve(null) }),
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
        {
          provide: getRedisConnectionToken(),
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
            del: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: NotificationDispatcherService,
          useValue: { dispatchAnomaly: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: CommandCenterService,
          useValue: {
            aggregateLeaderboardForAllCourses: jest.fn().mockResolvedValue([]),
            getSummaryCards: jest.fn().mockResolvedValue({
              totalRegistered: 0,
              racekitPickedUp: 0,
              started: 0,
              finished: 0,
              dns: 0,
              missCount: 0,
              missRate: 0,
            }),
          },
        },
        {
          provide: TimingAlertConfigService,
          useValue: {
            getByRaceId: jest.fn().mockResolvedValue(configResponse),
          },
        },
      ],
    }).compile();
    return moduleRef.get<DashboardSnapshotService>(DashboardSnapshotService);
  }

  it('computeLastPollAt: happy — TimingAlertConfig has last_polled_at → returns Date', async () => {
    const polledAt = new Date('2026-05-06T07:30:00Z');
    const svc = await buildService({ last_polled_at: polledAt });
    const result = await svc.computeLastPollAt('race-1');
    expect(result).toEqual(polledAt);
  });

  it('computeLastPollAt: null edge — config missing → returns null', async () => {
    const svc = await buildService(null);
    const result = await svc.computeLastPollAt('race-1');
    expect(result).toBeNull();
  });
});
