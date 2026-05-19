/**
 * F-043 — fee.service cascade 4-tier verification (TC-43-08..12).
 *
 * Pattern: instantiate FeeService directly with mock deps (per F-040 spec pattern).
 * Access private computeSelfFee via cast.
 */
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));
process.env.AWS_REGION = process.env.AWS_REGION ?? 'ap-southeast-1';
process.env.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET ?? 'test';

import { FeeService } from './fee.service';

/**
 * Mock OrderReadonly repo — computeSelfFee uses `this.orderRepo.manager.query(sql, params)`
 * Returns empty result set (test only verifies feeRate cascade logic, not SQL execution).
 */
function buildOrderRepo() {
  const emptyRow = {
    gross_5bib: '0',
    count_5bib: '0',
    count_manual: '0',
    manual_ticket_count: '0',
    gross_gmv_all: '0',
  };
  return {
    manager: {
      query: jest.fn().mockResolvedValue([emptyRow]),
    },
  };
}

/**
 * Mock MerchantConfigModel — returns config object via lean().exec() chain.
 */
function buildConfigModel(config: Record<string, unknown> | null) {
  return {
    findOne: jest.fn().mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve(config),
      }),
    }),
  };
}

/**
 * Wrapper to call private computeSelfFee with explicit period.
 */
async function callComputeSelfFee(
  svc: FeeService,
  raceId: number,
  tenantId: number,
  contract: { _id: string; revenueShare?: { feePercentage?: number } },
  periodFrom?: string,
) {
  return (svc as unknown as {
    computeSelfFee: (
      r: number,
      t: number,
      c: unknown,
      p?: { periodFrom: string; periodTo: string },
    ) => Promise<{
      feeRatePercent: number;
      manualFeePerTicket: number;
      feeSource?: string;
    }>;
  }).computeSelfFee(
    raceId,
    tenantId,
    contract,
    periodFrom ? { periodFrom, periodTo: periodFrom } : undefined,
  );
}

