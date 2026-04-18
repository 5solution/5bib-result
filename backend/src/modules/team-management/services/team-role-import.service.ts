import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import {
  ConfirmRoleImportResponseDto,
  ParsedRoleRowDto,
  ParsedRoleRowErrorDto,
  PreviewRoleImportResponseDto,
} from '../dto/role-import.dto';
import { DEFAULT_FORM_FIELDS } from '../constants/default-form-fields';
import { TeamCacheService } from './team-cache.service';

const MAX_ROWS = 200;
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB
const CSV_MIMETYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel', // Excel saves CSV with this mimetype sometimes
  'text/plain', // curl -F defaults to this for .csv
]);
const XLSX_MIMETYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const TEMPLATE_CSV = `role_name,description,max_slots,daily_rate,working_days,waitlist_enabled,sort_order
Leader - Hậu Cần,Trưởng nhóm hậu cần,2,500000,2,false,1
Crew - Hậu Cần,TNV hậu cần tại điểm xuất phát,20,300000,2,true,2
Crew - Y Tế,TNV y tế trên đường chạy,10,300000,2,false,3
`;

type RawRow = Record<string, string>;

interface NormalizedRow {
  row: number;
  raw: RawRow;
}

@Injectable()
export class TeamRoleImportService {
  private readonly logger = new Logger(TeamRoleImportService.name);

  constructor(
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    private readonly cache: TeamCacheService,
  ) {}

  generateTemplateCsv(): string {
    // Prepend UTF-8 BOM so Excel opens it with the right encoding.
    return '\uFEFF' + TEMPLATE_CSV;
  }

  async preview(
    eventId: number,
    file: Express.Multer.File | undefined,
  ): Promise<PreviewRoleImportResponseDto> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event không tồn tại');

    const rows = this.parseFile(file);

    const existingRoles = await this.roleRepo.find({
      where: { event_id: eventId },
      select: ['role_name', 'sort_order'],
    });
    const existingNamesLower = new Set(
      existingRoles.map((r) => r.role_name.trim().toLowerCase()),
    );
    const existingMaxSort = existingRoles.reduce(
      (m, r) => (r.sort_order > m ? r.sort_order : m),
      0,
    );

    const valid: ParsedRoleRowDto[] = [];
    const invalid: ParsedRoleRowErrorDto[] = [];
    // Track duplicates WITHIN this file (case-insensitive).
    const seenInFile = new Set<string>();
    let autoSortCursor = existingMaxSort;

    for (const { row, raw } of rows) {
      const errors: string[] = [];
      const role_name = (raw.role_name ?? '').trim();
      if (!role_name) {
        errors.push('role_name bắt buộc');
      } else if (role_name.length > 100) {
        errors.push('role_name tối đa 100 ký tự');
      } else {
        const lower = role_name.toLowerCase();
        if (existingNamesLower.has(lower)) {
          errors.push('Vai trò đã tồn tại trong event này');
        } else if (seenInFile.has(lower)) {
          errors.push('Vai trò bị lặp trong file');
        }
        seenInFile.add(lower);
      }

      const max_slots = parseOptionalInt(raw.max_slots);
      if (max_slots === INVALID) {
        errors.push('max_slots phải là số nguyên ≥ 1 và ≤ 9999');
      } else if (
        max_slots !== null &&
        (max_slots < 1 || max_slots > 9999)
      ) {
        errors.push('max_slots phải là số nguyên ≥ 1 và ≤ 9999');
      }

      const daily_rate_raw = parseOptionalInt(raw.daily_rate);
      let daily_rate = 0;
      if (daily_rate_raw === INVALID) {
        errors.push('daily_rate phải là số nguyên ≥ 0');
      } else if (daily_rate_raw !== null) {
        if (daily_rate_raw < 0) {
          errors.push('daily_rate phải là số nguyên ≥ 0');
        } else {
          daily_rate = daily_rate_raw;
        }
      }

      const working_days_raw = parseOptionalInt(raw.working_days);
      let working_days = 1;
      if (working_days_raw === INVALID) {
        errors.push('working_days phải là số nguyên ≥ 1');
      } else if (working_days_raw !== null) {
        if (working_days_raw < 1) {
          errors.push('working_days phải là số nguyên ≥ 1');
        } else {
          working_days = working_days_raw;
        }
      }

      const waitlist_enabled = parseBool(raw.waitlist_enabled, false);

      const sort_order_raw = parseOptionalInt(raw.sort_order);
      let sort_order: number;
      if (sort_order_raw === INVALID) {
        errors.push('sort_order phải là số nguyên ≥ 0');
        sort_order = 0;
      } else if (sort_order_raw === null) {
        autoSortCursor += 1;
        sort_order = autoSortCursor;
      } else if (sort_order_raw < 0) {
        errors.push('sort_order phải là số nguyên ≥ 0');
        sort_order = 0;
      } else {
        sort_order = sort_order_raw;
      }

      if (errors.length > 0) {
        invalid.push({ _row: row, role_name: raw.role_name ?? '', errors });
        continue;
      }

      valid.push({
        _row: row,
        role_name,
        description: (raw.description ?? '').trim() || null,
        max_slots: max_slots as number | null,
        daily_rate,
        working_days,
        waitlist_enabled,
        sort_order,
      });
    }

