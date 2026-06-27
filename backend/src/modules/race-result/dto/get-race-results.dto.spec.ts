import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetRaceResultsDto } from './get-race-results.dto';

/**
 * F-092 — pageSize cap raised 100 → 500 to match admin `privateListLimit`.
 * These tests lock the validation boundary so a future edit can't silently
 * narrow the cap again (which made the public ranking list go blank when an
 * operator set privateListLimit between 101–500).
 */
describe('GetRaceResultsDto — F-092 pageSize boundary', () => {
  const validateDto = async (pageSizeRaw: unknown) => {
    // Query params arrive as strings; @Type(() => Number) transforms them.
    const dto = plainToInstance(GetRaceResultsDto, {
      raceId: '69de58ec491b72f9dc18ea81',
      pageSize: pageSizeRaw,
    });
    const errors = await validate(dto);
    return errors.find((e) => e.property === 'pageSize');
  };

  it('TC-03: pageSize=500 (exact cap) passes validation', async () => {
    expect(await validateDto('500')).toBeUndefined();
  });

  it('pageSize=100 (old cap) still passes — backward compatible', async () => {
    expect(await validateDto('100')).toBeUndefined();
  });

  it('TC-02: pageSize=501 (over cap) fails with max constraint', async () => {
    const err = await validateDto('501');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('max');
  });

  it('TC-02b: pageSize=1000 fails with max constraint', async () => {
    const err = await validateDto('1000');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('max');
  });

  it('TC-04: pageSize=0 fails with min constraint', async () => {
    const err = await validateDto('0');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('min');
  });

  it('TC-05: pageSize omitted → no error (defaults to 10)', async () => {
    const dto = plainToInstance(GetRaceResultsDto, {
      raceId: '69de58ec491b72f9dc18ea81',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'pageSize')).toBeUndefined();
    expect(dto.pageSize).toBe(10);
  });
});
