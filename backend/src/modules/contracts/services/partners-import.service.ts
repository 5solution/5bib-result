import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { Partner, PartnerDocument } from '../schemas/partner.schema';
import { PartnersService } from './partners.service';
import {
  InvalidPartnerRowDto,
  ParsedPartnerRowDto,
  PartnerImportPreviewDto,
  PartnerImportResultDto,
} from '../dto/import-partner.dto';

/**
 * FEATURE-032 — Partner Excel Import Service (mirror F-031 ServiceCatalogImport).
 *
 * Pipeline: parseExcel → validate per-row → check duplicates (dual-key) → preview
 *           confirm → re-validate server-side → insertMany {ordered:false}
 *
 * Reuse ExcelJS, FileInterceptor, LogtoStaffGuard, pattern proven F-031.
 *
 * 7 PAUSE-32-* compliance:
 * - 31-01 Excel 11 cols VN headers
 * - 32-02 Dedup dual-key (taxId primary + entityName fallback) Skip+report
 * - 32-03 2-step preview→confirm
 * - 32-04 Max 200 rows per import
 * - 32-05 createdBy = userId admin
 * - 32-06 Empty/invalid = per-row skip + report all errors
 * - 32-07 generateTemplate() for download button
 */
@Injectable()
export class PartnersImportService {
  private readonly logger = new Logger(PartnersImportService.name);
  private readonly MAX_ROWS = 200;

