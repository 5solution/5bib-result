import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { TimingAlertPollService } from './timing-alert-poll.service';
import { TimingAlert } from '../schemas/timing-alert.schema';
import { TimingAlertPoll } from '../schemas/timing-alert-poll.schema';
import { TimingAlertConfig } from '../schemas/timing-alert-config.schema';
import { Race } from '../../races/schemas/race.schema';
import { TimingAlertConfigService } from './timing-alert-config.service';
import { RaceResultApiService } from '../../race-result/services/race-result-api.service';
import { MissDetectorService } from './miss-detector.service';
import { ProjectedRankService } from './projected-rank.service';
import { TimingAlertSseService } from './timing-alert-sse.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

/**
 * FEATURE-002 TD-008 — Unit tests cho 4 exception branches của resetRaceData.
 *
 * Cover BR-A1..BR-A4:
 * - BR-A1: race not found → NotFoundException (404)
 * - BR-A2: race status='live'/'ended' → ConflictException (409)
 * - BR-A3: Redis SETNX lock held → ConflictException (409)
 * - BR-A4: confirmToken sai → BadRequestException (400)
 */

describe('TimingAlertPollService.resetRaceData (TD-008 BR-A1..A4)', () => {
  let service: TimingAlertPollService;
  let mockRaceModel: { findById: jest.Mock };
  let mockRedis: { set: jest.Mock; get: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    mockRaceModel = {
      findById: jest.fn(),
    };
    mockRedis = {
      set: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TimingAlertPollService,
        { provide: getModelToken(TimingAlert.name), useValue: {} },
        { provide: getModelToken(TimingAlertPoll.name), useValue: {} },
        { provide: getModelToken(TimingAlertConfig.name), useValue: {} },
        { provide: getModelToken(Race.name), useValue: mockRaceModel },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
        { provide: TimingAlertConfigService, useValue: {} },
        { provide: RaceResultApiService, useValue: {} },
        { provide: MissDetectorService, useValue: {} },
        { provide: ProjectedRankService, useValue: {} },
        { provide: TimingAlertSseService, useValue: { emit: jest.fn() } },
        { provide: NotificationDispatcherService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(TimingAlertPollService);
  });

  describe('BR-A1: race not found', () => {
    it('throws NotFoundException with descriptive message', async () => {
      mockRaceModel.findById.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });

      await expect(
        service.resetRaceData(
          'nonexistent-id',
          { confirmToken: 'whatever' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.resetRaceData(
          'nonexistent-id',
          { confirmToken: 'whatever' },
          'user-1',
        ),
      ).rejects.toThrow('Race nonexistent-id not found');
    });
  });

  describe('BR-A2: race status live/ended', () => {
    it('throws ConflictException khi race=live', async () => {
      mockRaceModel.findById.mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              _id: 'race-1',
              title: 'Test Race',
              status: 'live',
              slug: 'test-race',
            }),
        }),
      });

      await expect(
        service.resetRaceData(
          'race-1',
          { confirmToken: 'test-race' },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.resetRaceData(
          'race-1',
          { confirmToken: 'test-race' },
          'user-1',
        ),
      ).rejects.toThrow(/đang ở status 'live'/);
    });

    it('throws ConflictException khi race=ended', async () => {
      mockRaceModel.findById.mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              _id: 'race-2',
              title: 'Ended Race',
              status: 'ended',
              slug: 'ended-race',
            }),
        }),
      });

      await expect(
        service.resetRaceData(
          'race-2',
          { confirmToken: 'ended-race' },
          'user-1',
        ),
      ).rejects.toThrow(/đang ở status 'ended'/);
    });

    it('passes guard khi race=draft hoặc pre_race', async () => {
      // Race draft — guard pass, sẽ tới confirmToken check
      mockRaceModel.findById.mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              _id: 'race-3',
              title: 'Draft Race',
              status: 'draft',
              slug: 'draft-race',
            }),
        }),
      });

      // confirmToken sai → throw BadRequestException, không phải ConflictException
      await expect(
        service.resetRaceData(
          'race-3',
          { confirmToken: 'WRONG' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('BR-A4: confirmToken validation', () => {
    beforeEach(() => {
      mockRaceModel.findById.mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              _id: 'race-4',
              title: 'Slug Race',
              status: 'pre_race',
              slug: 'expected-slug-here',
            }),
        }),
      });
    });

    it('throws BadRequestException khi confirmToken sai', async () => {
      await expect(
        service.resetRaceData(
          'race-4',
          { confirmToken: 'wrong-slug' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('message expose expected token (not secret — chống misclick)', async () => {
      await expect(
        service.resetRaceData(
          'race-4',
          { confirmToken: 'wrong-slug' },
          'user-1',
        ),
      ).rejects.toThrow(/expected-slug-here/);
    });

    it('falls back to race.title nếu slug missing', async () => {
      mockRaceModel.findById.mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              _id: 'race-5',
              title: 'Title Fallback',
              status: 'pre_race',
              slug: null,
            }),
        }),
      });

      await expect(
        service.resetRaceData(
          'race-5',
          { confirmToken: 'wrong' },
          'user-1',
        ),
      ).rejects.toThrow(/Title Fallback/);
    });
  });

  describe('BR-A3: Redis SETNX lock held', () => {
    beforeEach(() => {
      mockRaceModel.findById.mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              _id: 'race-6',
              title: 'Lock Test',
              status: 'pre_race',
              slug: 'lock-test',
            }),
        }),
      });
    });

    it('throws ConflictException khi SETNX trả null (lock held)', async () => {
      // First .get() check resetActive → null (no other reset). Then SETNX → null (held)
      mockRedis.set.mockResolvedValue(null);

      await expect(
        service.resetRaceData(
          'race-6',
          { confirmToken: 'lock-test' },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.resetRaceData(
          'race-6',
          { confirmToken: 'lock-test' },
          'user-1',
        ),
      ).rejects.toThrow(/Reset đang chạy/);
    });

    it('lock acquire dùng SETNX với TTL', async () => {
      mockRedis.set.mockResolvedValue(null); // simulate held để dừng sớm
      try {
        await service.resetRaceData(
          'race-6',
          { confirmToken: 'lock-test' },
          'user-1',
        );
      } catch {
        /* expected */
      }
      // Verify SETNX call shape: (key, value, mode='EX', ttl, 'NX')
      const setNxCall = mockRedis.set.mock.calls.find((c) =>
        String(c[0]).startsWith('timing-alert:reset-lock:'),
      );
      expect(setNxCall).toBeDefined();
      expect(setNxCall![2]).toBe('EX');
      expect(typeof setNxCall![3]).toBe('number');
      expect(setNxCall![4]).toBe('NX');
    });
  });
});
