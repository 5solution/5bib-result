/**
 * F-024 partners.service.spec.ts
 *
 * Coverage:
 * - BR-CM-10: Partner CRUD độc lập (no merchant module dependency)
 * - UP-06: Cannot delete partner with active contract reference
 * - Soft delete sets deletedAt
 */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PartnersService } from './partners.service';
import { Types } from 'mongoose';

describe('PartnersService', () => {
  let svc: PartnersService;
  let mockPartnerModel: any;
  let mockContractModel: any;

  beforeEach(() => {
    mockPartnerModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
    };
    mockContractModel = {
      countDocuments: jest.fn(),
    };
    svc = new PartnersService(mockPartnerModel, mockContractModel);
  });

  describe('create — BR-CM-10', () => {
    it('creates partner independent of merchant module', async () => {
      const created = {
        toObject: () => ({
          _id: new Types.ObjectId(),
          entityName: 'TAM Media',
          taxId: '0110446252',
        }),
      };
      mockPartnerModel.create.mockResolvedValue(created);
      const r = await svc.create({ entityName: 'TAM Media', taxId: '0110446252' }, 'admin');
      expect(r.entityName).toBe('TAM Media');
      expect(mockPartnerModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ entityName: 'TAM Media', createdBy: 'admin' }),
      );
    });
  });

  describe('FEATURE-066 OQ-66-01: assertShortNameUnique() — via create/update', () => {
    const leanOf = (val: any) => ({ lean: jest.fn().mockResolvedValue(val) });

    it('TC-66-PARTNER-01: create() succeeds khi shortName chưa tồn tại', async () => {
      // findOne(shortName check) returns null → no conflict
      mockPartnerModel.findOne.mockReturnValueOnce(leanOf(null));
      const created = {
        toObject: () => ({
          _id: new Types.ObjectId(),
          entityName: 'New Tam Co',
          shortName: 'NEWTAM',
        }),
      };
      mockPartnerModel.create.mockResolvedValue(created);

      const r = await svc.create(
        { entityName: 'New Tam Co', taxId: '0110000001', shortName: 'NEWTAM' },
        'admin',
      );

      expect(r.shortName).toBe('NEWTAM');
      expect(mockPartnerModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ shortName: 'NEWTAM', deletedAt: null }),
        { _id: 1 },
      );
      // No excludeId on create → filter must NOT contain `_id`
      const filterArg = mockPartnerModel.findOne.mock.calls[0][0];
      expect(filterArg._id).toBeUndefined();
    });

    it('TC-66-PARTNER-02: create() throws ConflictException khi shortName đã tồn tại', async () => {
      mockPartnerModel.findOne.mockReturnValueOnce(
        leanOf({ _id: new Types.ObjectId() }),
      );

      await expect(
        svc.create(
          { entityName: 'Other Co', taxId: '0110000002', shortName: 'TAM' },
          'admin',
        ),
      ).rejects.toThrow(ConflictException);

      // Confirm exact VN message per BR-66 wording
      await expect(
        (async () => {
          mockPartnerModel.findOne.mockReturnValueOnce(
            leanOf({ _id: new Types.ObjectId() }),
          );
          await svc.create(
            { entityName: 'Other Co', taxId: '0110000003', shortName: 'TAM' },
            'admin',
          );
        })(),
      ).rejects.toThrow(/Tên viết tắt "TAM" đã được dùng cho đối tác khác/);

      expect(mockPartnerModel.create).not.toHaveBeenCalled();
    });

    it('TC-66-PARTNER-03: update() excludes self khi check uniqueness (PATCH scenario)', async () => {
      const selfId = new Types.ObjectId().toString();
      mockPartnerModel.findOne.mockReturnValueOnce(leanOf(null));
      mockPartnerModel.findOneAndUpdate.mockReturnValueOnce(
        leanOf({ _id: selfId, shortName: 'TAM', entityName: 'Tam Media' }),
      );

      const r = await svc.update(selfId, { shortName: 'TAM' });

      expect(r.shortName).toBe('TAM');
      const filterArg = mockPartnerModel.findOne.mock.calls[0][0];
      expect(filterArg.shortName).toBe('TAM');
      expect(filterArg.deletedAt).toBeNull();
      // excludeId branch: filter._id = { $ne: ObjectId(selfId) }
      expect(filterArg._id).toBeDefined();
      expect(filterArg._id.$ne).toBeInstanceOf(Types.ObjectId);
      expect(filterArg._id.$ne.toString()).toBe(selfId);
    });
  });

  describe('UP-06: delete with reference', () => {
    it('rejects delete if contract references partner', async () => {
      const partnerId = new Types.ObjectId().toString();
      mockContractModel.countDocuments.mockResolvedValue(3);
      await expect(svc.remove(partnerId)).rejects.toThrow(BadRequestException);
    });

    it('soft deletes when no contracts reference partner', async () => {
      const partnerId = new Types.ObjectId().toString();
      mockContractModel.countDocuments.mockResolvedValue(0);
      mockPartnerModel.updateOne.mockResolvedValue({ matchedCount: 1 });
      const r = await svc.remove(partnerId);
      expect(r.success).toBe(true);
      expect(mockPartnerModel.updateOne).toHaveBeenCalled();
    });

    it('throws NotFound if partner missing', async () => {
      const partnerId = new Types.ObjectId().toString();
      mockContractModel.countDocuments.mockResolvedValue(0);
      mockPartnerModel.updateOne.mockResolvedValue({ matchedCount: 0 });
      await expect(svc.remove(partnerId)).rejects.toThrow(NotFoundException);
    });

    it('rejects invalid ObjectId', async () => {
      await expect(svc.remove('not-a-valid-id')).rejects.toThrow(BadRequestException);
    });
  });
});