    return {
      total_rows: rows.length,
      valid_rows: valid,
      invalid_rows: invalid,
    };
  }

  async confirm(
    eventId: number,
    rows: ParsedRoleRowDto[],
    adminIdentity: string,
  ): Promise<ConfirmRoleImportResponseDto> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event không tồn tại');

    if (!rows || rows.length === 0) {
      throw new BadRequestException('Không có dòng nào để tạo');
    }
    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(`Vượt quá ${MAX_ROWS} vai trò`);
    }

    // Re-validate against DB (race condition protection) + re-check intrinsic
    // constraints (don't trust client).
    const existingRoles = await this.roleRepo.find({
      where: { event_id: eventId },
      select: ['role_name'],
    });
    const existingNamesLower = new Set(
      existingRoles.map((r) => r.role_name.trim().toLowerCase()),
    );

    const toInsert: VolRole[] = [];
    const seenInBatch = new Set<string>();
    let skipped = 0;

    for (const r of rows) {
      const errors: string[] = [];
      const role_name = (r.role_name ?? '').trim();
      if (!role_name || role_name.length > 100) {
        throw new BadRequestException(`Dòng ${r._row}: role_name không hợp lệ`);
      }
      const lower = role_name.toLowerCase();
      if (existingNamesLower.has(lower) || seenInBatch.has(lower)) {
        skipped += 1;
        continue;
      }
      if (
        r.max_slots != null &&
        (!Number.isInteger(r.max_slots) || r.max_slots < 1 || r.max_slots > 9999)
      ) {
        errors.push('max_slots invalid');
      }
      if (!Number.isInteger(r.daily_rate) || r.daily_rate < 0) {
        errors.push('daily_rate invalid');
      }
      if (!Number.isInteger(r.working_days) || r.working_days < 1) {
        errors.push('working_days invalid');
      }
      if (!Number.isInteger(r.sort_order) || r.sort_order < 0) {
        errors.push('sort_order invalid');
      }
      if (errors.length > 0) {
        throw new BadRequestException(
          `Dòng ${r._row}: ${errors.join(', ')}`,
        );
      }

      seenInBatch.add(lower);
      const entity = this.roleRepo.create({
        event_id: eventId,
        role_name,
        description: r.description ?? null,
        // vol_role.max_slots is non-nullable with default 0. Represent
        // "no limit" (nullable per spec) as 0 which matches the existing
        // convention in the codebase.
        max_slots: r.max_slots ?? 0,
        filled_slots: 0,
        waitlist_enabled: r.waitlist_enabled,
        auto_approve: false,
        daily_rate: String(r.daily_rate),
        working_days: r.working_days,
        form_fields: DEFAULT_FORM_FIELDS,
        contract_template_id: null,
        sort_order: r.sort_order,
      });
      toInsert.push(entity);
    }

    let saved: VolRole[] = [];
    if (toInsert.length > 0) {
      try {
        saved = await this.roleRepo.save(toInsert);
      } catch (err) {
        // Unique-key collision → fall back per-row to count skipped accurately.
        const message = (err as Error).message || '';
        if (
          message.includes('uq_role_name_event') ||
          message.includes('Duplicate entry')
        ) {
          saved = [];
          for (const entity of toInsert) {
            try {
              const s = await this.roleRepo.save(entity);
              saved.push(s);
            } catch (rowErr) {
              const msg = (rowErr as Error).message || '';
              if (
                msg.includes('uq_role_name_event') ||
                msg.includes('Duplicate entry')
              ) {
                skipped += 1;
              } else {
                throw rowErr;
              }
            }
          }
        } else {
          throw err;
        }
      }
    }

    await this.cache.invalidateEvent(
      eventId,
      saved.map((s) => s.id),
    );

    this.logger.log(
      `ROLE_IMPORT admin=${adminIdentity} eventId=${eventId} created=${saved.length} skipped=${skipped}`,
    );

    const allRoles = await this.roleRepo.find({
      where: { event_id: eventId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });

    return {
      created: saved.length,
      skipped,
      roles: allRoles,
    };
  }

  // ---------- file parsing ----------

  private parseFile(file: Express.Multer.File | undefined): NormalizedRow[] {
    if (!file) {
      throw new BadRequestException('Thiếu file upload');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File quá lớn (max 1MB)');
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
    if (isXlsx) {
      rows = this.parseXlsx(file.buffer);
    } else if (isCsv) {
      rows = this.parseCsv(file.buffer);
    } else {
      throw new BadRequestException('Chỉ hỗ trợ .csv và .xlsx');
    }

    if (rows.length === 0) {
      throw new BadRequestException('File không có dòng dữ liệu nào');
    }
    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(`Vượt quá ${MAX_ROWS} vai trò`);
    }

    // Attach 1-based row indexes (header = row 1, first data row = row 2).
    return rows.map((raw, i) => ({ row: i + 2, raw }));
  }

  private parseCsv(buffer: Buffer): RawRow[] {
    // papaparse strips UTF-8 BOM automatically and handles quoted commas.
    const text = buffer.toString('utf8');
    const parsed = Papa.parse<RawRow>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    });
    if (parsed.errors.length > 0) {
      // Some errors (e.g. TooFewFields on trailing blank line) are benign —
      // only reject on fatal errors.
      const fatal = parsed.errors.find(
        (e) => e.type === 'Quotes' || e.type === 'FieldMismatch',
      );
      if (fatal && parsed.data.length === 0) {
        throw new BadRequestException(`CSV parse lỗi: ${fatal.message}`);
      }
    }
    const fields = parsed.meta.fields ?? [];
    if (!fields.map((f) => f.toLowerCase()).includes('role_name')) {
      throw new BadRequestException('Thiếu cột bắt buộc: role_name');
    }
    return parsed.data.map((row) => normalizeRow(row));
  }

  private parseXlsx(buffer: Buffer): RawRow[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new BadRequestException('File Excel rỗng');
    const ws = wb.Sheets[sheetName];
    const aoa: string[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      raw: false,
    });
    if (aoa.length === 0) return [];
    const headerRow = (aoa[0] ?? []).map((h) => String(h ?? '').trim());
    if (!headerRow.map((h) => h.toLowerCase()).includes('role_name')) {
      throw new BadRequestException('Thiếu cột bắt buộc: role_name');
    }
    const rows: RawRow[] = [];
    for (let i = 1; i < aoa.length; i++) {
      const raw: RawRow = {};
      const line = aoa[i] ?? [];
      let hasAny = false;
      for (let j = 0; j < headerRow.length; j++) {
        const k = headerRow[j];
        const v = line[j] == null ? '' : String(line[j]);
        raw[k] = v;
        if (v.trim() !== '') hasAny = true;
      }
      if (hasAny) rows.push(normalizeRow(raw));
    }
    return rows;
  }
}

// -------- helpers --------

const INVALID = Symbol('INVALID');

function parseOptionalInt(v: unknown): number | null | typeof INVALID {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  // Only accept pure integers (no decimals, no scientific, no letters).
  if (!/^-?\d+$/.test(s)) return INVALID;
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return INVALID;
  return n;
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  if (s === '') return fallback;
  if (['1', 'true', 'yes', 'có', 'co'].includes(s)) return true;
  if (['0', 'false', 'no', 'không', 'khong'].includes(s)) return false;
  return fallback;
}

function normalizeRow(row: Record<string, unknown>): RawRow {
  const out: RawRow = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.trim().toLowerCase()] = v == null ? '' : String(v);
  }
  return out;
}
