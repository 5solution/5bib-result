/**
 * F-017 backend unit test — verify the MongoDB-only chip-lookup orchestrator.
 *
 * Tests target lookupByChip in isolation. We mock:
 *   - ChipConfigService.findByMongoId
 *   - ChipMappingService.findByChipId
 *   - getAthleteDetail (RaceResultService private path stubbed via spy)
 *
 * Verifies:
 *   - chipId UPPER+TRIM normalization (BR-01)
 *   - race-not-mapped errorCode when chip_race_configs missing
 *   - chip-not-found errorCode when chip_mappings missing
 *   - chip-disabled errorCode when status === 'DISABLED'
 *   - athlete-not-found when race_results missing
 *   - happy path returns bib + public-safe data (strips _id/editHistory/isManuallyEdited)
 */

describe('RaceResultService.lookupByChip (F-017)', () => {
  // Build a service-shaped instance with only the deps the method touches.
  function makeService(opts: {
    cfgFn: (mongoRaceId: string) => Promise<any>;
    mappingFn: (mysqlRaceId: number, chipId: string) => Promise<any>;
    detailFn: (mongoRaceId: string, bib: string) => Promise<any>;
  }) {
    const stub: any = {
      logger: { warn: () => {}, log: () => {} },
      chipConfigService: { findByMongoId: opts.cfgFn },
      chipMappingService: { findByChipId: opts.mappingFn },
      getAthleteDetail: opts.detailFn,
    };
    // Borrow the real method off the prototype.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RaceResultService } = require('../services/race-result.service');
    stub.lookupByChip = RaceResultService.prototype.lookupByChip.bind(stub);
    return stub;
  }

  it('returns bad-request when inputs missing', async () => {
    const svc = makeService({
      cfgFn: async () => null,
      mappingFn: async () => null,
      detailFn: async () => null,
    });
    const r1 = await svc.lookupByChip('', 'AAA');
    expect(r1.success).toBe(false);
    expect(r1.errorCode).toBe('bad-request');
    const r2 = await svc.lookupByChip('race_abc', '');
    expect(r2.success).toBe(false);
  });

  it('normalizes chipId to upper-case trimmed before lookup (BR-01)', async () => {
    let observedChip = '';
    const svc = makeService({
      cfgFn: async () => ({ mysql_race_id: 42 }),
      mappingFn: async (_mysqlRaceId: number, chipId: string) => {
        observedChip = chipId;
        return null;
      },
      detailFn: async () => null,
    });
    await svc.lookupByChip('race_abc12345', '  e20034125678  ');
    expect(observedChip).toBe('E20034125678');
  });

  it('returns race-not-mapped when chip_race_configs missing', async () => {
    const svc = makeService({
      cfgFn: async () => null,
      mappingFn: async () => null,
      detailFn: async () => null,
    });
    const r = await svc.lookupByChip('race_unmapped1', 'CHIP1');
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('race-not-mapped');
    expect(r.bib).toBeNull();
  });

  it('returns chip-not-found when chip_mappings missing', async () => {
    const svc = makeService({
      cfgFn: async () => ({ mysql_race_id: 99 }),
      mappingFn: async () => null,
      detailFn: async () => null,
    });
    const r = await svc.lookupByChip('race_okmap1', 'GHOSTCHIP');
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('chip-not-found');
  });

  it('returns chip-disabled when mapping.status === DISABLED', async () => {
    const svc = makeService({
      cfgFn: async () => ({ mysql_race_id: 5 }),
      mappingFn: async () => ({ status: 'DISABLED', bib_number: '101' }),
      detailFn: async () => null,
    });
    const r = await svc.lookupByChip('race_dis1', 'BADCHIP');
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('chip-disabled');
    expect(r.bib).toBe('101');
  });

  it('returns athlete-not-found when race_results missing', async () => {
    const svc = makeService({
      cfgFn: async () => ({ mysql_race_id: 5 }),
      mappingFn: async () => ({ status: 'ACTIVE', bib_number: '202' }),
      detailFn: async () => null,
    });
    const r = await svc.lookupByChip('race_norr1', 'CHIP202');
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('athlete-not-found');
    expect(r.bib).toBe('202');
  });

  it('happy path returns bib + scrubbed public data', async () => {
    const svc = makeService({
      cfgFn: async () => ({ mysql_race_id: 5 }),
      mappingFn: async () => ({ status: 'ACTIVE', bib_number: '303' }),
      detailFn: async () => ({
        bib: '303',
        name: 'Nguyen Van A',
        chipTime: '01:23:45',
        _id: 'mongo_id_to_strip',
        editHistory: [{ at: 'never' }],
        isManuallyEdited: true,
      }),
    });
    const r = await svc.lookupByChip('race_happy1', 'CHIP303');
    expect(r.success).toBe(true);
    expect(r.bib).toBe('303');
    expect((r.data as any)._id).toBeUndefined();
    expect((r.data as any).editHistory).toBeUndefined();
    expect((r.data as any).isManuallyEdited).toBeUndefined();
    expect((r.data as any).bib).toBe('303');
    expect((r.data as any).name).toBe('Nguyen Van A');
  });
});
