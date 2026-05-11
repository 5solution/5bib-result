/**
 * F-024 UX-39 v3 — ContractTemplateService new methods spec.
 *
 * Coverage:
 *   Task 1: preview-html — file not-found error path
 *   Task 2: upload validation — empty buffer + oversized + invalid MIME logic
 *           (file-system mutation tested in lifecycle spec, here is pure unit)
 *   Task 3: line items — sanitize + getDefault returns empty
 *
 * Mocks: Model + Redis are no-op stubs. fs is real for backup directory check.
 */
import { ContractTemplateService } from './contract-template.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const noopRedis: any = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};

function mockModel(doc: any = null): any {
  return {
    findOne: jest.fn().mockReturnValue({
      lean: () => Promise.resolve(doc),
    }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      lean: () => Promise.resolve(doc),
    }),
    find: jest.fn().mockReturnValue({
      lean: () => Promise.resolve([]),
    }),
    deleteOne: jest.fn().mockResolvedValue({ acknowledged: true }),
  };
}

describe('ContractTemplateService — UX-39 v3 new methods', () => {
  describe('Task 2: uploadTemplate validation (pure, no fs write)', () => {
    it('rejects empty buffer', async () => {
      const svc = new ContractTemplateService(mockModel(), noopRedis);
      await expect(
        svc.uploadTemplate('TIMING' as any, Buffer.alloc(0), 'empty.docx'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects oversized buffer (>10MB)', async () => {
      const svc = new ContractTemplateService(mockModel(), noopRedis);
      const big = Buffer.alloc(10 * 1024 * 1024 + 1);
      await expect(
        svc.uploadTemplate('TIMING' as any, big, 'big.docx'),
      ).rejects.toThrow(/quá lớn/);
    });

    it('rejects corrupted docx buffer', async () => {
      const svc = new ContractTemplateService(mockModel(), noopRedis);
      // Random bytes that's not a valid ZIP
      const corrupted = Buffer.from('not a docx zip stream', 'utf8');
      await expect(
        svc.uploadTemplate('TIMING' as any, corrupted, 'fake.docx'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Task 1: getPreviewHtml — type validation', () => {
    it('throws on unknown contract type', async () => {
      const svc = new ContractTemplateService(mockModel(), noopRedis);
      await expect(
        svc.getPreviewHtml('UNKNOWN' as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Task 2: restoreBackup defensive filename validation', () => {
    it('rejects invalid filename (path traversal)', async () => {
      const svc = new ContractTemplateService(mockModel(), noopRedis);
      await expect(
        svc.restoreBackup('TIMING' as any, '../../../etc/passwd'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects filename that does not match contract type prefix', async () => {
      const svc = new ContractTemplateService(mockModel(), noopRedis);
      await expect(
        svc.restoreBackup('TIMING' as any, 'contract-racekit-123.docx'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound when backup file missing', async () => {
      const svc = new ContractTemplateService(mockModel(), noopRedis);
      await expect(
        svc.restoreBackup(
          'TIMING' as any,
          'contract-timing-999999999.docx',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Task 3: line items sanitize', () => {
    it('returns empty array when no doc exists', async () => {
      const svc = new ContractTemplateService(mockModel(null), noopRedis);
      const items = await svc.getLineItems('TIMING' as any);
      expect(items).toEqual([]);
    });

    it('returns defaultLineItems from existing doc', async () => {
      const doc = {
        contractType: 'TIMING',
        defaultLineItems: [
          { description: 'Chip RFID', unit: 'chip', quantity: 100, unitPrice: 50000 },
        ],
      };
      const svc = new ContractTemplateService(mockModel(doc), noopRedis);
      const items = await svc.getLineItems('TIMING' as any);
      expect(items).toHaveLength(1);
      expect(items[0].description).toBe('Chip RFID');
    });

    it('sanitizes input on update — clamps discount 0-100, coerces NaN', async () => {
      const updatedDoc = {
        contractType: 'TIMING',
        defaultLineItems: [
          {
            description: 'Item A',
            unit: 'cái',
            quantity: 10,
            unitPrice: 1000,
            discount: 100,
            note: '',
          },
        ],
      };
      const model = mockModel(updatedDoc);
      const svc = new ContractTemplateService(model, noopRedis);
      const result = await svc.updateLineItems(
        'TIMING' as any,
        [
          {
            description: '  Item A  ',
            unit: 'cái',
            quantity: 10,
            unitPrice: 1000,
            discount: 150, // → clamped to 100
            note: '',
          } as any,
          {
            description: 'Bad',
            unit: '',
            quantity: NaN as any, // → 0
            unitPrice: -50, // → 0
            discount: -5, // → 0
            note: '',
          } as any,
        ],
        'admin',
      );

      const passedToDb = (model.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set
        .defaultLineItems;
      expect(passedToDb[0].discount).toBe(100); // clamped
      expect(passedToDb[0].description).toBe('Item A'); // trimmed
      expect(passedToDb[1].quantity).toBe(0); // NaN coerced
      expect(passedToDb[1].unitPrice).toBe(0); // negative clamped
      expect(passedToDb[1].discount).toBe(0); // negative clamped
      // Return shape
      expect(result.contractType).toBe('TIMING');
      expect(result.defaultLineItems).toHaveLength(1);
    });
  });
});
