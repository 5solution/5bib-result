import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import {
  ServiceCatalog,
  ServiceCatalogDocument,
  ServiceCategory,
} from '../schemas/service-catalog.schema';
import { ServiceCatalogService } from './service-catalog.service';
import {
  InvalidServiceCatalogRowDto,
  ParsedServiceCatalogRowDto,
  ServiceCatalogImportPreviewDto,
  ServiceCatalogImportResultDto,
} from '../dto/import-service-catalog.dto';

/**
 * FEATURE-031 — Service Catalog Excel Import Service.
 *
 * Pipeline: parseExcel → validate per-row → check duplicates → preview
 *           confirm → re-validate server-side → insertMany {ordered:false}
 *
 * Reuse ExcelJS (đã có sẵn từ reconciliation/xlsx.service.ts) cho parse + template gen.
 * Reuse `LogtoStaffGuard` class-level từ controller — KHÔNG check auth tại service layer.
 *
 * 5 PAUSE-31-* compliance:
 * - PAUSE-31-02 Duplicate = Skip + report (NOT update, NOT fail batch)
 * - PAUSE-31-03 2-step preview→confirm
 * - PAUSE-31-04 Max 200 rows per import
 * - PAUSE-31-05 createdBy = userId admin
 * - PAUSE-31-06 Empty/invalid = per-row skip + report all errors
 * - PAUSE-31-07 Download template button — generateTemplate()
 * - PAUSE-31-01 Category accept VN labels HOẶC English enum (case-insensitive)
 */
@Injectable()
export class ServiceCatalogImportService {
  private readonly logger = new Logger(ServiceCatalogImportService.name);

  /** Max rows enforced per PAUSE-31-04 (DOS protection + sensible UX). */
  private readonly MAX_ROWS = 200;

  /**
   * Category parser — accept VN labels (admin UI) HOẶC English enum.
   * Case-insensitive + trim + remove Vietnamese diacritics fallback.
   *
   * VN labels match admin/.../_components/service-catalog-table.tsx:57-60:
   *   TIMING:     "Tính giờ"
   *   RACEKIT:    "Racekit"
   *   OPERATIONS: "Vận hành"
   *   GENERAL:    "Chung"
   */
  private readonly CATEGORY_MAP: Record<string, ServiceCategory> = {
    // English enums (canonical)
    timing: 'TIMING',
    racekit: 'RACEKIT',
    operations: 'OPERATIONS',
    general: 'GENERAL',
    // VN labels primary
    'tính giờ': 'TIMING',
    'tinh gio': 'TIMING',
    'vận hành': 'OPERATIONS',
    'van hanh': 'OPERATIONS',
    chung: 'GENERAL',
    khác: 'GENERAL',
    khac: 'GENERAL',
  };

  constructor(
    @InjectModel(ServiceCatalog.name)
    private model: Model<ServiceCatalogDocument>,
    private catalogService: ServiceCatalogService,
  ) {}

