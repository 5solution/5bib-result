/**
 * F-028 Phase 3 — cost-suggestions.service.spec.ts
 *
 * Covers:
 *   - Happy path: contract có N line items với catalogItemId → return N suggestions
 *   - Line item KHÔNG có catalogItemId → skip
 *   - Catalog item đã soft delete → skip với warning log
 *   - referenceCost = 0 → suggestion amount = 0 (still returned)
 *   - Bulk create: forward đến CostItemsService.create() N lần (preserve audit)
 *   - Bulk create: empty items → 400
 *   - Bulk create: invalid contract → 404
 *   - mapCategory static helper rule (TIMING/RACEKIT→MATERIAL, OPERATIONS→VENDOR,
 *     GENERAL→OTHER)
 */
import { Types } from 'mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CostSuggestionsService } from './cost-suggestions.service';

describe('F-028 Phase 3 CostSuggestionsService', () => {
  let service: CostSuggestionsService;
  let contractModel: any;
  let catalogModel: any;
  let costItemModel: any;
  let costItemsService: any;
  let audit: any;

  const contractId = new Types.ObjectId().toString();
  const cat1Id = new Types.ObjectId();
  const cat2Id = new Types.ObjectId();
  const cat3Id = new Types.ObjectId();

  beforeEach(() => {
    const contract = {
      _id: new Types.ObjectId(contractId),
      contractType: 'TIMING',
      deletedAt: null,
      lineItems: [
        {
          stt: 1,
          description: 'Chip RFID',
          quantity: 100,
          unitPrice: 27_000,
          amount: 2_700_000,
          catalogItemId: String(cat1Id),
        },
        {
          stt: 2,
          description: 'BIB giấy',
          quantity: 100,
          unitPrice: 5000,
          amount: 500_000,
          catalogItemId: String(cat2Id),
        },
        {
          stt: 3,
          description: 'Vận hành finish line',
          quantity: 1,
          unitPrice: 10_000_000,
          amount: 10_000_000,
          // KHÔNG có catalogItemId — manual input
        },
        {
          stt: 4,
          description: 'Catalog đã xoá',
          quantity: 5,
          unitPrice: 1_000_000,
          amount: 5_000_000,
          catalogItemId: String(cat3Id),
        },
      ],
    };

    contractModel = {
      findOne: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(contract),
      })),
      exists: jest.fn().mockResolvedValue({ _id: contract._id }),
    };

    const catalogs = [
      {
        _id: cat1Id,
        name: 'Chip RFID dán BIB',
        category: 'TIMING',
        unit: 'cái',
        referencePrice: 27_000,
        referenceCost: 18_000,
      },
      {
        _id: cat2Id,
        name: 'BIB giấy in màu',
        category: 'RACEKIT',
        unit: 'cái',
        referencePrice: 5_000,
        referenceCost: 0, // edge case: cost = 0
      },
      // cat3Id KHÔNG có trong DB (soft deleted)
    ];

    catalogModel = {
      find: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(catalogs),
      })),
    };

    costItemModel = {};

    costItemsService = {
      create: jest.fn(async (cid: string, dto: any, actorId: string) => ({
        id: new Types.ObjectId().toString(),
        contractId: cid,
        description: dto.description,
        category: dto.category,
        amount: dto.amount,
        note: dto.note,
        incurredDate: dto.incurredDate,
        createdBy: actorId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    };

    audit = { emit: jest.fn().mockResolvedValue(undefined) };

    service = new CostSuggestionsService(
      contractModel,
      catalogModel,
      costItemModel,
      costItemsService,
      audit,
    );
  });

  it('Happy path — return suggestions cho line items có catalogItemId', async () => {
    const suggestions = await service.getSuggestions(contractId);

    // Line item #3 (no catalogItemId) skip + #4 (soft deleted catalog) skip
    expect(suggestions).toHaveLength(2);

    expect(suggestions[0]).toEqual({
      catalogItemId: String(cat1Id),
      description: 'Chip RFID dán BIB',
      category: 'MATERIAL', // TIMING → MATERIAL
      quantity: 100,
      unit: 'cái',
      costPerUnit: 18_000,
      suggestedAmount: 1_800_000, // 100 × 18_000
      contractLineItemStt: 1,
    });

    expect(suggestions[1]).toEqual({
      catalogItemId: String(cat2Id),
      description: 'BIB giấy in màu',
      category: 'MATERIAL', // RACEKIT → MATERIAL
      quantity: 100,
      unit: 'cái',
      costPerUnit: 0,
      suggestedAmount: 0, // referenceCost=0 → amount=0 (still returned)
      contractLineItemStt: 2,
    });
  });

  it('Invalid contractId → BadRequestException', async () => {
    await expect(service.getSuggestions('not-an-id')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('Contract không tồn tại → NotFoundException', async () => {
    contractModel.findOne = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(null),
    }));
    await expect(
      service.getSuggestions(new Types.ObjectId().toString()),
    ).rejects.toThrow(NotFoundException);
  });

  it('Contract không có line items với catalogItemId → empty array', async () => {
    contractModel.findOne = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        lineItems: [
          { stt: 1, description: 'manual', quantity: 1, unitPrice: 1 },
        ],
      }),
    }));
    const result = await service.getSuggestions(contractId);
    expect(result).toEqual([]);
  });

  it('mapCategory — TIMING/RACEKIT → MATERIAL, OPERATIONS → VENDOR, GENERAL → OTHER', () => {
    expect(CostSuggestionsService.mapCategory('TIMING')).toBe('MATERIAL');
    expect(CostSuggestionsService.mapCategory('RACEKIT')).toBe('MATERIAL');
    expect(CostSuggestionsService.mapCategory('OPERATIONS')).toBe('VENDOR');
    expect(CostSuggestionsService.mapCategory('GENERAL')).toBe('OTHER');
  });

  it('bulkCreate — forward N items đến costItemsService.create + emit audit aggregate', async () => {
    const items = [
      { description: 'Chip RFID dán BIB', category: 'MATERIAL' as const, amount: 1_800_000 },
      { description: 'BIB giấy in màu', category: 'MATERIAL' as const, amount: 0 },
    ];
    const created = await service.bulkCreate(contractId, items, 'admin-1');

    expect(created).toHaveLength(2);
    expect(costItemsService.create).toHaveBeenCalledTimes(2);
    expect(costItemsService.create).toHaveBeenNthCalledWith(
      1,
      contractId,
      items[0],
      'admin-1',
    );

    expect(audit.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance.cost_item.bulk_create_from_suggestions',
        metadata: expect.objectContaining({
          count: 2,
          totalAmount: 1_800_000,
        }),
      }),
    );
  });

  it('bulkCreate empty list → BadRequestException', async () => {
    await expect(service.bulkCreate(contractId, [], 'admin')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('bulkCreate invalid contractId → BadRequestException', async () => {
    await expect(
      service.bulkCreate(
        'not-an-id',
        [{ description: 'x', category: 'OTHER' as const, amount: 1 }],
        'admin',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('bulkCreate contract not found → NotFoundException', async () => {
    contractModel.exists = jest.fn().mockResolvedValue(null);
    await expect(
      service.bulkCreate(
        new Types.ObjectId().toString(),
        [{ description: 'x', category: 'OTHER' as const, amount: 1 }],
        'admin',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
