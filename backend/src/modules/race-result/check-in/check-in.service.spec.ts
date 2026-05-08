import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CheckInService } from './check-in.service';
import { CheckInSseService } from './check-in-sse.service';
import { CheckInLog } from './check-in-log.schema';
import { RaceAthlete } from '../../race-master-data/schemas/race-athlete.schema';

/**
 * F-015 BR-CK-04/05/10/15 — atomic check-in service unit specs.
 *
 * Mocks:
 *  - RaceAthlete model (findOne, findOneAndUpdate)
 *  - CheckInLog model (create)
 *  - Redis client (set / get / del / setex)
 *  - SSE service (emitPickup spy)
 *
 * Coverage:
 *  1. Happy path — atomic update + audit log + SSE broadcast
 *  2. Redis lock held → 409 ConflictException with code CHECKIN_LOCK_HELD
 *  3. Mongo matched=0 (already picked up) → 409 with CHECKIN_ALREADY_PICKED_UP
 *  4. Athlete not found → NotFoundException
 *  5. CMND PII boundary — invalid 4-digit input rejected
 */
describe('CheckInService', () => {
  let service: CheckInService;
  let athleteModel: any;
  let logModel: any;
  let redis: any;
  let sse: jest.Mocked<CheckInSseService>;

  // INFO_REDIS_TOKEN — '@nestjs-modules/ioredis' uses 'default_IORedisModuleConnectionToken'
  // for the default connection. We mirror its registry token shape via getRedisToken-equivalent.
  // Using string fallback below — tests are decoupled from the real provider.
  beforeEach(async () => {
    athleteModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
      aggregate: jest.fn(),
    };
    logModel = {
      create: jest.fn().mockResolvedValue({}),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      find: jest.fn(),
      aggregate: jest.fn(),
    };
    redis = {
      set: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    sse = {
      emitPickup: jest.fn(),
      subscribe: jest.fn(),
    } as unknown as jest.Mocked<CheckInSseService>;

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInService,
        { provide: getModelToken(RaceAthlete.name), useValue: athleteModel },
        { provide: getModelToken(CheckInLog.name), useValue: logModel },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: CheckInSseService, useValue: sse },
      ],
    }).compile();

    service = mod.get(CheckInService);
  });

  describe('confirmPickup', () => {
    const baseArgs = {
      raceId: '42',
      bib: '1001',
      body: { stationId: '1', source: 'bib' as const, athleteId: 555 },
      actor: { userId: 'admin-7' },
    };

    it('happy path: atomic update + audit log + SSE broadcast', async () => {
      redis.set.mockResolvedValue('OK'); // lock acquired
      athleteModel.findOneAndUpdate.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue({
            athletes_id: 555,
            bib_number: '1001',
            racekit_received: true,
            racekit_received_at: new Date(),
          }),
        }),
      });

      const out = await service.confirmPickup(
        baseArgs.raceId,
        baseArgs.bib,
        baseArgs.body,
        baseArgs.actor,
      );

      expect(out.bib).toBe('1001');
      expect(out.athleteId).toBe(555);
      expect(out.stationId).toBe('1');
      expect(out.source).toBe('bib');
      // SETNX with EX TTL — verify args shape includes 'NX'
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('checkin:lock:42:1001'),
        expect.any(String),
        'EX',
        5,
        'NX',
      );
      expect(logModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mysql_race_id: 42,
          bib_number: '1001',
          athletes_id: 555,
          station_id: '1',
          source: 'bib',
          sync_status: 'synced',
        }),
      );
      expect(sse.emitPickup).toHaveBeenCalledWith(
        '42',
        expect.objectContaining({ bib: '1001', athleteId: 555, stationId: '1' }),
      );
      // Best-effort lock release after success
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('checkin:lock:42:1001'),
      );
    });

    it('Redis lock held → 409 CHECKIN_LOCK_HELD', async () => {
      redis.set.mockResolvedValue(null); // SETNX rejected — another station holds lock

      await expect(
        service.confirmPickup(
          baseArgs.raceId,
          baseArgs.bib,
          baseArgs.body,
          baseArgs.actor,
        ),
      ).rejects.toThrow(ConflictException);

      expect(athleteModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(logModel.create).not.toHaveBeenCalled();
      expect(sse.emitPickup).not.toHaveBeenCalled();
    });

    it('Mongo matched=0 + athlete already exists → 409 CHECKIN_ALREADY_PICKED_UP', async () => {
      redis.set.mockResolvedValue('OK');
      athleteModel.findOneAndUpdate.mockReturnValue({
        lean: () => ({ exec: jest.fn().mockResolvedValue(null) }),
      });
      athleteModel.findOne.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue({
            athletes_id: 555,
            bib_number: '1001',
            racekit_received: true,
            racekit_received_at: new Date('2026-05-08T01:23:00Z'),
          }),
        }),
      });

      await expect(
        service.confirmPickup(
          baseArgs.raceId,
          baseArgs.bib,
          baseArgs.body,
          baseArgs.actor,
        ),
      ).rejects.toThrow(ConflictException);

      expect(logModel.create).not.toHaveBeenCalled();
      // Lock STILL released (finally block runs)
      expect(redis.del).toHaveBeenCalled();
    });

    it('athlete missing → NotFoundException', async () => {
      redis.set.mockResolvedValue('OK');
      athleteModel.findOneAndUpdate.mockReturnValue({
        lean: () => ({ exec: jest.fn().mockResolvedValue(null) }),
      });
      athleteModel.findOne.mockReturnValue({
        lean: () => ({ exec: jest.fn().mockResolvedValue(null) }),
      });

      await expect(
        service.confirmPickup(
          baseArgs.raceId,
          baseArgs.bib,
          baseArgs.body,
          baseArgs.actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects invalid race id', async () => {
      await expect(
        service.confirmPickup('not-a-number', '1001', baseArgs.body, baseArgs.actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('lookupByCmndLastFour (BR-CK-10 PII boundary)', () => {
    it('rejects non-4-digit inputs', async () => {
      await expect(service.lookupByCmndLastFour('42', '12')).rejects.toThrow();
      await expect(service.lookupByCmndLastFour('42', '12345')).rejects.toThrow();
      await expect(service.lookupByCmndLastFour('42', 'abcd')).rejects.toThrow();
    });

    it('accepts 4 digits and queries with anchored regex', async () => {
      athleteModel.find.mockReturnValue({
        select: () => ({
          limit: () => ({
            lean: () => ({ exec: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      });
      const out = await service.lookupByCmndLastFour('42', '1234');
      expect(out).toEqual([]);
      expect(athleteModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          mysql_race_id: 42,
          id_number: { $regex: '1234$' },
        }),
      );
    });
  });
});
