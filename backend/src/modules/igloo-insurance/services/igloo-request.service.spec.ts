import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { IglooRequestService } from './igloo-request.service';
import { IglooSelectionService } from './igloo-selection.service';
import { IglooInsuranceRequest } from '../schemas/igloo-insurance-request.schema';
import { LegacyAthleteRow } from '../utils/igloo-helpers';

function row(overrides: Partial<LegacyAthleteRow> = {}): LegacyAthleteRow {
  return {
    athletes_id: 101,
    name: 'Nguyễn Văn A',
    bib_number: '1234',
    email: 'a@example.com',
    dob: '1992-06-27',
    created_on: '2026-06-15',
    gender: 'MALE',
    contact_phone: '0901234567',
    id_number: '092124584349',
    race_id: 220,
    race_title: 'LÀO CAI MARATHON 2026',
    event_start_date: '2026-07-10',
    event_end_date: '2026-07-12',
    race_type: 'TRAIL_RACE',
    location: 'Nguyễn Du',
    province: 'TP. HCM',
    district: 'Thủ Đức',
    course_distance: '21KM',
    ...overrides,
  };
}

/** Mongoose query chain mock. */
function q(result: unknown) {
  const o: Record<string, unknown> = {};
  ['select', 'sort', 'skip', 'limit', 'lean'].forEach((m) => {
    o[m] = jest.fn(() => o);
  });
  o.exec = jest.fn().mockResolvedValue(result);
  return o;
}