  /** Email basic regex (mirror class-validator IsEmail relaxed mode). */
  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    @InjectModel(Partner.name)
    private model: Model<PartnerDocument>,
    private partnersService: PartnersService,
  ) {}

  async parseExcel(buffer: Buffer): Promise<PartnerImportPreviewDto> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(
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

    const valid: ParsedPartnerRowDto[] = [];
    const invalid: InvalidPartnerRowDto[] = [];
    let dataRowCount = 0;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      // Skip note row (starts with "↑") or empty row
      const cellA = row.getCell(1).value;
      const aText = cellA == null ? '' : String(cellA).trim();
      if (aText.startsWith('↑') || !aText) {
        // Note: chỉ skip nếu cell A empty (entityName là required)
        if (aText.startsWith('↑')) return;
        // Empty entityName row → push invalid (per PAUSE-32-06)
      }
      dataRowCount += 1;

      if (dataRowCount > this.MAX_ROWS) {
        invalid.push({
          rowNum: rowNumber,
          errors: [
            `Vượt quá giới hạn ${this.MAX_ROWS} dòng/lần import. Tách file ra nhiều lần.`,
          ],
          raw: { A: aText },
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

    // Dual-key dedup per PAUSE-32-02
    const duplicate: ParsedPartnerRowDto[] = [];
    if (valid.length > 0) {
      const existingPairs = await this.partnersService.findByTaxIdsOrNames(
        valid.map((r) => ({ entityName: r.entityName, taxId: r.taxId })),
      );
      const existingTaxIds = new Set(
        existingPairs.filter((p) => p.taxId).map((p) => p.taxId!),
      );
      const existingNames = new Set(
        existingPairs.filter((p) => !p.taxId).map((p) => p.entityName),
      );
      // Note: existingNames chỉ chứa partner KHÔNG có taxId. Để dedup row mới
      // có taxId trùng entityName của partner cũ → cần check thêm entityName
      // của TẤT CẢ existing pairs.
      const allExistingNames = new Set(
        existingPairs.map((p) => p.entityName),
      );

      const trulyValid: ParsedPartnerRowDto[] = [];
      for (const row of valid) {
        // Priority: nếu row có taxId → check taxId. Nếu taxId trùng → duplicate.
        // Nếu row không có taxId → check entityName.
        let isDup = false;
        if (row.taxId && existingTaxIds.has(row.taxId)) {
          isDup = true;
        } else if (!row.taxId && allExistingNames.has(row.entityName)) {
          // Row không có taxId → dedup theo entityName exact (kể cả khớp partner có taxId — bảo thủ)
          isDup = true;
        }
        if (isDup) {
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

  private validateRow(
    row: ExcelJS.Row,
    rowNumber: number,
  ): ParsedPartnerRowDto | InvalidPartnerRowDto {
    const errors: string[] = [];

    const rawEntityName = row.getCell(1).value;
    const rawShortName = row.getCell(2).value;
    const rawTaxId = row.getCell(3).value;
    const rawAddress = row.getCell(4).value;
    const rawRepresentative = row.getCell(5).value;
    const rawPosition = row.getCell(6).value;
    const rawBankAccount = row.getCell(7).value;
    const rawBankName = row.getCell(8).value;
    const rawPhone = row.getCell(9).value;
    const rawEmail = row.getCell(10).value;
    const rawNotes = row.getCell(11).value;

    const entityName = rawEntityName == null ? '' : String(rawEntityName).trim();
    const shortName = rawShortName == null ? '' : String(rawShortName).trim();
    const taxId = rawTaxId == null ? '' : String(rawTaxId).trim();
    const address = rawAddress == null ? '' : String(rawAddress).trim();
    const representative =
      rawRepresentative == null ? '' : String(rawRepresentative).trim();
    const position = rawPosition == null ? '' : String(rawPosition).trim();
    const bankAccount =
      rawBankAccount == null ? '' : String(rawBankAccount).trim();
    const bankName = rawBankName == null ? '' : String(rawBankName).trim();
    const phone = rawPhone == null ? '' : String(rawPhone).trim();
    const email = rawEmail == null ? '' : String(rawEmail).trim();
    const notes = rawNotes == null ? '' : String(rawNotes).trim();

    if (!entityName) {
      errors.push('Tên đối tác bắt buộc');
    }

    // Email strict IsEmail (mirror F-024 CreatePartnerDto)
    if (email && !this.EMAIL_RE.test(email)) {
      errors.push(`Email không hợp lệ: "${email}"`);
    }

    if (errors.length > 0) {
      return {
        rowNum: rowNumber,
        errors,
        raw: {
          entityName,
          shortName,
          taxId,
          address,
          representative,
          position,
          bankAccount,
          bankName,
          phone,
          email,
          notes,
        },
      };
    }

    return {
      rowNum: rowNumber,
      entityName,
      shortName: shortName || undefined,
      taxId: taxId || undefined,
      address: address || undefined,
      representative: representative || undefined,
      position: position || undefined,
      bankAccount: bankAccount || undefined,
      bankName: bankName || undefined,
      phone: phone || undefined,
      email: email || undefined,
      notes: notes || undefined,
    };
  }

  /**
   * Bulk insert validated rows. Server RE-VALIDATES duplicate trước insert
   * (race: admin có thể đã add cùng lúc qua individual POST).
   * Per PAUSE-32-05 createdBy = userId admin.
   * `insertMany {ordered: false}` để partial fail không break batch.
   */
  async bulkInsert(
    rows: ParsedPartnerRowDto[],
    userId: string,
  ): Promise<PartnerImportResultDto> {
    if (rows.length === 0) {
      return { inserted: 0, skipped_duplicate: 0, failed: 0 };
    }

    // Re-check duplicate server-side (mirror F-031 TC-IM-09 race mitigation)
    const existingPairs = await this.partnersService.findByTaxIdsOrNames(
      rows.map((r) => ({ entityName: r.entityName, taxId: r.taxId })),
    );
    const existingTaxIds = new Set(
      existingPairs.filter((p) => p.taxId).map((p) => p.taxId!),
    );
    const allExistingNames = new Set(
      existingPairs.map((p) => p.entityName),
    );

    const toInsert = rows.filter((r) => {
      if (r.taxId && existingTaxIds.has(r.taxId)) return false;
      if (!r.taxId && allExistingNames.has(r.entityName)) return false;
      return true;
    });
    const skipped_duplicate = rows.length - toInsert.length;

    if (toInsert.length === 0) {
      this.logger.warn('partners_import_all_duplicate', {
        userId,
        total: rows.length,
        skipped_duplicate,
      });
      return { inserted: 0, skipped_duplicate, failed: 0 };
    }

    const now = new Date();
    const docs = toInsert.map((r) => ({
      entityName: r.entityName,
      shortName: r.shortName,
      taxId: r.taxId,
      address: r.address,
      representative: r.representative,
      position: r.position,
      bankAccount: r.bankAccount,
      bankName: r.bankName,
      phone: r.phone,
      email: r.email,
      notes: r.notes,
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
      const e = err as { insertedDocs?: unknown[]; writeErrors?: unknown[] };
      inserted = Array.isArray(e.insertedDocs) ? e.insertedDocs.length : 0;
      failed = Array.isArray(e.writeErrors) ? e.writeErrors.length : 0;
      this.logger.warn('partners_import_partial_fail', {
        userId,
        inserted,
        failed,
        error: (err as Error).message,
      });
    }

    this.logger.warn('partners_import_done', {
      userId,
      requested: rows.length,
      inserted,
      skipped_duplicate,
      failed,
    });

    return { inserted, skipped_duplicate, failed };
  }

  /** Generate Excel template — 11 cols VN headers + 1 example + note row. */
  async generateTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = '5BIB';
    wb.created = new Date();
    const ws = wb.addWorksheet('Doi tac');

    ws.columns = [
      { header: 'Tên đối tác', key: 'entityName', width: 35 },
      { header: 'Tên viết tắt', key: 'shortName', width: 18 },
      { header: 'Mã số thuế', key: 'taxId', width: 18 },
      { header: 'Địa chỉ', key: 'address', width: 50 },
      { header: 'Người đại diện', key: 'representative', width: 25 },
      { header: 'Chức vụ', key: 'position', width: 18 },
      { header: 'Số tài khoản', key: 'bankAccount', width: 22 },
      { header: 'Ngân hàng', key: 'bankName', width: 25 },
      { header: 'Điện thoại', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Ghi chú', key: 'notes', width: 40 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    ws.addRow({
      entityName: 'Công ty TNHH ABC',
      shortName: 'ABC',
      taxId: '0123456789',
      address: 'Số 1 đường XYZ, Quận 1, TP. Hồ Chí Minh',
      representative: 'Nguyễn Văn A',
      position: 'Giám đốc',
      bankAccount: '111000222',
      bankName: 'Vietcombank - CN HCM',
      phone: '0901234567',
      email: 'contact@abc.vn',
      notes: 'Sponsor diamond race XYZ 2026',
    });

    const noteRowNum = 3;
    ws.addRow({
      entityName:
        '↑ Xóa row example này trước khi import. Tên đối tác là bắt buộc. Email phải đúng format (vd: a@b.com). Trùng MST hoặc Tên đối tác sẽ bỏ qua.',
    });
    ws.mergeCells(`A${noteRowNum}:K${noteRowNum}`);
    const noteCell = ws.getCell(`A${noteRowNum}`);
    noteCell.font = { italic: true, color: { argb: 'FF888888' } };
    noteCell.alignment = { wrapText: true, vertical: 'middle' };
    ws.getRow(noteRowNum).height = 40;

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