  /**
   * Parse + validate Excel buffer → preview shape.
   * Pure read-only — KHÔNG modify DB.
   */
  async parseExcel(
    buffer: Buffer,
  ): Promise<ServiceCatalogImportPreviewDto> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(
        // ExcelJS accepts ArrayBuffer hoặc Buffer
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer,
      );
    } catch (err) {
      throw new BadRequestException(
        `File Excel không hợp lệ: ${(err as Error).message}`,
      );
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('File Excel không có sheet nào');
    }

    // Iterate rows starting from row 2 (skip header)
    const valid: ParsedServiceCatalogRowDto[] = [];
    const invalid: InvalidServiceCatalogRowDto[] = [];
    let dataRowCount = 0;

    // ExcelJS row.eachCell với includeEmpty=true để giữ column index alignment
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      // Skip example/note rows (italic styled row 2 trong template) — heuristic: cell A
      // chứa string bắt đầu với "↑" hoặc empty + cell B empty
      const cellA = row.getCell(1).value;
      const cellB = row.getCell(2).value;
      const aText = cellA == null ? '' : String(cellA).trim();
      const bText = cellB == null ? '' : String(cellB).trim();
      if (aText.startsWith('↑') || (!aText && !bText)) return; // skip note/empty
      dataRowCount += 1;

      // Enforce max rows BEFORE validation expensive
      if (dataRowCount > this.MAX_ROWS) {
        // Push all remaining rows into invalid với errors
        invalid.push({
          rowNum: rowNumber,
          errors: [
            `Vượt quá giới hạn ${this.MAX_ROWS} dòng/lần import. Tách file ra nhiều lần.`,
          ],
          raw: { A: aText, B: bText },
        });
        return;
      }

      const parsed = this.validateRow(row, rowNumber);
      if ('errors' in parsed) {
        invalid.push(parsed);
      } else {
        valid.push(parsed);
      }
    });

    // Batch check duplicate (1 query) per PAUSE-31-02 Skip + report
    const duplicate: ParsedServiceCatalogRowDto[] = [];
    if (valid.length > 0) {
      const existingPairs = await this.catalogService.findByNameCategoryPairs(
        valid.map((r) => ({ name: r.name, category: r.category })),
      );
      const existingSet = new Set(
        existingPairs.map((p) => `${p.name}|${p.category}`),
      );
      // Partition valid → duplicate (skip) vs truly valid (insert)
      const trulyValid: ParsedServiceCatalogRowDto[] = [];
      for (const row of valid) {
        if (existingSet.has(`${row.name}|${row.category}`)) {
          duplicate.push(row);
        } else {
          trulyValid.push(row);
        }
      }
      valid.length = 0;
      valid.push(...trulyValid);
    }

    return {
      total: dataRowCount,
      valid,
      duplicate,
      invalid,
    };
  }

  /**
   * Validate 1 row → ParsedRow (valid shape) hoặc InvalidRow (errors).
   * Per PAUSE-31-06 — collect ALL errors per row, don't fail-fast.
   */
  private validateRow(
    row: ExcelJS.Row,
    rowNumber: number,
  ): ParsedServiceCatalogRowDto | InvalidServiceCatalogRowDto {
    const errors: string[] = [];

    const rawName = row.getCell(1).value;
    const rawCategory = row.getCell(2).value;
    const rawUnit = row.getCell(3).value;
    const rawPrice = row.getCell(4).value;
    const rawCost = row.getCell(5).value;
    const rawDesc = row.getCell(6).value;
    const rawSort = row.getCell(7).value;

    const name = rawName == null ? '' : String(rawName).trim();
    const categoryRaw = rawCategory == null ? '' : String(rawCategory).trim();
    const unit = rawUnit == null ? '' : String(rawUnit).trim();
    const description = rawDesc == null ? '' : String(rawDesc).trim();

    let category: ServiceCategory | null = null;
    if (!categoryRaw) {
      errors.push('Nhóm bắt buộc');
    } else {
      category = this.parseCategory(categoryRaw);
      if (!category) {
        errors.push(
          `Nhóm không hợp lệ: "${categoryRaw}" — phải là Tính giờ / Racekit / Vận hành / Chung (hoặc TIMING/RACEKIT/OPERATIONS/GENERAL).`,
        );
      }
    }

    if (!name) {
      errors.push('Tên dịch vụ bắt buộc');
    }

    const referencePrice = this.parseNumber(rawPrice, 'Giá tham khảo', errors);
    const referenceCost = this.parseNumber(rawCost, 'Giá vốn', errors);
    const sortOrder = this.parseNumber(rawSort, 'Thứ tự', errors, true);

    if (errors.length > 0) {
      return {
        rowNum: rowNumber,
        errors,
        raw: {
          name,
          category: categoryRaw,
          unit,
          referencePrice: rawPrice,
          referenceCost: rawCost,
          description,
          sortOrder: rawSort,
        },
      };
    }

    return {
      rowNum: rowNumber,
      name,
      category: category!,
      unit: unit || undefined,
      referencePrice: referencePrice ?? 0,
      referenceCost: referenceCost ?? 0,
      description: description || undefined,
      sortOrder: sortOrder ?? 0,
    };
  }

  private parseCategory(raw: string): ServiceCategory | null {
    const normalized = raw.trim().toLowerCase();
    return this.CATEGORY_MAP[normalized] ?? null;
  }

  /**
   * Parse number cell — accept number direct hoặc string parseable.
   * Empty → return 0 fallback (not error per PAUSE-31-06 — optional field).
   * Invalid (NaN, negative, non-numeric string) → push error.
   * allowNegative=true cho sortOrder (rare case but allowed).
   */
  private parseNumber(
    raw: ExcelJS.CellValue,
    fieldName: string,
    errors: string[],
    allowNegative = false,
  ): number | null {
    if (raw == null || raw === '') return 0;
    let n: number;
    if (typeof raw === 'number') {
      n = raw;
    } else if (typeof raw === 'string') {
      n = Number(raw.trim());
    } else if (typeof raw === 'object' && 'result' in raw) {
      // ExcelJS formula cell { formula, result }
      n = Number((raw as { result: unknown }).result);
    } else {
      errors.push(`${fieldName} phải là số`);
      return null;
    }
    if (Number.isNaN(n)) {
      errors.push(`${fieldName} không phải số: "${String(raw)}"`);
      return null;
    }
    if (!allowNegative && n < 0) {
      errors.push(`${fieldName} phải ≥ 0`);
      return null;
    }
    return n;
  }

  /**
   * Bulk insert validated rows. Server RE-VALIDATES duplicate trước insert
   * (race condition: admin có thể đã add cùng lúc qua individual POST).
   * Per PAUSE-31-05 createdBy = userId admin.
   * `insertMany {ordered: false}` để partial fail không break toàn batch.
   */
  async bulkInsert(
    rows: ParsedServiceCatalogRowDto[],
    userId: string,
  ): Promise<ServiceCatalogImportResultDto> {
    if (rows.length === 0) {
      return { inserted: 0, skipped_duplicate: 0, failed: 0 };
    }

    // Re-check duplicate server-side (KHÔNG trust FE preview)
    const existingPairs = await this.catalogService.findByNameCategoryPairs(
      rows.map((r) => ({ name: r.name, category: r.category })),
    );
    const existingSet = new Set(
      existingPairs.map((p) => `${p.name}|${p.category}`),
    );
    const toInsert = rows.filter(
      (r) => !existingSet.has(`${r.name}|${r.category}`),
    );
    const skipped_duplicate = rows.length - toInsert.length;

    if (toInsert.length === 0) {
      this.logger.warn('service_catalog_import_all_duplicate', {
        userId,
        total: rows.length,
        skipped_duplicate,
      });
      return { inserted: 0, skipped_duplicate, failed: 0 };
    }

    const now = new Date();
    const docs = toInsert.map((r) => ({
      name: r.name,
      category: r.category,
      unit: r.unit,
      referencePrice: r.referencePrice ?? 0,
      referenceCost: r.referenceCost ?? 0,
      description: r.description,
      sortOrder: r.sortOrder ?? 0,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    }));

    let inserted = 0;
    let failed = 0;
    try {
      const result = await this.model.insertMany(docs, { ordered: false });
      inserted = result.length;
    } catch (err) {
      // {ordered: false} → MongoServerError with insertedDocs count
      const e = err as { insertedDocs?: unknown[]; writeErrors?: unknown[] };
      inserted = Array.isArray(e.insertedDocs) ? e.insertedDocs.length : 0;
      failed = Array.isArray(e.writeErrors) ? e.writeErrors.length : 0;
      this.logger.warn('service_catalog_import_partial_fail', {
        userId,
        inserted,
        failed,
        error: (err as Error).message,
      });
    }

    this.logger.warn('service_catalog_import_done', {
      userId,
      requested: rows.length,
      inserted,
      skipped_duplicate,
      failed,
    });

    return { inserted, skipped_duplicate, failed };
  }

  /**
   * Generate Excel template Buffer cho admin download.
   * 7 columns VN headers + 1 example row + 1 note row (italic gray).
   */
  async generateTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = '5BIB';
    wb.created = new Date();
    const ws = wb.addWorksheet('Danh muc dich vu');

    ws.columns = [
      { header: 'Tên dịch vụ', key: 'name', width: 35 },
      { header: 'Nhóm', key: 'category', width: 15 },
      { header: 'ĐVT', key: 'unit', width: 12 },
      { header: 'Giá tham khảo', key: 'referencePrice', width: 18 },
      { header: 'Giá vốn', key: 'referenceCost', width: 18 },
      { header: 'Mô tả', key: 'description', width: 50 },
      { header: 'Thứ tự', key: 'sortOrder', width: 10 },
    ];
    // Bold + freeze header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Example row
    ws.addRow({
      name: 'Timing chip RFID',
      category: 'Tính giờ',
      unit: 'vé',
      referencePrice: 50000,
      referenceCost: 35000,
      description: 'Chip dùng cho race ≤ 5000 athletes',
      sortOrder: 1,
    });

    // Note row (merged + italic gray)
    const noteRowNum = 3;
    ws.addRow({
      name:
        '↑ Xóa row example này trước khi import. Nhóm chấp nhận: Tính giờ / Racekit / Vận hành / Chung (hoặc TIMING/RACEKIT/OPERATIONS/GENERAL — không phân biệt hoa thường).',
    });
    ws.mergeCells(`A${noteRowNum}:G${noteRowNum}`);
    const noteCell = ws.getCell(`A${noteRowNum}`);
    noteCell.font = { italic: true, color: { argb: 'FF888888' } };
    noteCell.alignment = { wrapText: true, vertical: 'middle' };
    ws.getRow(noteRowNum).height = 40;

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
