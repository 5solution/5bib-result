/**
 * F-043 — MerchantService event-level fee override CRUD tests.
 *
 * TC-43-01: GET list happy path
 * TC-43-02: POST happy path (creates override + audit + cache flush)
 * TC-43-03: POST duplicate raceId → 409
 * TC-43-04: POST invalid raceId → 400 (RaceReadonly returns null)
 * TC-43-05: PUT happy path
 * TC-43-06: DELETE happy path (3 audit docs with new_value=null)
 * TC-43-13: Audit log per field on POST (3 docs: rate/manual/vat)
 * TC-43-14: Cache flush invoked
 * TC-43-15: Concurrent POST → 1 success 1 fail (409 dup) — verified via 2nd call after 1st
 * TC-43-16: Backward compat — existing config event_fee_overrides=undefined → lazy default []
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { Tenant } from './entities/tenant.entity';
import { MerchantConfig } from './schemas/merchant-config.schema';
import { MerchantFeeHistory } from './schemas/merchant-fee-history.schema';
import { RaceReadonly } from '../promo-hub/entities/race-readonly.entity';

describe('MerchantService — F-043 Event Fee Override CRUD', () => {
  let service: MerchantService;
  let tenantRepo: { findOne: jest.Mock };
  let raceRepo: { findOne: jest.Mock };
  let configModel: jest.Mock & {
    findOne: jest.Mock;
  };
  let feeHistoryModel: jest.Mock & {
    create: jest.Mock;
  };
  let redis: { del: jest.Mock };

  /**
   * Build mock MerchantConfig document với optional event_fee_overrides[].
   * Mongoose .save() + .markModified() stub.
   */
  function buildMockConfig(overrides: Array<Record<string, unknown>> = []) {
    return {
      tenantId: 123,
      service_fee_rate: 6,
      manual_fee_per_ticket: 5000,
      fee_vat_rate: 0,
      event_fee_overrides: overrides,
      save: jest.fn().mockResolvedValue(undefined),
      markModified: jest.fn(),
      toObject() {
        return { ...this };
      },
    };
  }

  beforeEach(async () => {
    tenantRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 123,
        name: 'CÔNG TY TNHH CÁT TIÊN ADVENTURE',
        deleted: false,
      }),
    };
    raceRepo = {
      findOne: jest.fn().mockResolvedValue({
        raceId: '12345',
        title: 'Cát Tiên Trail 2026',
      }),
    };

    // configModel works as both a constructor (`new this.configModel(...)`) AND
    // an object with `.findOne()`. Build hybrid via jest.fn() + attached method.
    const ConfigModelCtor = jest.fn().mockImplementation((init) => ({
      ...buildMockConfig([]),
      ...init,
    }));
    (ConfigModelCtor as unknown as { findOne: jest.Mock }).findOne = jest.fn();
    configModel = ConfigModelCtor as unknown as typeof configModel;

    feeHistoryModel = jest.fn() as unknown as typeof feeHistoryModel;
    feeHistoryModel.create = jest.fn().mockResolvedValue(undefined);

    redis = { del: jest.fn().mockResolvedValue(1) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantService,
        { provide: getRepositoryToken(Tenant, 'platform'), useValue: tenantRepo },
        { provide: getRepositoryToken(RaceReadonly, 'platform'), useValue: raceRepo },
        { provide: getModelToken(MerchantConfig.name), useValue: configModel },
        { provide: getModelToken(MerchantFeeHistory.name), useValue: feeHistoryModel },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    service = module.get<MerchantService>(MerchantService);
  });

  describe('TC-43-01: GET list happy path', () => {
    it('returns overrides sorted by effective_from DESC with raceName joined', async () => {
      const existingOverrides = [
        {
          raceId: 100,
          service_fee_rate: 5,
          manual_fee_per_ticket: null,
          fee_vat_rate: null,
          effective_from: '2026-01-01',
          note: 'Older',
          createdBy: 1,
        },
        {
          raceId: 200,
          service_fee_rate: 7,
          manual_fee_per_ticket: null,
          fee_vat_rate: null,
          effective_from: '2026-07-01',
          note: 'Newer',
          createdBy: 1,
        },
      ];
      configModel.findOne.mockReturnValueOnce({
        lean: () => Promise.resolve({
          tenantId: 123,
          event_fee_overrides: existingOverrides,
        }),
      });

      const result = await service.listEventFeeOverrides(123);

      expect(result).toHaveLength(2);
      // DESC sort: newer effective_from first
      expect(result[0].raceId).toBe(200);
      expect(result[1].raceId).toBe(100);
      // raceName joined from RaceReadonly
      expect(result[0].raceName).toBe('Cát Tiên Trail 2026');
    });

    it('returns empty array khi config not exists', async () => {
      configModel.findOne.mockReturnValueOnce({
        lean: () => Promise.resolve(null),
      });
      const result = await service.listEventFeeOverrides(123);
      expect(result).toEqual([]);
    });

    it('throws 404 khi tenant not found', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.listEventFeeOverrides(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('TC-43-02: POST happy path', () => {
    it('creates override + emits 3 audit history docs + flushes cache', async () => {
      configModel.findOne.mockResolvedValueOnce(buildMockConfig([]));

      const dto = {
        raceId: 12345,
        service_fee_rate: 7,
        manual_fee_per_ticket: 4500,
        fee_vat_rate: 8,
        effective_from: '2026-07-01',
        note: 'Promo Q3',
      };

      const result = await service.createEventFeeOverride(123, dto, 99);

      expect(result.raceId).toBe(12345);
      expect(result.service_fee_rate).toBe(7);
      expect(result.raceName).toBe('Cát Tiên Trail 2026');

      // 3 audit docs (per field — rate/manual/vat)
      expect(feeHistoryModel.create).toHaveBeenCalledTimes(3);
      const calls = feeHistoryModel.create.mock.calls;
      const fields = calls.map((c) => c[0].fee_field);
      expect(fields).toEqual(
        expect.arrayContaining([
          'event_override.12345.service_fee_rate',
          'event_override.12345.manual_fee_per_ticket',
          'event_override.12345.fee_vat_rate',
        ]),
      );

      // Cache flush invoked
      expect(redis.del).toHaveBeenCalled();
    });

    it('skips audit cho field null (chỉ log changed fields)', async () => {
      configModel.findOne.mockResolvedValueOnce(buildMockConfig([]));

      const dto = {
        raceId: 12345,
        service_fee_rate: 7,
        // manual_fee_per_ticket + fee_vat_rate NOT provided
        effective_from: '2026-07-01',
      };

      await service.createEventFeeOverride(123, dto, 99);

      // Only service_fee_rate field gets audit (other 2 null → null skipped)
      const calls = feeHistoryModel.create.mock.calls;
      const fields = calls.map((c) => c[0].fee_field);
      expect(fields).toContain('event_override.12345.service_fee_rate');
      // manual + vat = null → null → skipped (oldVal===newVal===null)
      expect(fields).not.toContain('event_override.12345.manual_fee_per_ticket');
      expect(fields).not.toContain('event_override.12345.fee_vat_rate');
    });
  });

  describe('TC-43-03: POST duplicate raceId → 409', () => {
    it('throws ConflictException khi (tenantId, raceId) already exists', async () => {
      configModel.findOne.mockResolvedValueOnce(
        buildMockConfig([
          {
            raceId: 12345,
            service_fee_rate: 5,
            effective_from: '2026-01-01',
          },
        ]),
      );

      const dto = {
        raceId: 12345,
        service_fee_rate: 7,
        effective_from: '2026-07-01',
      };

      await expect(
        service.createEventFeeOverride(123, dto, 99),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('TC-43-04: POST invalid raceId → 400', () => {
    it('throws BadRequest khi RaceReadonly returns null', async () => {
      raceRepo.findOne.mockResolvedValueOnce(null);

      const dto = {
        raceId: 99999999,
        service_fee_rate: 7,
        effective_from: '2026-07-01',
      };

      await expect(
        service.createEventFeeOverride(123, dto, 99),
      ).rejects.toThrow(BadRequestException);

      // KHÔNG mutate MerchantConfig + KHÔNG insert history (validation fail trước CRUD)
      expect(feeHistoryModel.create).not.toHaveBeenCalled();
    });
  });

  describe('TC-43-05: PUT happy path', () => {
    it('updates existing override + audits only changed fields', async () => {
      const config = buildMockConfig([
        {
          raceId: 12345,
          service_fee_rate: 5,
          manual_fee_per_ticket: 5000,
          fee_vat_rate: 0,
          effective_from: '2026-07-01',
          note: 'Q3',
        },
      ]);
      configModel.findOne.mockResolvedValueOnce(config);

      const dto = { service_fee_rate: 8 }; // only rate change

      await service.updateEventFeeOverride(123, 12345, dto, 99);

      // 1 audit doc (only service_fee_rate changed)
      const calls = feeHistoryModel.create.mock.calls;
      const fields = calls.map((c) => c[0].fee_field);
      expect(fields).toEqual(['event_override.12345.service_fee_rate']);
      expect(calls[0][0].old_value).toBe('5');
      expect(calls[0][0].new_value).toBe('8');
      expect(config.markModified).toHaveBeenCalledWith('event_fee_overrides');
    });

    it('throws 404 khi override not exists', async () => {
      configModel.findOne.mockResolvedValueOnce(buildMockConfig([]));
      await expect(
        service.updateEventFeeOverride(123, 99999, { service_fee_rate: 5 }, 99),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('TC-43-06: DELETE happy path', () => {
    it('removes override + emits 3 audit docs with new_value=null', async () => {
      const config = buildMockConfig([
        {
          raceId: 12345,
          service_fee_rate: 5,
          manual_fee_per_ticket: 4500,
          fee_vat_rate: 8,
          effective_from: '2026-07-01',
        },
      ]);
      configModel.findOne.mockResolvedValueOnce(config);

      const result = await service.deleteEventFeeOverride(123, 12345, 99);

      expect(result).toEqual({ success: true, deletedRaceId: 12345 });
      // event_fee_overrides empty after filter
      expect(config.event_fee_overrides).toHaveLength(0);

      // 3 audit docs (rate + manual + vat) — all with new_value=null
      const calls = feeHistoryModel.create.mock.calls;
      expect(calls).toHaveLength(3);
      for (const c of calls) {
        expect(c[0].new_value).toBeNull();
        expect(c[0].fee_field).toMatch(/^event_override\.12345\./);
      }
    });
  });

  describe('TC-43-14: Cache flush invoked on mutations', () => {
    it('POST + PUT + DELETE all invoke redis.del("merchant:fee-overrides:<tenantId>")', async () => {
      // POST
      configModel.findOne.mockResolvedValueOnce(buildMockConfig([]));
      await service.createEventFeeOverride(
        123,
        { raceId: 12345, service_fee_rate: 7, effective_from: '2026-07-01' },
        99,
      );
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('merchant:fee-overrides:123'),
      );

      redis.del.mockClear();

      // PUT
      configModel.findOne.mockResolvedValueOnce(
        buildMockConfig([
          {
            raceId: 12345,
            service_fee_rate: 7,
            effective_from: '2026-07-01',
          },
        ]),
      );
      await service.updateEventFeeOverride(123, 12345, { service_fee_rate: 8 }, 99);
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('merchant:fee-overrides:123'),
      );

      redis.del.mockClear();

      // DELETE
      configModel.findOne.mockResolvedValueOnce(
        buildMockConfig([
          {
            raceId: 12345,
            service_fee_rate: 7,
            effective_from: '2026-07-01',
          },
        ]),
      );
      await service.deleteEventFeeOverride(123, 12345, 99);
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('merchant:fee-overrides:123'),
      );
    });
  });

  describe('TC-43-15: Sequential POST same raceId → 409 (concurrent semantic)', () => {
    it('second POST same raceId rejected with 409', async () => {
      // First POST creates override
      configModel.findOne.mockResolvedValueOnce(buildMockConfig([]));
      await service.createEventFeeOverride(
        123,
        { raceId: 12345, service_fee_rate: 7, effective_from: '2026-07-01' },
        99,
      );

      // Second POST — config now has override → 409
      configModel.findOne.mockResolvedValueOnce(
        buildMockConfig([
          {
            raceId: 12345,
            service_fee_rate: 7,
            effective_from: '2026-07-01',
          },
        ]),
      );
      await expect(
        service.createEventFeeOverride(
          123,
          { raceId: 12345, service_fee_rate: 5, effective_from: '2026-08-01' },
          99,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('TC-43-16: Backward compat — existing config without event_fee_overrides', () => {
    it('legacy config (no event_fee_overrides) treated as empty array', async () => {
      // Simulate config doc loaded from MongoDB without the new field (lazy default)
      const legacyConfig = {
        tenantId: 123,
        service_fee_rate: 6,
        // event_fee_overrides intentionally undefined (legacy doc pre-F-043)
      };
      configModel.findOne.mockReturnValueOnce({
        lean: () => Promise.resolve(legacyConfig),
      });

      const result = await service.listEventFeeOverrides(123);
      expect(result).toEqual([]);
    });
  });
});
