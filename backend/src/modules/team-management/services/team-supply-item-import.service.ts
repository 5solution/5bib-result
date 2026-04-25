import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';

import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import { VolSupplyItem } from '../entities/vol-supply-item.entity';
import {
  ImportSupplyItemsResponseDto,
  ImportSupplyItemsRowErrorDto,
  ImportSupplyItemsRowInsertedDto,
  ImportSupplyItemsRowSkippedDto,
} from '../dto/import-supply-items.dto';
import { TeamCacheService } from './team-cache.service';

const MAX_ROWS = 500;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const CSV_MIMETYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
]);
const XLSX_MIMETYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const REQUIRED_HEADERS = ['item_name', 'unit'];
const KNOWN_HEADERS = ['item_name', 'unit', 'sort_order', 'owner_role_name'];

type RawRow = Record<string, string>;

/**
 * v1.8.1 — Supply items bulk import.
 *
 * Admin-only. Single-step (upload → insert + return summary). Unlike
 * registrations the schema is flat and duplicate rules are trivial, so
 * we skip the preview/confirm handshake. Admin can re-upload if needed.
 *
 * Ownership:
 *  - `owner_role_name` blank → admin-owned (`created_by_role_id = null`).
 *  - `owner_role_name` = case-insensitive match to an existing leader role
 *    in the event → `created_by_role_id = role.id`. Non-matching rows are
 *    rejected with an error so silent fallthrough can't mask typos.
 */
@Injectable()
export class TeamSupplyItemImportService {
  private readonly logger = new Logger(TeamSupplyItemImportService.name);

  constructor(
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolSupplyItem, 'volunteer')
    private readonly itemRepo: Repository<VolSupplyItem>,
    private readonly cache: TeamCacheService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // TEMPLATE
  // ─────────────────────────────────────────────────────────────────────

  async generateTemplateXlsx(eventId: number): Promise<Buffer> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event không tồn tại');

