/**
 * FEATURE-031 — Unit tests for ServiceCatalogImportService.
 *
 * 7 TC-IM-* mandatory:
 *   TC-IM-01 happy path 5 valid rows
 *   TC-IM-02 category parser VN + EN accept
 *   TC-IM-03 empty name → invalid
 *   TC-IM-04 invalid category → invalid
 *   TC-IM-05 duplicate detection skip
 *   TC-IM-06 mixed valid + duplicate + invalid
 *   TC-IM-07 bulkInsert createdBy assertion
 *
 * Plus TC-IM-08 generateTemplate buffer + TC-IM-09 max rows enforcement (defensive).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as ExcelJS from 'exceljs';
import { ServiceCatalogImportService } from './service-catalog-import.service';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceCatalog } from '../schemas/service-catalog.schema';

describe('ServiceCatalogImportService — FEATURE-031', () => {
  let service: ServiceCatalogImportService;
  let mockModel: { insertMany: jest.Mock };
  let mockCatalogService: { findByNameCategoryPairs: jest.Mock };

  beforeEach(async () => {
    mockModel = {
      insertMany: jest.fn(),
    };
    mockCatalogService = {
      findByNameCategoryPairs: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceCatalogImportService,
        {
          provide: getModelToken(ServiceCatalog.name),
          useValue: mockModel,
        },
        {
          provide: ServiceCatalogService,
          useValue: mockCatalogService,
        },
      ],
    }).compile();

    service = module.get<ServiceCatalogImportService>(
      ServiceCatalogImportService,
    );
  });

  /**
   * Helper: build Excel buffer with given rows (header + data).
   * Each data row: [name, category, unit, refPrice, refCost, desc, sortOrder]
   */
  async function buildExcel(
    rows: Array<Array<string | number | null | undefined>>,
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow([
      'Tên dịch vụ',
      'Nhóm',
      'ĐVT',
      'Giá tham khảo',
      'Giá vốn',
      'Mô tả',
      'Thứ tự',
    ]);
    for (const row of rows) {
      ws.addRow(row);
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  it('TC-IM-01: happy path 5 valid rows → all valid, 0 duplicate, 0 invalid', async () => {
    const buf = await buildExcel([
      ['Timing chip', 'TIMING', 'vé', 50000, 35000, 'Chip RFID', 1],
      ['Racekit basic', 'RACEKIT', 'gói', 200000, 150000, '', 2],
      ['Setup tent', 'OPERATIONS', 'cái', 500000, 300000, 'Lều BTC', 3],
      ['Volunteer', 'GENERAL', 'người', 100000, 70000, '', 4],
      ['Bib paper', 'RACEKIT', 'vé', 5000, 2000, '', 5],
    ]);

    const result = await service.parseExcel(buf);

    expect(result.total).toBe(5);
    expect(result.valid).toHaveLength(5);
    expect(result.duplicate).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0].name).toBe('Timing chip');
    expect(result.valid[0].category).toBe('TIMING');
    expect(result.valid[0].referencePrice).toBe(50000);
  });

  it('TC-IM-02: category parser accept VN labels AND English enum case-insensitive', async () => {
    const buf = await buildExcel([
      ['A1', 'Tính giờ', '', 0, 0, '', 0], // VN label
      ['A2', 'TIMING', '', 0, 0, '', 0], // English uppercase
      ['A3', 'timing', '', 0, 0, '', 0], // English lowercase
      ['A4', 'Racekit', '', 0, 0, '', 0], // VN label (same as enum)
      ['A5', 'Vận hành', '', 0, 0, '', 0], // VN with diacritics
      ['A6', 'van hanh', '', 0, 0, '', 0], // VN no diacritics
      ['A7', 'Chung', '', 0, 0, '', 0],
      ['A8', 'Khác', '', 0, 0, '', 0], // alternative VN
    ]);

    const result = await service.parseExcel(buf);

    expect(result.valid).toHaveLength(8);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0].category).toBe('TIMING');
    expect(result.valid[1].category).toBe('TIMING');
    expect(result.valid[2].category).toBe('TIMING');
    expect(result.valid[3].category).toBe('RACEKIT');
    expect(result.valid[4].category).toBe('OPERATIONS');
    expect(result.valid[5].category).toBe('OPERATIONS');
    expect(result.valid[6].category).toBe('GENERAL');
    expect(result.valid[7].category).toBe('GENERAL');
  });

  it('TC-IM-03: empty name → invalid row report `Tên dịch vụ bắt buộc`', async () => {
    const buf = await buildExcel([
      ['', 'TIMING', 'vé', 50000, 35000, '', 1], // empty name
      ['Valid item', 'RACEKIT', '', 0, 0, '', 0],
    ]);

    const result = await service.parseExcel(buf);

    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors).toContain('Tên dịch vụ bắt buộc');
  });

  it('TC-IM-04: invalid category "FOO" → invalid row report', async () => {
    const buf = await buildExcel([
      ['Item1', 'FOO', '', 0, 0, '', 0],
      ['Item2', '', '', 0, 0, '', 0], // empty category
    ]);

    const result = await service.parseExcel(buf);

    expect(result.invalid).toHaveLength(2);
    expect(result.invalid[0].errors[0]).toContain('FOO');
    expect(result.invalid[1].errors).toContain('Nhóm bắt buộc');
  });

  it('TC-IM-05: duplicate detection — 2 rows trùng name+category với DB → marked duplicate, skip insert', async () => {
    mockCatalogService.findByNameCategoryPairs.mockResolvedValue([
      { name: 'Existing 1', category: 'TIMING' },
      { name: 'Existing 2', category: 'RACEKIT' },
    ]);

    const buf = await buildExcel([
      ['Existing 1', 'TIMING', '', 0, 0, '', 0], // duplicate
      ['Existing 2', 'RACEKIT', '', 0, 0, '', 0], // duplicate
      ['New item', 'GENERAL', '', 0, 0, '', 0], // not duplicate
    ]);

    const result = await service.parseExcel(buf);

    expect(result.total).toBe(3);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].name).toBe('New item');
    expect(result.duplicate).toHaveLength(2);
    expect(result.duplicate.map((r) => r.name).sort()).toEqual([
      'Existing 1',
      'Existing 2',
    ]);
    expect(result.invalid).toHaveLength(0);
  });

  it('TC-IM-06: mixed rows — valid + duplicate + invalid → preview shape correct', async () => {
    mockCatalogService.findByNameCategoryPairs.mockResolvedValue([
      { name: 'Dup1', category: 'TIMING' },
    ]);

    const buf = await buildExcel([
      ['Dup1', 'TIMING', '', 0, 0, '', 0], // duplicate
      ['NewItem', 'RACEKIT', '', 0, 0, '', 0], // valid new
      ['', 'OPERATIONS', '', 0, 0, '', 0], // invalid empty name
      ['Item3', 'INVALID_CAT', '', 0, 0, '', 0], // invalid category
      ['Item4', 'GENERAL', '', -100, 0, '', 0], // invalid negative price
    ]);

    const result = await service.parseExcel(buf);

    expect(result.total).toBe(5);
    expect(result.valid).toHaveLength(1);
    expect(result.duplicate).toHaveLength(1);
    expect(result.invalid).toHaveLength(3);
    expect(result.invalid.map((r) => r.errors[0])).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Tên dịch vụ bắt buộc'),
        expect.stringContaining('INVALID_CAT'),
        expect.stringContaining('≥ 0'),
      ]),
    );
  });

  it('TC-IM-07: bulkInsert — insertMany called với correct shape including createdBy', async () => {
    mockCatalogService.findByNameCategoryPairs.mockResolvedValue([]);
    mockModel.insertMany.mockResolvedValue([{ _id: '1' }, { _id: '2' }, { _id: '3' }]);

    const rows = [
      {
        rowNum: 2,
        name: 'A',
        category: 'TIMING',
        unit: 'vé',
        referencePrice: 100,
        referenceCost: 50,
        description: 'desc-A',
        sortOrder: 1,
      },
      {
        rowNum: 3,
        name: 'B',
        category: 'RACEKIT',
        referencePrice: 200,
        referenceCost: 100,
        sortOrder: 2,
      },
      {
        rowNum: 4,
        name: 'C',
        category: 'GENERAL',
      },
    ];

    const result = await service.bulkInsert(rows, 'user-abc-123');

    expect(result.inserted).toBe(3);
    expect(result.skipped_duplicate).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockModel.insertMany).toHaveBeenCalledTimes(1);
    const [docs, options] = mockModel.insertMany.mock.calls[0];
    expect(options).toEqual({ ordered: false });
    expect(docs).toHaveLength(3);
    expect(docs[0].createdBy).toBe('user-abc-123');
    expect(docs[0].name).toBe('A');
    expect(docs[0].referencePrice).toBe(100);
    expect(docs[2].referencePrice).toBe(0); // fallback default cho rows[2]
    expect(docs[2].sortOrder).toBe(0);
    expect(docs[0].createdAt).toBeInstanceOf(Date);
  });

  it('TC-IM-08 (defensive): generateTemplate returns valid XLSX buffer parse-able', async () => {
    const buf = await service.generateTemplate();
    expect(buf.length).toBeGreaterThan(1000);

    // Parse back to verify shape
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('Danh muc dich vu');

    // Header row
    const headerRow = ws.getRow(1);
    expect(headerRow.getCell(1).value).toBe('Tên dịch vụ');
    expect(headerRow.getCell(2).value).toBe('Nhóm');
    expect(headerRow.getCell(3).value).toBe('ĐVT');
    expect(headerRow.getCell(4).value).toBe('Giá tham khảo');
    expect(headerRow.getCell(5).value).toBe('Giá vốn');
    expect(headerRow.getCell(6).value).toBe('Mô tả');
    expect(headerRow.getCell(7).value).toBe('Thứ tự');

    // Example row exists
    const exampleRow = ws.getRow(2);
    expect(exampleRow.getCell(1).value).toBe('Timing chip RFID');
    expect(exampleRow.getCell(2).value).toBe('Tính giờ');
  });

  it('TC-IM-09 (defensive): bulkInsert re-checks duplicate server-side, KHÔNG trust FE', async () => {
    // FE preview passed 3 rows as "valid". But race condition: admin created 1 of them
    // via individual POST sau preview. Server must re-check + skip.
    mockCatalogService.findByNameCategoryPairs.mockResolvedValue([
      { name: 'B', category: 'RACEKIT' }, // race condition duplicate
    ]);
    mockModel.insertMany.mockResolvedValue([{ _id: '1' }, { _id: '3' }]);

    const rows = [
      { rowNum: 2, name: 'A', category: 'TIMING' },
      { rowNum: 3, name: 'B', category: 'RACEKIT' }, // already exists now
      { rowNum: 4, name: 'C', category: 'GENERAL' },
    ];

    const result = await service.bulkInsert(rows, 'user-1');

    expect(result.inserted).toBe(2);
    expect(result.skipped_duplicate).toBe(1);
    expect(result.failed).toBe(0);

    const [docs] = mockModel.insertMany.mock.calls[0];
    expect(docs).toHaveLength(2);
    expect(docs.map((d: { name: string }) => d.name)).toEqual(['A', 'C']);
  });
});
