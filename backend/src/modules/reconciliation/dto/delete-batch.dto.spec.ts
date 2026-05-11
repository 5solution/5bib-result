/**
 * FEATURE-025 QC artifact — DTO validation tests.
 *
 * Verify class-validator decorators trên DeleteBatchDto block invalid payloads
 * TRƯỚC khi tới service layer. Đảm bảo:
 * - Empty array → ArrayMinSize violation
 * - 51 IDs → ArrayMaxSize violation
 * - Invalid hex string → IsMongoId violation
 * - Wrong types (not array, not strings) → graceful reject
 *
 * Test programmatically với class-validator `validate()` thay vì TestingModule
 * — đơn giản hơn, không cần spin up Nest app.
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeleteBatchDto } from './delete-batch.dto';

describe('DeleteBatchDto — FEATURE-025 validation (QC)', () => {
  async function validatePayload(payload: unknown) {
    const dto = plainToInstance(DeleteBatchDto, payload);
    return validate(dto);
  }

  it('TC-DT-01: empty array fails ArrayMinSize', async () => {
    const errors = await validatePayload({ ids: [] });
    expect(errors.length).toBeGreaterThan(0);
    const constraintKeys = errors.flatMap((e) =>
      Object.keys(e.constraints ?? {}),
    );
    expect(constraintKeys).toContain('arrayMinSize');
  });

  it('TC-DT-02: 51 IDs fails ArrayMaxSize', async () => {
    const ids = Array.from(
      { length: 51 },
      (_, i) => `${i.toString().padStart(24, '0')}`,
    );
    const errors = await validatePayload({ ids });
    expect(errors.length).toBeGreaterThan(0);
    const constraintKeys = errors.flatMap((e) =>
      Object.keys(e.constraints ?? {}),
    );
    expect(constraintKeys).toContain('arrayMaxSize');
  });

  it('TC-DT-03: invalid hex string fails IsMongoId', async () => {
    const errors = await validatePayload({
      ids: ['69f9488ab13b71f5c5f970ec', 'not-a-mongoid', 'invalid'],
    });
    expect(errors.length).toBeGreaterThan(0);
    // class-validator nested constraint key for each: violation
    const nestedConstraints = JSON.stringify(errors);
    expect(nestedConstraints).toContain('isMongoId');
  });

  it('TC-DT-04: 50 valid IDs passes (boundary upper)', async () => {
    const ids = Array.from(
      { length: 50 },
      (_, i) =>
        `${i.toString(16).padStart(2, '0')}${'0'.repeat(22)}`.slice(0, 24),
    );
    const errors = await validatePayload({ ids });
    expect(errors).toHaveLength(0);
  });

  it('TC-DT-05: 1 valid ID passes (boundary lower)', async () => {
    const errors = await validatePayload({
      ids: ['69f9488ab13b71f5c5f970ec'],
    });
    expect(errors).toHaveLength(0);
  });

  it('TC-DT-06: ids field missing fails IsArray', async () => {
    const errors = await validatePayload({});
    expect(errors.length).toBeGreaterThan(0);
    const constraintKeys = errors.flatMap((e) =>
      Object.keys(e.constraints ?? {}),
    );
    expect(constraintKeys).toContain('isArray');
  });

  it('TC-DT-07: ids field as object (not array) fails IsArray', async () => {
    const errors = await validatePayload({ ids: { '0': 'foo' } });
    expect(errors.length).toBeGreaterThan(0);
    const constraintKeys = errors.flatMap((e) =>
      Object.keys(e.constraints ?? {}),
    );
    expect(constraintKeys).toContain('isArray');
  });

  it('TC-DT-08: ids field as string (not array) fails IsArray', async () => {
    const errors = await validatePayload({ ids: 'just-a-string' });
    expect(errors.length).toBeGreaterThan(0);
    const constraintKeys = errors.flatMap((e) =>
      Object.keys(e.constraints ?? {}),
    );
    expect(constraintKeys).toContain('isArray');
  });

  it('TC-DT-09: 24-char non-hex string fails IsMongoId', async () => {
    const errors = await validatePayload({
      ids: ['gggggggggggggggggggggggg'], // 24 chars, all non-hex
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('isMongoId');
  });
});
