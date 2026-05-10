/**
 * F-024 partners.service.spec.ts
 *
 * Coverage:
 * - BR-CM-10: Partner CRUD độc lập (no merchant module dependency)
 * - UP-06: Cannot delete partner with active contract reference
 * - Soft delete sets deletedAt
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