describe('IglooRequestService', () => {
  let service: IglooRequestService;
  let model: {
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    countDocuments: jest.Mock;
    create: jest.Mock;
    exists: jest.Mock;
  };
  let selection: {
    findRow: jest.Mock;
    findNewTodayCandidates: jest.Mock;
    findPoolCandidates: jest.Mock;
    findEligibleForRace: jest.Mock;
    listUpcomingRaces: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      find: jest.fn(() => q([])),
      findById: jest.fn(() => q(null)),
      findByIdAndUpdate: jest.fn(() => q(null)),
      countDocuments: jest.fn(() => q(0)),
      create: jest.fn().mockResolvedValue({}),
      exists: jest.fn().mockResolvedValue(null),
    };
    selection = {
      findRow: jest.fn(),
      findNewTodayCandidates: jest.fn(),
      findPoolCandidates: jest.fn(),
      findEligibleForRace: jest.fn(),
      listUpcomingRaces: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        IglooRequestService,
        { provide: getModelToken(IglooInsuranceRequest.name), useValue: model },
        { provide: IglooSelectionService, useValue: selection },
      ],
    }).compile();
    service = moduleRef.get(IglooRequestService);
  });

  describe('getConfig — kill-switch flags', () => {
    it('reflects env defaults (both disabled in dev)', () => {
      const cfg = service.getConfig();
      expect(cfg.dailyEnabled).toBe(false);
      expect(cfg.submitEnabled).toBe(false);
      expect(cfg.dailyCount).toBe(10);
    });
  });

  describe('TC-10 createBatch — idempotency skip', () => {
    it('skips athlete already having an active order, does NOT create', async () => {
      model.find.mockReturnValue(q([{ partnerRefId: 'igloo:101:220' }]));
      const res = await service.createBatch(220, [101], 'admin-1');
      expect(res.created).toBe(0);
      expect(res.skipped).toEqual([
        { athletesId: 101, reason: 'ALREADY_HAS_ORDER' },
      ]);
      expect(model.create).not.toHaveBeenCalled();
      expect(selection.findRow).not.toHaveBeenCalled();
    });

    it('creates QUEUED row for eligible new athlete (premium 10k)', async () => {
      model.find.mockReturnValue(q([])); // no existing
      selection.findRow.mockResolvedValue(row());
      const res = await service.createBatch(220, [101], 'admin-1');
      expect(res.created).toBe(1);
      expect(res.totalPremium).toBe(10000);
      expect(model.create).toHaveBeenCalledTimes(1);
      const arg = model.create.mock.calls[0][0];
      expect(arg.partnerRefId).toBe('igloo:101:220');
      expect(arg.status).toBe('QUEUED');
      expect(arg.totalPayment).toBe(10000);
      expect(arg.packageCode).toBe('ROAD');
      expect(arg.insuredIdCard).toBe('092124584349'); // full, no mask
    });

    it('skips NOT_ELIGIBLE when selection finds no eligible row', async () => {
      model.find.mockReturnValue(q([]));
      selection.findRow.mockResolvedValue(null);
      const res = await service.createBatch(220, [999], 'admin-1');
      expect(res.created).toBe(0);
      expect(res.skipped).toEqual([
        { athletesId: 999, reason: 'NOT_ELIGIBLE' },
      ]);
    });
  });

  describe('TC-11 selectAndQueueDaily — top-up from pool', () => {
    it('queues today-candidates first then tops up to count', async () => {
      const today = [
        row({ athletes_id: 1, race_id: 220 }),
        row({ athletes_id: 2, race_id: 220 }),
        row({ athletes_id: 3, race_id: 220 }),
      ];
      const pool = Array.from({ length: 10 }, (_, i) =>
        row({ athletes_id: 100 + i, race_id: 221 }),
      );
      selection.findNewTodayCandidates.mockResolvedValue(today);
      selection.findPoolCandidates.mockResolvedValue(pool);

      const queued = await service.selectAndQueueDaily(7);

      expect(queued).toBe(7);
      expect(model.create).toHaveBeenCalledTimes(7); // 3 today + 4 pool
      expect(selection.findPoolCandidates).toHaveBeenCalled();
    });

    it('does not exceed count even with large pool', async () => {
      selection.findNewTodayCandidates.mockResolvedValue([]);
      selection.findPoolCandidates.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => row({ athletes_id: 500 + i })),
      );
      const queued = await service.selectAndQueueDaily(10);
      expect(queued).toBe(10);
      expect(model.create).toHaveBeenCalledTimes(10);
    });
  });

  describe('TC-14 retry guard', () => {
    function doc(over: Record<string, unknown>) {
      const base = {
        _id: 'abc',
        status: 'FAILED',
        retryCount: 0,
        iglooRequestId: null,
        errorMessage: 'boom',
        packageCode: 'ROAD',
        insuredName: 'A',
        insuredIdCard: '092124584349',
        bib: '1',
        raceTitle: 'R',
        mysqlRaceId: 220,
        totalPayment: 10000,
        source: 'cron',
        gicContractNo: null,
        certificateUrl: null,
        createdAt: new Date(),
        ...over,
      };
      return {
        ...base,
        save: jest.fn().mockResolvedValue(undefined),
        toObject() {
          return { ...this };
        },
      };
    }

    it('throws when status is not FAILED', async () => {
      model.findById.mockReturnValue(q(doc({ status: 'SUCCESS' })));
      await expect(service.retry('abc')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when retryCount reached max (3)', async () => {
      model.findById.mockReturnValue(q(doc({ retryCount: 3 })));
      await expect(service.retry('abc')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('resets FAILED → QUEUED and increments retryCount', async () => {
      const d = doc({ status: 'FAILED', retryCount: 1, iglooRequestId: null });
      model.findById.mockReturnValue(q(d));
      const out = await service.retry('abc');
      expect(d.status).toBe('QUEUED');
      expect(d.retryCount).toBe(2);
      expect(d.save).toHaveBeenCalled();
      expect(out.id).toBe('abc');
    });

    it('re-polls (PENDING) instead of re-queue when iglooRequestId exists', async () => {
      const d = doc({
        status: 'FAILED',
        retryCount: 0,
        iglooRequestId: 'IGL-123',
      });
      model.findById.mockReturnValue(q(d));
      await service.retry('abc');
      expect(d.status).toBe('PENDING');
    });
  });
});
