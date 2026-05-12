/**
 * F-024 service-catalog.service.spec.ts
 *
 * Coverage BR-CM-16:
 * - CRUD catalog item
 * - Soft delete sets deletedAt (line items in contracts là snapshot, không affected)
 * - filter by category
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ServiceCatalogService } from './service-catalog.service';

describe('ServiceCatalogService', () => {
  let svc: ServiceCatalogService;
  let mockModel: any;

  beforeEach(() => {
    mockModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn(),
    };
    svc = new ServiceCatalogService(mockModel);
  });

  describe('BR-CM-16 CRUD', () => {
    it('creates catalog item with category', async () => {
      mockModel.create.mockResolvedValue({
        toObject: () => ({
          _id: new Types.ObjectId(),
          name: 'Cho thuê chip tính giờ',
          category: 'TIMING',
          unit: 'Cái',
          referencePrice: 28_000,
        }),
      });
      const r = await svc.create({
        name: 'Cho thuê chip tính giờ',
        category: 'TIMING',
        unit: 'Cái',
        referencePrice: 28_000,
      });
      expect(r.name).toBe('Cho thuê chip tính giờ');
    });

    it('updates catalog item', async () => {
      const id = new Types.ObjectId().toString();
      mockModel.findOneAndUpdate.mockReturnValue({
        lean: () => Promise.resolve({ _id: id, name: 'Updated', referencePrice: 30_000 }),
      });
      const r = await svc.update(id, { referencePrice: 30_000 });
      expect(r.referencePrice).toBe(30_000);
    });

    it('creates catalog item với cả referencePrice + referenceCost (P&L pre-compute)', async () => {
      mockModel.create.mockResolvedValue({
        toObject: () => ({
          _id: new Types.ObjectId(),
          name: 'In BIB khổ A5',
          category: 'RACEKIT',
          unit: 'Cái',
          referencePrice: 10_000,
          referenceCost: 6_000,
        }),
      });
      const r = await svc.create({
        name: 'In BIB khổ A5',
        category: 'RACEKIT',
        unit: 'Cái',
        referencePrice: 10_000,
        referenceCost: 6_000,
      });
      expect(r.referencePrice).toBe(10_000);
      expect(r.referenceCost).toBe(6_000);
      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ referenceCost: 6_000 }),
      );
    });

    it('updates referenceCost giữ nguyên referencePrice', async () => {
      const id = new Types.ObjectId().toString();
      mockModel.findOneAndUpdate.mockReturnValue({
        lean: () =>
          Promise.resolve({
            _id: id,
            name: 'Cho thuê chip',
            referencePrice: 28_000,
            referenceCost: 18_000,
          }),
      });
      const r = await svc.update(id, { referenceCost: 18_000 });
      expect(r.referenceCost).toBe(18_000);
      expect(r.referencePrice).toBe(28_000);
      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: id, deletedAt: null }),
        expect.objectContaining({ referenceCost: 18_000 }),
        expect.objectContaining({ new: true }),
      );
    });
  });

  describe('Soft delete', () => {
    it('soft deletes — sets deletedAt without affecting snapshot line items', async () => {
      const id = new Types.ObjectId().toString();
      mockModel.updateOne.mockResolvedValue({ matchedCount: 1 });
      const r = await svc.remove(id);
      expect(r.success).toBe(true);
      expect(mockModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: id, deletedAt: null }),
        expect.objectContaining({ $set: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });

    it('rejects invalid ObjectId', async () => {
      await expect(svc.remove('xxx')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound if missing', async () => {
      const id = new Types.ObjectId().toString();
      mockModel.updateOne.mockResolvedValue({ matchedCount: 0 });
      await expect(svc.remove(id)).rejects.toThrow(NotFoundException);
    });
  });
});