describe('FeeService — F-043 cascade 4-tier', () => {
  describe('TC-43-08: Tier 0 — Event override applied', () => {
    it('uses override service_fee_rate when raceId match AND effective_from <= periodFrom', async () => {
      const orderRepo = buildOrderRepo();
      const configModel = buildConfigModel({
        tenantId: 123,
        service_fee_rate: 6,
        event_fee_overrides: [
          {
            raceId: 12345,
            service_fee_rate: 7,
            effective_from: '2026-07-01',
          },
        ],
      });
      const svc = new FeeService(
        orderRepo as never,
        undefined,
        undefined,
        configModel as never,
      );

      const result = await callComputeSelfFee(
        svc,
        12345,
        123,
        { _id: 'c1', revenueShare: { feePercentage: 8 } },
        '2026-07-15',
      );

      expect(result.feeRatePercent).toBe(7);
      expect(result.feeSource).toBe('event_override');
    });
  });

  describe('TC-43-09: Tier 0 SKIPPED — effective_from > periodFrom', () => {
    it('falls back to Tier 1 merchant default when override not yet effective', async () => {
      const orderRepo = buildOrderRepo();
      const configModel = buildConfigModel({
        tenantId: 123,
        service_fee_rate: 6,
        event_fee_overrides: [
          {
            raceId: 12345,
            service_fee_rate: 7,
            effective_from: '2026-07-01',
          },
        ],
      });
      const svc = new FeeService(
        orderRepo as never,
        undefined,
        undefined,
        configModel as never,
      );

      const result = await callComputeSelfFee(
        svc,
        12345,
        123,
        { _id: 'c1', revenueShare: { feePercentage: 8 } },
        '2026-06-15', // periodFrom < effective_from
      );

      expect(result.feeRatePercent).toBe(6);
      expect(result.feeSource).toBe('merchant_default');
    });
  });

  describe('TC-43-10: Tier 1 — Merchant default (no override match)', () => {
    it('uses config.service_fee_rate when no matching override raceId', async () => {
      const orderRepo = buildOrderRepo();
      const configModel = buildConfigModel({
        tenantId: 123,
        service_fee_rate: 6,
        event_fee_overrides: [
          {
            raceId: 99999, // different
            service_fee_rate: 7,
            effective_from: '2026-01-01',
          },
        ],
      });
      const svc = new FeeService(
        orderRepo as never,
        undefined,
        undefined,
        configModel as never,
      );

      const result = await callComputeSelfFee(
        svc,
        12345,
        123,
        { _id: 'c1', revenueShare: { feePercentage: 8 } },
        '2026-07-15',
      );

      expect(result.feeRatePercent).toBe(6);
      expect(result.feeSource).toBe('merchant_default');
    });
  });

  describe('TC-43-11: Tier 2 — Contract revenueShare fallback', () => {
    it('uses contract.revenueShare.feePercentage when no override + no merchant default', async () => {
      const orderRepo = buildOrderRepo();
      const configModel = buildConfigModel({
        tenantId: 123,
        service_fee_rate: null,
        event_fee_overrides: [],
      });
      const svc = new FeeService(
        orderRepo as never,
        undefined,
        undefined,
        configModel as never,
      );

      const result = await callComputeSelfFee(
        svc,
        12345,
        123,
        { _id: 'c1', revenueShare: { feePercentage: 8 } },
        '2026-07-15',
      );

      expect(result.feeRatePercent).toBe(8);
      expect(result.feeSource).toBe('contract_fallback');
    });
  });

  describe('TC-43-12: Tier 3 — Platform default 5.5%', () => {
    it('falls back to hardcoded 5.5% when all 3 upper tiers null', async () => {
      const orderRepo = buildOrderRepo();
      const configModel = buildConfigModel({
        tenantId: 123,
        service_fee_rate: null,
        event_fee_overrides: [],
      });
      const svc = new FeeService(
        orderRepo as never,
        undefined,
        undefined,
        configModel as never,
      );

      const result = await callComputeSelfFee(svc, 12345, 123, { _id: 'c1' }, '2026-07-15');

      expect(result.feeRatePercent).toBe(5.5);
      expect(result.feeSource).toBe('platform_default');
    });
  });

  describe('Bonus: manual_fee_per_ticket independent cascade', () => {
    it('uses override manual when override.manual_fee_per_ticket non-null', async () => {
      const orderRepo = buildOrderRepo();
      const configModel = buildConfigModel({
        tenantId: 123,
        service_fee_rate: 6,
        manual_fee_per_ticket: 5000,
        event_fee_overrides: [
          {
            raceId: 12345,
            service_fee_rate: null, // service rate → merchant default
            manual_fee_per_ticket: 3000, // override manual
            effective_from: '2026-07-01',
          },
        ],
      });
      const svc = new FeeService(
        orderRepo as never,
        undefined,
        undefined,
        configModel as never,
      );

      const result = await callComputeSelfFee(svc, 12345, 123, { _id: 'c1' }, '2026-07-15');

      expect(result.feeRatePercent).toBe(6);
      expect(result.feeSource).toBe('merchant_default');
      expect(result.manualFeePerTicket).toBe(3000);
    });
  });

  describe('Bonus: Backward compat — legacy config without event_fee_overrides', () => {
    it('treats undefined event_fee_overrides as no override → Tier 1', async () => {
      const orderRepo = buildOrderRepo();
      const configModel = buildConfigModel({
        tenantId: 123,
        service_fee_rate: 6,
        // event_fee_overrides undefined
      });
      const svc = new FeeService(
        orderRepo as never,
        undefined,
        undefined,
        configModel as never,
      );

      const result = await callComputeSelfFee(svc, 12345, 123, { _id: 'c1' }, '2026-07-15');

      expect(result.feeRatePercent).toBe(6);
      expect(result.feeSource).toBe('merchant_default');
    });
  });
});
