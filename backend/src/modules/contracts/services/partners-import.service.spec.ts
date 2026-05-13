/**
 * FEATURE-032 — Unit tests for PartnersImportService.
 *
 * 7 TC-IM-* mandatory (per 02-manager-plan.md):
 *   TC-IM-01 happy path 5 valid rows
 *   TC-IM-02 email IsEmail strict — accept a@b.com, reject not-email
 *   TC-IM-03 empty entityName → invalid
 *   TC-IM-04 duplicate by taxId → Skip+report
 *   TC-IM-05 duplicate by entityName (no taxId) → Skip+report
 *   TC-IM-06 mixed valid + duplicate (taxId) + duplicate (name) + invalid
 *   TC-IM-07 bulkInsert createdBy + re-validate dedup (race condition)
 *
 * Plus TC-IM-08 generateTemplate buffer + TC-IM-09 max 200 rows enforcement (defensive).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as ExcelJS from 'exceljs';
import { PartnersImportService } from './partners-import.service';
import { PartnersService } from './partners.service';
import { Partner } from '../schemas/partner.schema';

describe('PartnersImportService — FEATURE-032', () => {
  let service: PartnersImportService;
  let mockModel: { insertMany: jest.Mock };
  let mockPartnersService: { findByTaxIdsOrNames: jest.Mock };

  beforeEach(async () => {
    mockModel = {
      insertMany: jest.fn(),
    };
    mockPartnersService = {
      findByTaxIdsOrNames: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnersImportService,
        {
          provide: getModelToken(Partner.name),
          useValue: mockModel,
        },
        {
          provide: PartnersService,
          useValue: mockPartnersService,
        },
      ],
    }).compile();

    service = module.get<PartnersImportService>(PartnersImportService);
  });

  /**
   * Helper: build Excel buffer with given rows (header + data).
   * Each data row: [entityName, shortName, taxId, address, representative,
   *                 position, bankAccount, bankName, phone, email, notes]
   */
  async function buildExcel(
    rows: Array<Array<string | number | null | undefined>>,
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow([
      'Tên đối tác',
      'Tên viết tắt',
      'Mã số thuế',
      'Địa chỉ',
      'Người đại diện',
      'Chức vụ',
      'Số tài khoản',
      'Ngân hàng',
      'Điện thoại',
      'Email',
      'Ghi chú',
    ]);
    for (const row of rows) {
      ws.addRow(row);
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  it('TC-IM-01: happy path 5 valid rows → all valid, 0 duplicate, 0 invalid', async () => {
    const buf = await buildExcel([
      [
        'Công ty TNHH ABC',
        'ABC',
        '0123456789',
        'Số 1 ABC, Q1, HCM',
        'Nguyễn Văn A',
        'Giám đốc',
        '111000222',
        'Vietcombank',
        '0901234567',
        'a@abc.vn',
        'note 1',
      ],
      [
        'Công ty CP XYZ',
        'XYZ',
        '0987654321',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
      ['Đối tác DEF', '', '', '', '', '', '', '', '', '', ''],
      [
        'Sponsor GHI',
        'GHI',
        '',
        'HN',
        'Trần B',
        'PGĐ',
        '',
        '',
        '0123',
        'ghi@x.com',
        '',
      ],
      ['Công ty KLM', '', '0111222333', '', '', '', '', '', '', '', ''],
    ]);

    const result = await service.parseExcel(buf);

    expect(result.total).toBe(5);
    expect(result.valid).toHaveLength(5);
    expect(result.duplicate).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0].entityName).toBe('Công ty TNHH ABC');
    expect(result.valid[0].taxId).toBe('0123456789');
    expect(result.valid[0].email).toBe('a@abc.vn');
    // optional fields empty → undefined
    expect(result.valid[1].address).toBeUndefined();
    expect(result.valid[2].taxId).toBeUndefined();
  });

  it('TC-IM-02: email strict — accept "a@b.com", reject "not-email"', async () => {
    const buf = await buildExcel([
      ['P1', '', '', '', '', '', '', '', '', 'a@b.com', ''], // valid
      ['P2', '', '', '', '', '', '', '', '', 'not-email', ''], // invalid
      ['P3', '', '', '', '', '', '', '', '', 'foo@bar', ''], // invalid (no TLD dot)
      ['P4', '', '', '', '', '', '', '', '', '', ''], // empty email → valid (optional)
    ]);

    const result = await service.parseExcel(buf);

    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(2);
    expect(result.invalid[0].errors[0]).toContain('Email không hợp lệ');
    expect(result.invalid[0].errors[0]).toContain('not-email');
    expect(result.invalid[1].errors[0]).toContain('foo@bar');
  });

  it('TC-IM-03: empty entityName → invalid row report', async () => {
    const buf = await buildExcel([
      ['', '', '0123', '', '', '', '', '', '', '', ''], // empty entityName
      ['Valid Co', '', '', '', '', '', '', '', '', '', ''],
    ]);

    const result = await service.parseExcel(buf);

    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors).toContain('Tên đối tác bắt buộc');
  });

  it('TC-IM-04: duplicate by taxId → Skip+report (PAUSE-32-02 primary key)', async () => {
    mockPartnersService.findByTaxIdsOrNames.mockResolvedValue([
      { taxId: '0123456789', entityName: 'Old Name In DB' },
    ]);

    const buf = await buildExcel([
      [
        'New Display Name',
        '',
        '0123456789',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ], // taxId matches existing → duplicate (kể cả tên khác)
      ['Brand New', '', '0999888777', '', '', '', '', '', '', '', ''], // unique taxId → valid
    ]);

    const result = await service.parseExcel(buf);

    expect(result.total).toBe(2);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].entityName).toBe('Brand New');
    expect(result.duplicate).toHaveLength(1);
    expect(result.duplicate[0].taxId).toBe('0123456789');
    expect(result.invalid).toHaveLength(0);
  });

  it('TC-IM-05: duplicate by entityName (no taxId) → Skip+report (PAUSE-32-02 fallback)', async () => {
    mockPartnersService.findByTaxIdsOrNames.mockResolvedValue([
      { entityName: 'Existing No-Tax Co' }, // partner cũ KHÔNG có taxId
    ]);

    const buf = await buildExcel([
      ['Existing No-Tax Co', '', '', '', '', '', '', '', '', '', ''], // name match → duplicate
      ['Brand New Co', '', '', '', '', '', '', '', '', '', ''], // unique → valid
    ]);

    const result = await service.parseExcel(buf);

    expect(result.total).toBe(2);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].entityName).toBe('Brand New Co');
    expect(result.duplicate).toHaveLength(1);
    expect(result.duplicate[0].entityName).toBe('Existing No-Tax Co');
  });

  it('TC-IM-06: mixed valid + dup (taxId) + dup (name) + invalid → preview shape', async () => {
    mockPartnersService.findByTaxIdsOrNames.mockResolvedValue([
      { taxId: '0123456789', entityName: 'Co A' }, // partner cũ có taxId
      { entityName: 'Co B No Tax' }, // partner cũ KHÔNG có taxId
    ]);

    const buf = await buildExcel([
      ['Co A Renamed', '', '0123456789', '', '', '', '', '', '', '', ''], // dup taxId
      ['Co B No Tax', '', '', '', '', '', '', '', '', '', ''], // dup entityName (no taxId)
      ['Brand New', '', '0999', '', '', '', '', '', '', '', ''], // valid
      ['', '', '0888', '', '', '', '', '', '', '', ''], // invalid (empty entityName)
      ['Bad Email', '', '', '', '', '', '', '', '', 'foo@bar', ''], // invalid (email)
    ]);

    const result = await service.parseExcel(buf);

    expect(result.total).toBe(5);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].entityName).toBe('Brand New');
    expect(result.duplicate).toHaveLength(2);
    expect(result.duplicate.map((r) => r.entityName).sort()).toEqual([
      'Co A Renamed',
      'Co B No Tax',
    ]);
    expect(result.invalid).toHaveLength(2);
    expect(result.invalid.map((r) => r.errors[0])).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Tên đối tác bắt buộc'),
        expect.stringContaining('Email không hợp lệ'),
      ]),
    );
  });

  it('TC-IM-07: bulkInsert — createdBy assertion + server re-validate dedup (race)', async () => {
    // FE preview passed 3 "valid" rows. But race: 1 đã được admin add cùng lúc.
    mockPartnersService.findByTaxIdsOrNames.mockResolvedValue([
      { taxId: '0987', entityName: 'Race Co' }, // existed now
    ]);
    mockModel.insertMany.mockResolvedValue([{ _id: '1' }, { _id: '3' }]);

    const rows = [
      {
        rowNum: 2,
        entityName: 'Co A',
        taxId: '0123',
        email: 'a@a.com',
      },
      {
        rowNum: 3,
        entityName: 'Race Co',
        taxId: '0987', // duplicates existing now
      },
      {
        rowNum: 4,
        entityName: 'Co C No Tax',
      },
    ];

    const result = await service.bulkInsert(rows, 'admin-user-42');

    expect(result.inserted).toBe(2);
    expect(result.skipped_duplicate).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockModel.insertMany).toHaveBeenCalledTimes(1);
    const [docs, options] = mockModel.insertMany.mock.calls[0];
    expect(options).toEqual({ ordered: false });
    expect(docs).toHaveLength(2);
    expect(docs.map((d: { entityName: string }) => d.entityName)).toEqual([
      'Co A',
      'Co C No Tax',
    ]);
    expect(docs[0].createdBy).toBe('admin-user-42');
    expect(docs[0].taxId).toBe('0123');
    expect(docs[0].email).toBe('a@a.com');
    expect(docs[0].createdAt).toBeInstanceOf(Date);
    expect(docs[1].taxId).toBeUndefined();
  });

  it('TC-IM-08 (defensive): generateTemplate returns valid XLSX buffer parse-able', async () => {
    const buf = await service.generateTemplate();
    expect(buf.length).toBeGreaterThan(1000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
      ) as ArrayBuffer,
    );
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('Doi tac');

    const headerRow = ws.getRow(1);
    expect(headerRow.getCell(1).value).toBe('Tên đối tác');
    expect(headerRow.getCell(2).value).toBe('Tên viết tắt');
    expect(headerRow.getCell(3).value).toBe('Mã số thuế');
    expect(headerRow.getCell(4).value).toBe('Địa chỉ');
    expect(headerRow.getCell(5).value).toBe('Người đại diện');
    expect(headerRow.getCell(6).value).toBe('Chức vụ');
    expect(headerRow.getCell(7).value).toBe('Số tài khoản');
    expect(headerRow.getCell(8).value).toBe('Ngân hàng');
    expect(headerRow.getCell(9).value).toBe('Điện thoại');
    expect(headerRow.getCell(10).value).toBe('Email');
    expect(headerRow.getCell(11).value).toBe('Ghi chú');

    // Example row exists
    const exampleRow = ws.getRow(2);
    expect(String(exampleRow.getCell(1).value)).toContain('ABC');
    expect(String(exampleRow.getCell(10).value)).toContain('@');
  });

  it('TC-IM-09 (defensive): Max 200 rows enforcement — row 201+ flagged invalid', async () => {
    const data: Array<Array<string | number | null | undefined>> = [];
    for (let i = 0; i < 205; i++) {
      data.push([`Co ${i}`, '', '', '', '', '', '', '', '', '', '']);
    }
    const buf = await buildExcel(data);

    const result = await service.parseExcel(buf);

    expect(result.total).toBe(205);
    expect(result.valid).toHaveLength(200);
    expect(result.invalid.length).toBeGreaterThanOrEqual(5);
    expect(result.invalid[0].errors[0]).toContain('200');
  });
});
