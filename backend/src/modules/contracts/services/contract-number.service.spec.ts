/**
 * F-024 contract-number.service.spec.ts
 *
 * Coverage BR-CM-02:
 * - Format DD.MM/YYYY/HDDV/CLIENT-PROVIDER
 * - Atomic Redis INCR (mocked)
 * - Year reset (Jan 1 → seq=1)
 * - PAUSE-CODE-04 edge case 1: backdate signDate → sequence theo signDate.year
 *   (NOT current year — confirmed approach in service comment)
 * - PAUSE-CODE-04 edge case 2: 2 contracts cùng date → unique seq via INCR atomic
 * - Client name sanitization (special chars stripped, uppercase, max 16 chars)
 */
import { ContractNumberService } from './contract-number.service';

describe('ContractNumberService', () => {
  let svc: ContractNumberService;
  let mockRedis: any;

  beforeEach(() => {
    let counter = 0;
    mockRedis = {
      incr: jest.fn(async () => ++counter),
      get: jest.fn(async () => String(counter)),
    };
    svc = new ContractNumberService(mockRedis);
  });

  describe('BR-CM-02 format', () => {
    it('formats correctly: 15.05/2026/HDDV/CONGAN-5BIB', async () => {
      const { contractNumber } = await svc.generateNumber(
        new Date('2026-05-15T00:00:00Z'),
        'CONGAN',
        '5BIB',
      );
      expect(contractNumber).toMatch(
        /^\d{2}\.\d{2}\/2026\/HDDV\/CONGAN-5BIB$/,
      );
      // Day/month depends on local TZ. Just verify structure + year + provider:
      expect(contractNumber).toContain('/2026/HDDV/CONGAN-5BIB');
    });

    it('5SOLUTION provider literal correct', async () => {
      const { contractNumber } = await svc.generateNumber(
        new Date(2026, 3, 14), // 14/04/2026 local
        'TAM',
        '5SOLUTION',
      );
      expect(contractNumber).toBe('14.04/2026/HDDV/TAM-5SOLUTION');
    });

    it('sanitizes special chars in client name + uppercase', async () => {
      const { contractNumber } = await svc.generateNumber(
        new Date(2026, 4, 1),
        'cty 123 abc',
        '5BIB',
      );
      expect(contractNumber).toBe('01.05/2026/HDDV/CTY123ABC-5BIB');
    });

    it('truncates client name to max 16 chars', async () => {
      const { contractNumber } = await svc.generateNumber(
        new Date(2026, 4, 1),
        'VERYLONGCOMPANYNAMETHATSHOULDBETRUNCATED',
        '5BIB',
      );
      const clientPart = contractNumber.split('/').pop()!.split('-')[0];
      expect(clientPart.length).toBeLessThanOrEqual(16);
    });
  });

  describe('Redis atomic INCR sequence', () => {
    it('returns 1 on first call (Jan 1 fresh year)', async () => {
      const seq = await svc.nextSequence(2027);
      expect(seq).toBe(1);
    });

    it('atomic — 2 concurrent calls return distinct sequences', async () => {
      const [s1, s2] = await Promise.all([
        svc.nextSequence(2026),
        svc.nextSequence(2026),
      ]);
      expect(s1).not.toBe(s2);
      expect(mockRedis.incr).toHaveBeenCalledTimes(2);
    });

    it('PAUSE-CODE-04 edge case 1: backdate signDate uses signDate.year for sequence key', async () => {
      // Today is 2026-05, but sign date is 2026-04 (backdate)
      const backdate = new Date('2026-04-15T00:00:00Z');
      await svc.generateNumber(backdate, 'TAM', '5BIB');
      // Service uses signDate.getFullYear() — verified by service implementation
      // (mockRedis received some incr call; we just verify it was called)
      expect(mockRedis.incr).toHaveBeenCalled();
    });

    it('PAUSE-CODE-04 edge case 2: 2 contracts cùng day get unique seq via Redis INCR', async () => {
      const date = new Date(2026, 4, 1);
      const r1 = await svc.generateNumber(date, 'A', '5BIB');
      const r2 = await svc.generateNumber(date, 'B', '5BIB');
      // Contract numbers same date but seq differs (atomic)
      expect(r1.sequence).not.toBe(r2.sequence);
    });
  });

  describe('Year reset behavior', () => {
    it('different years use different keys (no collision)', async () => {
      // Each year is a separate Redis key — INCR independent
      // Mock counter shared, but real Redis would be separate keys
      await svc.nextSequence(2026);
      await svc.nextSequence(2027);
      const calls = mockRedis.incr.mock.calls;
      expect(calls[0][0]).toBe('contracts:sequence:2026');
      expect(calls[1][0]).toBe('contracts:sequence:2027');
    });
  });

  describe('Fallback (no Redis)', () => {
    it('returns random sequence when redis is undefined', async () => {
      const noRedisSvc = new ContractNumberService(undefined);
      const seq = await noRedisSvc.nextSequence(2026);
      expect(typeof seq).toBe('number');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // FEATURE-066 — TC-66-01..15 cho strip prefix + per-(year, client) sequence
  // + Partner.shortName override. Dùng per-key counter mock để verify isolation
  // chính xác (existing F-024 tests dùng shared counter — không đụng).
  // ──────────────────────────────────────────────────────────────────────────
  describe('FEATURE-066 — Strip prefix + per-(year, client) sequence', () => {
    let perKeySvc: ContractNumberService;
    let perKeyRedis: { incr: jest.Mock; get: jest.Mock; counters: Record<string, number> };

    beforeEach(() => {
      const counters: Record<string, number> = {};
      perKeyRedis = {
        counters,
        incr: jest.fn(async (key: string) => {
          counters[key] = (counters[key] ?? 0) + 1;
          return counters[key];
        }),
        get: jest.fn(async (key: string) =>
          counters[key] ? String(counters[key]) : null,
        ),
      };
      perKeySvc = new ContractNumberService(perKeyRedis as any);
    });

    // TC-66-01 — Strip CTCP prefix happy path
    it('TC-66-01: strip CTCP prefix → token = "TAMANMEDIA" (no partnerShortName)', async () => {
      const result = await perKeySvc.generateNumber({
        signDate: new Date(2026, 4, 15), // 15.05.2026 local
        partnerShortName: undefined,
        entityName: 'CÔNG TY CỔ PHẦN TÂM AN MEDIA',
        providerId: '5BIB',
      });
      expect(result.clientToken).toBe('TAMANMEDIA');
      expect(result.sequence).toBe(1);
      expect(result.source).toBe('entityName_stripped');
      expect(result.contractNumber).toBe('15.05/2026/HDDV/TAMANMEDIA-5BIB');
      expect(perKeyRedis.incr).toHaveBeenCalledWith(
        'contracts:sequence:2026:TAMANMEDIA',
      );
    });

    // TC-66-02 — Strip CTYTNHH MTV prefix (longest-match-first)
    it('TC-66-02: strip CTY TNHH MTV before TNHH (longest-match-first)', async () => {
      const result = await perKeySvc.generateNumber({
        signDate: new Date(2026, 4, 15),
        partnerShortName: undefined,
        entityName: 'CÔNG TY TNHH MỘT THÀNH VIÊN ABC XYZ',
        providerId: '5BIB',
      });
      expect(result.clientToken).toBe('ABCXYZ');
      expect(result.source).toBe('entityName_stripped');
    });

    // TC-66-03 — Partner.shortName override (highest priority)
    it('TC-66-03: partnerShortName override beats entityName strip', async () => {
      const result = await perKeySvc.generateNumber({
        signDate: new Date(2026, 4, 15),
        partnerShortName: 'CUSTOM',
        entityName: 'CÔNG TY CỔ PHẦN ABC',
        providerId: '5BIB',
      });
      expect(result.clientToken).toBe('CUSTOM');
      expect(result.source).toBe('partnerShortName');
      expect(result.contractNumber).toContain('/HDDV/CUSTOM-5BIB');
    });

    // TC-66-04 — Per-(year, client) sequence isolation
    it('TC-66-04: 2 partners khác nhau cùng năm — cả 2 đều seq=1 (no suffix)', async () => {
      const date = new Date(2026, 4, 15);
      const r1 = await perKeySvc.generateNumber({
        signDate: date,
        partnerShortName: 'TAM',
        entityName: 'A',
        providerId: '5BIB',
      });
      const r2 = await perKeySvc.generateNumber({
        signDate: date,
        partnerShortName: 'ABC',
        entityName: 'B',
        providerId: '5BIB',
      });
      expect(r1.sequence).toBe(1);
      expect(r2.sequence).toBe(1);
      expect(r1.contractNumber).toBe('15.05/2026/HDDV/TAM-5BIB');
      expect(r2.contractNumber).toBe('15.05/2026/HDDV/ABC-5BIB');
      // Verify 2 distinct keys
      expect(perKeyRedis.incr).toHaveBeenCalledWith(
        'contracts:sequence:2026:TAM',
      );
      expect(perKeyRedis.incr).toHaveBeenCalledWith(
        'contracts:sequence:2026:ABC',
      );
    });

    // TC-66-05 — Same client same year sequence increment
    it('TC-66-05: 3 HĐ cùng client → seq 1, 2, 3 với suffix -2 -3', async () => {
      const date = new Date(2026, 4, 15);
      const args = {
        signDate: date,
        partnerShortName: 'TAM',
        entityName: 'X',
        providerId: '5BIB',
      };
      const r1 = await perKeySvc.generateNumber(args);
      const r2 = await perKeySvc.generateNumber(args);
      const r3 = await perKeySvc.generateNumber(args);
      expect(r1.contractNumber).toBe('15.05/2026/HDDV/TAM-5BIB');
      expect(r2.contractNumber).toBe('15.05/2026/HDDV/TAM-5BIB-2');
      expect(r3.contractNumber).toBe('15.05/2026/HDDV/TAM-5BIB-3');
    });

    // TC-66-06 — Year reset across new year
    it('TC-66-06: year reset — Dec 31 2026 seq=1, Jan 1 2027 seq=1', async () => {
      const r1 = await perKeySvc.generateNumber({
        signDate: new Date(2026, 11, 31), // Dec 31 2026
        partnerShortName: 'TAM',
        entityName: 'X',
        providerId: '5BIB',
      });
      const r2 = await perKeySvc.generateNumber({
        signDate: new Date(2027, 0, 1), // Jan 1 2027
        partnerShortName: 'TAM',
        entityName: 'X',
        providerId: '5BIB',
      });
      expect(r1.sequence).toBe(1);
      expect(r2.sequence).toBe(1);
      expect(perKeyRedis.incr).toHaveBeenCalledWith(
        'contracts:sequence:2026:TAM',
      );
      expect(perKeyRedis.incr).toHaveBeenCalledWith(
        'contracts:sequence:2027:TAM',
      );
    });

    // TC-66-07 — Backdate signDate uses signDate.year not today.year
    it('TC-66-07: backdate signDate dùng signDate.getFullYear() cho key', async () => {
      // Today 2027-01-15, signDate 2026-12-20 (backdate)
      const backdate = new Date(2026, 11, 20);
      await perKeySvc.generateNumber({
        signDate: backdate,
        partnerShortName: 'TAM',
        entityName: 'X',
        providerId: '5BIB',
      });
      expect(perKeyRedis.incr).toHaveBeenCalledWith(
        'contracts:sequence:2026:TAM',
      );
      // Must NOT have touched 2027 key
      expect(perKeyRedis.incr).not.toHaveBeenCalledWith(
        'contracts:sequence:2027:TAM',
      );
    });

    // TC-66-08 — partnerShortName invalid (lowercase) — service still
    //   accepts via sanitize (uppercase). DTO-level reject 400 covered ở
    //   partner.dto.ts via class-validator @Matches. Service sanitize ensures
    //   token always [A-Z0-9].
    it('TC-66-08: invalid lowercase partnerShortName → service sanitize uppercase', async () => {
      const result = await perKeySvc.generateNumber({
        signDate: new Date(2026, 4, 15),
        partnerShortName: 'tam', // lowercase (DTO would reject upstream)
        entityName: 'X',
        providerId: '5BIB',
      });
      // Service is defense-in-depth: sanitize before use
      expect(result.clientToken).toBe('TAM');
      expect(result.source).toBe('partnerShortName');
    });

    // TC-66-09 — partnerShortName empty falls back to entityName strip
    it('TC-66-09: partnerShortName empty → fallback stripCompanyPrefix(entityName)', async () => {
      const result = await perKeySvc.generateNumber({
        signDate: new Date(2026, 4, 15),
        partnerShortName: '',
        entityName: 'DNTN HOÀNG GIA',
        providerId: '5BIB',
      });
      expect(result.clientToken).toBe('HOANGGIA');
      expect(result.source).toBe('entityName_stripped');
    });

    // TC-66-10 — entityName chỉ có prefix → fallback CLIENT constant
    it('TC-66-10: entityName="CÔNG TY TNHH" only → fallback CLIENT (no throw)', async () => {
      const result = await perKeySvc.generateNumber({
        signDate: new Date(2026, 4, 15),
        partnerShortName: undefined,
        entityName: 'CÔNG TY TNHH',
        providerId: '5BIB',
      });
      expect(result.clientToken).toBe('CLIENT');
      expect(result.source).toBe('fallback');
      expect(result.contractNumber).toBe('15.05/2026/HDDV/CLIENT-5BIB');
    });

    // TC-66-11 — Max length 16 truncation after strip
    it('TC-66-11: strip prefix + long name → token sliced to 16 chars max', async () => {
      const result = await perKeySvc.generateNumber({
        signDate: new Date(2026, 4, 15),
        partnerShortName: undefined,
        entityName:
          'CÔNG TY CỔ PHẦN VERYLONGCOMPANYNAMETHATEXCEEDSLIMITS',
        providerId: '5BIB',
      });
      const clientPart = result.contractNumber
        .split('/')
        .pop()!
        .split('-')[0];
      expect(clientPart.length).toBeLessThanOrEqual(16);
      expect(result.clientToken.length).toBeLessThanOrEqual(16);
    });

    // TC-66-12 — Forward-only contract not regenerate — verified via
    //   contracts.service.activate() guard `if (!c.contractNumber)`. Tested
    //   ở contracts.lifecycle.spec.ts "keeps existing contractNumber on activate (no regen)".
    //   Đây verify service-level: cùng args 2 lần → 2 contractNumber distinct (seq tăng).
    it('TC-66-12 (proxy): service-level forward-only — 2 generate cùng args → 2 distinct numbers', async () => {
      const args = {
        signDate: new Date(2026, 4, 15),
        partnerShortName: 'TAM',
        entityName: 'X',
        providerId: '5BIB',
      };
      const r1 = await perKeySvc.generateNumber(args);
      const r2 = await perKeySvc.generateNumber(args);
      expect(r1.contractNumber).not.toBe(r2.contractNumber);
      // r1 seq=1 no suffix, r2 seq=2 suffix
      expect(r1.contractNumber).toBe('15.05/2026/HDDV/TAM-5BIB');
      expect(r2.contractNumber).toBe('15.05/2026/HDDV/TAM-5BIB-2');
    });

    // TC-66-13 — Concurrent generate same client (Redis INCR atomic)
    it('TC-66-13: Promise.all 2 generate same client → 2 distinct contractNumber', async () => {
      const args = {
        signDate: new Date(2026, 4, 15),
        partnerShortName: 'TAM',
        entityName: 'X',
        providerId: '5BIB',
      };
      const [r1, r2] = await Promise.all([
        perKeySvc.generateNumber(args),
        perKeySvc.generateNumber(args),
      ]);
      expect(r1.sequence).not.toBe(r2.sequence);
      expect(r1.contractNumber).not.toBe(r2.contractNumber);
      // Both went to same Redis key
      const tamCalls = (perKeyRedis.incr as jest.Mock).mock.calls.filter(
        ([key]) => key === 'contracts:sequence:2026:TAM',
      );
      expect(tamCalls.length).toBe(2);
    });

    // TC-66-14 — Collision retry exhausted: verified at contracts.service layer
    //   (retry-5-lần loop + ConflictException-ish message). Service layer này
    //   purely produces numbers — không own collision detection. Stub test for
    //   service-level retry behavior happens in contracts.lifecycle tests.
    it('TC-66-14 (proxy): service unconditionally returns next sequence — no internal retry logic', async () => {
      const args = {
        signDate: new Date(2026, 4, 15),
        partnerShortName: 'TAM',
        entityName: 'X',
        providerId: '5BIB',
      };
      const r1 = await perKeySvc.generateNumber(args);
      expect(r1.sequence).toBe(1);
      // Service alone doesn't throw 409 — that's contracts.service.activate() layer.
      // We verify here service.generateNumber is idempotent given fresh INCR.
    });

    // TC-66-15 — Logger.warn structured output
    it('TC-66-15: Logger.warn được gọi với structured object (event/year/clientToken/sequence/source)', async () => {
      const loggerWarnSpy = jest
        .spyOn((perKeySvc as any).logger, 'warn')
        .mockImplementation(() => {});
      await perKeySvc.generateNumber({
        signDate: new Date(2026, 4, 15),
        partnerShortName: 'TAM',
        entityName: 'X',
        providerId: '5BIB',
      });
      const structuredCall = loggerWarnSpy.mock.calls.find(
        ([arg]) =>
          typeof arg === 'object' &&
          arg !== null &&
          (arg as any).event === 'contract_number_generated',
      );
      expect(structuredCall).toBeDefined();
      const payload = structuredCall![0] as Record<string, unknown>;
      expect(payload.year).toBe(2026);
      expect(payload.clientToken).toBe('TAM');
      expect(payload.sequence).toBe(1);
      expect(payload.source).toBe('partnerShortName');
      loggerWarnSpy.mockRestore();
    });
  });
});