    const roles = await this.roleRepo.find({
      where: { event_id: eventId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    const leaderRoles = roles.filter((r) => r.is_leader_role);

    const wb = new ExcelJS.Workbook();
    wb.creator = '5BIB Team Management';
    wb.created = new Date();

    // --- Sheet 1: Rows ---------------------------------------------------
    const ws = wb.addWorksheet('Rows');
    const columns: Array<{
      header: string;
      key: string;
      width: number;
      required: boolean;
    }> = [
      { header: 'item_name *', key: 'item_name', width: 32, required: true },
      { header: 'unit *', key: 'unit', width: 12, required: true },
      { header: 'sort_order', key: 'sort_order', width: 12, required: false },
      {
        header: 'owner_role_name (để trống = admin)',
        key: 'owner_role_name',
        width: 32,
        required: false,
      },
    ];
    ws.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width,
    }));

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.height = 22;
    columns.forEach((c, idx) => {
      if (c.required) {
        const cell = headerRow.getCell(idx + 1);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFB91C1C' },
        };
      }
    });

    // Example rows — two so admin sees both admin-owned and leader-owned.
    const exampleLeader = leaderRoles[0];
    ws.addRow({
      item_name: 'Nước suối (chai 500ml)',
      unit: 'chai',
      sort_order: 10,
      owner_role_name: '',
    });
    ws.addRow({
      item_name: 'Chuối',
      unit: 'quả',
      sort_order: 20,
      owner_role_name: exampleLeader?.role_name ?? '',
    });
    ws.getRow(2).font = { italic: true, color: { argb: 'FF6B7280' } };
    ws.getRow(3).font = { italic: true, color: { argb: 'FF6B7280' } };

    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // --- Sheet 2: Roles (reference) -------------------------------------
    const rolesWs = wb.addWorksheet('Roles');
    rolesWs.columns = [
      { header: 'role_name', key: 'role_name', width: 36 },
      { header: 'is_leader_role', key: 'is_leader_role', width: 16 },
    ];
    rolesWs.getRow(1).font = { bold: true };
    for (const r of roles) {
      rolesWs.addRow({
        role_name: r.role_name,
        is_leader_role: r.is_leader_role ? 'true' : 'false',
      });
    }

    // Dropdown: owner_role_name (column D) → Roles!A2:A(N+1)
    if (roles.length > 0) {
      const maxRows = 200;
      for (let r = 2; r <= maxRows; r++) {
        ws.getCell(`D${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Roles!$A$2:$A$${roles.length + 1}`],
          showErrorMessage: true,
          errorTitle: 'owner_role_name không hợp lệ',
          error: 'Chọn role từ sheet Roles hoặc để trống (admin tạo)',
        };
      }
    }

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  // ─────────────────────────────────────────────────────────────────────
  // IMPORT
  // ─────────────────────────────────────────────────────────────────────

  async importItems(
    eventId: number,
    file: Express.Multer.File | undefined,
    actorLabel: string,
  ): Promise<ImportSupplyItemsResponseDto> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event không tồn tại');

    const rawRows = this.parseFile(file);

    // Role lookup (case-insensitive by name).
    const roles = await this.roleRepo.find({ where: { event_id: eventId } });
    const roleIdByNameLower = new Map<string, number>();
    for (const r of roles) {
      roleIdByNameLower.set(r.role_name.trim().toLowerCase(), r.id);
    }

    // Existing items in this event → for DB duplicate detection.
    const existingItems = await this.itemRepo.find({
      where: { event_id: eventId },
      select: { id: true, item_name: true },
    });
    const existingNameSet = new Set(
      existingItems.map((i) => i.item_name.trim().toLowerCase()),
    );

    const inserted: ImportSupplyItemsRowInsertedDto[] = [];
    const skipped: ImportSupplyItemsRowSkippedDto[] = [];
    const errors: ImportSupplyItemsRowErrorDto[] = [];
    const seenInFile = new Set<string>();

    // Two-pass: validate + collect, then bulk-insert valid rows.
    type Candidate = {
      row: number;
      item_name: string;
      unit: string;
      sort_order: number;
      created_by_role_id: number | null;
    };
    const toInsert: Candidate[] = [];

    rawRows.forEach((raw, idx) => {
      const row = idx + 1;
      const rowErrors: string[] = [];

      const item_name = String(raw.item_name ?? '').trim();
      const unit = String(raw.unit ?? '').trim();
      const sortRaw = String(raw.sort_order ?? '').trim();
      const ownerRaw = String(raw.owner_role_name ?? '').trim();

      if (!item_name) rowErrors.push('Thiếu item_name');
      if (item_name.length > 200) rowErrors.push('item_name vượt 200 ký tự');
      if (!unit) rowErrors.push('Thiếu unit');
      if (unit.length > 50) rowErrors.push('unit vượt 50 ký tự');

      let sort_order = 0;
      if (sortRaw !== '') {
        const n = Number(sortRaw);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
          rowErrors.push('sort_order phải là số nguyên ≥ 0');
        } else {
          sort_order = n;
        }
      }

      let created_by_role_id: number | null = null;
      if (ownerRaw !== '') {
        const hit = roleIdByNameLower.get(ownerRaw.toLowerCase());
        if (hit == null) {
          rowErrors.push(`Role "${ownerRaw}" không tồn tại trong event`);
        } else {
          created_by_role_id = hit;
        }
      }

      if (rowErrors.length > 0) {
        errors.push({ row, errors: rowErrors });
        return;
      }

      const key = item_name.toLowerCase();
      if (seenInFile.has(key)) {
        skipped.push({
          row,
          item_name,
          reason: 'duplicate_in_file',
        });
        return;
      }
      seenInFile.add(key);

      if (existingNameSet.has(key)) {
        skipped.push({
          row,
          item_name,
          reason: 'duplicate_in_db',
        });
        return;
      }

      toInsert.push({
        row,
        item_name,
        unit,
        sort_order,
        created_by_role_id,
      });
    });

    // Bulk-insert one-by-one so we can report per-row IDs. Insert volume
    // is capped at MAX_ROWS (500) so sequential inserts are fine; using
    // QueryBuilder bulk insert would lose the row→id mapping we need.
    for (const c of toInsert) {
      try {
        const saved = await this.itemRepo.save(
          this.itemRepo.create({
            event_id: eventId,
            item_name: c.item_name,
            unit: c.unit,
            sort_order: c.sort_order,
            created_by_role_id: c.created_by_role_id,
          }),
        );
        inserted.push({
          row: c.row,
          id: saved.id,
          item_name: saved.item_name,
          unit: saved.unit,
        });
      } catch (err) {
        // Race guard: someone else inserted the same name between our
        // pre-check and this insert. Treat as duplicate_in_db, not error.
        const msg = (err as Error).message ?? '';
        if (/unique|duplicate/i.test(msg)) {
          skipped.push({
            row: c.row,
            item_name: c.item_name,
            reason: 'duplicate_in_db',
          });
        } else {
          errors.push({
            row: c.row,
            errors: [`Lỗi lưu DB: ${msg}`],
          });
        }
      }
    }

    if (inserted.length > 0) {
      await this.cache.invalidateSupplyItems(eventId);
    }

    this.logger.log(
      `[SUPPLY-IMPORT] event=${eventId} total=${rawRows.length} inserted=${inserted.length} skipped=${skipped.length} errors=${errors.length} by=${actorLabel}`,
    );

    return {
      total_rows: rawRows.length,
      inserted,
      skipped,
      errors,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // PARSING
  // ─────────────────────────────────────────────────────────────────────

  private parseFile(file: Express.Multer.File | undefined): RawRow[] {
    if (!file) throw new BadRequestException('Thiếu file upload');
    if (file.size > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException('File quá lớn (tối đa 2MB)');
    }

    const name = (file.originalname ?? '').toLowerCase();
    const isCsv =
      name.endsWith('.csv') || CSV_MIMETYPES.has(file.mimetype ?? '');
    const isXlsx =
      name.endsWith('.xlsx') || file.mimetype === XLSX_MIMETYPE;

    if (name.endsWith('.xls') && !name.endsWith('.xlsx')) {
      throw new BadRequestException(
        'Không hỗ trợ định dạng .xls cũ — hãy dùng .xlsx hoặc .csv',
      );
    }

    let rows: RawRow[];
    try {
      if (isXlsx) rows = this.parseXlsx(file.buffer);
      else if (isCsv) rows = this.parseCsv(file.buffer);
      else throw new BadRequestException('Chỉ hỗ trợ .csv và .xlsx');
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('File không đọc được');
    }

    if (rows.length === 0) {
      throw new BadRequestException('File không có dòng dữ liệu nào');
    }
    if (rows.length > MAX_ROWS) {
      throw new PayloadTooLargeException(
        `Tối đa ${MAX_ROWS} dòng / lần import`,
      );
    }
    return rows;
  }

  private parseCsv(buffer: Buffer): RawRow[] {
    const text = buffer.toString('utf8');
    const parsed = Papa.parse<RawRow>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) =>
        h
          .trim()
          .toLowerCase()
          .replace(/\s*\*\s*$/, '')
          .replace(/\s*\(.*?\)\s*$/, ''),
    });
    const fields = (parsed.meta.fields ?? []).map((f) => f.toLowerCase());
    this.assertHeaders(fields);
    const out: RawRow[] = [];
    for (const row of parsed.data) {
      const normalized = normalizeRow(row);
      if (hasAnyValue(normalized)) out.push(normalized);
    }
    return out;
  }

  private parseXlsx(buffer: Buffer): RawRow[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new BadRequestException('File Excel rỗng');
    const ws = wb.Sheets[sheetName];
    const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      raw: false,
    });
    if (aoa.length === 0) return [];
    const headerRow = (aoa[0] ?? []).map((h) =>
      String(h ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s*\*\s*$/, '')
        .replace(/\s*\(.*?\)\s*$/, ''),
    );
    this.assertHeaders(headerRow);

    const out: RawRow[] = [];
    for (let i = 1; i < aoa.length; i++) {
      const line = aoa[i] ?? [];
      const raw: RawRow = {};
      let hasAny = false;
      for (let j = 0; j < headerRow.length; j++) {
        const k = headerRow[j];
        if (!k) continue;
        const v = line[j] == null ? '' : String(line[j]);
        raw[k] = v;
        if (v.trim() !== '') hasAny = true;
      }
      if (hasAny) out.push(raw);
    }
    return out;
  }

  private assertHeaders(headers: string[]): void {
    const set = new Set(headers);
    for (const req of REQUIRED_HEADERS) {
      if (!set.has(req)) {
        throw new BadRequestException(`File thiếu cột bắt buộc: ${req}`);
      }
    }
    for (const h of headers) {
      if (h && !KNOWN_HEADERS.includes(h)) {
        throw new BadRequestException(
          `Cột "${h}" không được hỗ trợ. Cột hỗ trợ: ${KNOWN_HEADERS.join(', ')}`,
        );
      }
    }
  }
}

function normalizeRow(row: RawRow): RawRow {
  const out: RawRow = {};
  for (const [k, v] of Object.entries(row ?? {})) {
    out[k.toLowerCase()] = v == null ? '' : String(v);
  }
  return out;
}

function hasAnyValue(row: RawRow): boolean {
  return Object.values(row).some((v) => String(v).trim() !== '');
}
