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
import { v4 as uuidv4 } from 'uuid';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

import { VolEvent } from '../entities/vol-event.entity';
import { VolRole, FormFieldConfig } from '../entities/vol-role.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
import { VN_BANKS } from '../constants/banks';
import {
  canonEmail,
  resolveRoleRef,
  validateBankAccount,
  validateBankHolderName,
  validateBankName,
  validateCCCD,
  validateDob,
  validateEmail,
  validateFullName,
  validatePhoneVN,
  validateShirtSize,
  SHIRT_SIZE_OPTIONS,
} from '../import-helpers';
import {
  ConfirmImportRegistrationsDto,
  ConfirmImportRegistrationsResponseDto,
  ImportRegistrationsPreviewResponseDto,
  ImportRegistrationsPreviewRow,
} from '../dto/import-registrations.dto';
import { TeamRegistrationService } from './team-registration.service';
import { TeamContractService } from './team-contract.service';
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
const TOKEN_TTL_SECONDS = 10 * 60;

// All supported header columns in the import template. Lowercased — parsing
// normalizes headers to lowercase so case is flexible.
const REQUIRED_HEADERS = ['full_name', 'email', 'phone', 'role_id'];
const KNOWN_HEADERS = [
  'full_name',
  'email',
  'phone',
  'role_id',
  'role_name',
  'cccd',
  'dob',
  'shirt_size',
  'bank_account_number',
  'bank_holder_name',
  'bank_name',
  'bank_branch',
  'experience',
  'notes',
  'avatar_photo',
  'cccd_photo',
];

type RawRow = Record<string, string>;

interface CachedRow {
  row_num: number;
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  valid: boolean;
  duplicate_kind: 'none' | 'in_file' | 'in_db' | null;
  resolved_role_id: number | null;
  // Cached for confirm step — not returned to client.
  email_canon: string;
}

interface CachedImport {
  event_id: number;
  rows: CachedRow[];
  created_at: number;
}

@Injectable()
export class TeamRegistrationImportService {
  private readonly logger = new Logger(TeamRegistrationImportService.name);

  constructor(
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRedis() private readonly redis: Redis,
    private readonly registrationSvc: TeamRegistrationService,
    private readonly contractSvc: TeamContractService,
    private readonly cache: TeamCacheService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // TEMPLATE
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Build an XLSX template with 3 sheets:
   *   1) "Rows" — import columns + one example row + dropdown validations
   *   2) "Roles" — role reference (id, name, rate, slots) for this event
   *   3) "Banks" — allowed VN_BANKS values for the bank_name dropdown
   */
  async generateTemplateXlsx(eventId: number): Promise<Buffer> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event không tồn tại');

    const roles = await this.roleRepo.find({
      where: { event_id: eventId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = '5BIB Team Management';
    wb.created = new Date();

    // --- Sheet 1: Rows -----------------------------------------------------
    const ws = wb.addWorksheet('Rows');
    const columns: Array<{
      header: string;
      key: string;
      width: number;
      required: boolean;
    }> = [
      { header: 'full_name *', key: 'full_name', width: 28, required: true },
      { header: 'email *', key: 'email', width: 30, required: true },
      { header: 'phone *', key: 'phone', width: 16, required: true },
      { header: 'role_id *', key: 'role_id', width: 10, required: true },
      { header: 'role_name (tham khảo)', key: 'role_name', width: 28, required: false },
      { header: 'cccd *', key: 'cccd', width: 16, required: true },
      { header: 'dob (YYYY-MM-DD)', key: 'dob', width: 14, required: false },
      { header: 'address', key: 'address', width: 36, required: false },
      { header: 'shirt_size', key: 'shirt_size', width: 10, required: false },
      { header: 'bank_account_number', key: 'bank_account_number', width: 22, required: false },
      { header: 'bank_holder_name', key: 'bank_holder_name', width: 28, required: false },
      { header: 'bank_name', key: 'bank_name', width: 26, required: false },
      { header: 'bank_branch', key: 'bank_branch', width: 20, required: false },
      { header: 'experience', key: 'experience', width: 40, required: false },
      { header: 'notes', key: 'notes', width: 30, required: false },
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
    // Red asterisk highlight: colour the fill lighter for required columns.
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

    // One example data row (row 2) so admin sees the expected shape.
    const exampleRole = roles[0];
    ws.addRow({
      full_name: 'Nguyễn Văn A',
      email: 'nguyenvana@example.com',
      phone: '0901234567',
      role_id: exampleRole?.id ?? 1,
      role_name: exampleRole?.role_name ?? '(xem sheet Roles)',
      cccd: '012345678901',
      dob: '1995-06-15',
      shirt_size: 'M',
      bank_account_number: '9704123456789',
      bank_holder_name: 'NGUYEN VAN A',
      bank_name: 'Vietcombank (VCB)',
      bank_branch: 'Hà Nội',
      experience: 'Đã tham gia 3 giải',
      notes: '',
    });
    // Italic grey to signal example
    ws.getRow(2).font = { italic: true, color: { argb: 'FF6B7280' } };

    // Freeze the header + first example row so admins always see context.
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // --- Sheet 2: Roles ----------------------------------------------------
    const rolesWs = wb.addWorksheet('Roles');
    rolesWs.columns = [
      { header: 'id', key: 'id', width: 8 },
      { header: 'role_name', key: 'role_name', width: 36 },
      { header: 'daily_rate', key: 'daily_rate', width: 14 },
      { header: 'working_days', key: 'working_days', width: 14 },
      { header: 'max_slots', key: 'max_slots', width: 12 },
      { header: 'filled_slots', key: 'filled_slots', width: 12 },
      { header: 'waitlist_enabled', key: 'waitlist_enabled', width: 16 },
    ];
    rolesWs.getRow(1).font = { bold: true };
    for (const r of roles) {
      rolesWs.addRow({
        id: r.id,
        role_name: r.role_name,
        daily_rate: Number(r.daily_rate),
        working_days: r.working_days,
        max_slots: r.max_slots,
        filled_slots: r.filled_slots,
        waitlist_enabled: r.waitlist_enabled ? 'true' : 'false',
      });
    }

    // --- Sheet 3: Banks ----------------------------------------------------
    const banksWs = wb.addWorksheet('Banks');
    banksWs.columns = [{ header: 'bank_name', key: 'bank_name', width: 36 }];
    banksWs.getRow(1).font = { bold: true };
    for (const b of VN_BANKS) banksWs.addRow({ bank_name: b });

    // --- Data validations on Rows sheet -----------------------------------
    // Dropdown: role_id (column D) → Roles!A2:A(N+1)
    const maxValidationRows = MAX_ROWS + 5; // a bit of headroom
    if (roles.length > 0) {
      for (let r = 2; r <= maxValidationRows; r++) {
        ws.getCell(`D${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Roles!$A$2:$A$${roles.length + 1}`],
          showErrorMessage: true,
          errorTitle: 'role_id không hợp lệ',
          error: 'Chọn một role_id từ sheet Roles',
        };
      }
    }

    // Dropdown: shirt_size (column H) — inline list
    for (let r = 2; r <= maxValidationRows; r++) {
      ws.getCell(`H${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${SHIRT_SIZE_OPTIONS.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'shirt_size không hợp lệ',
        error: `Chọn: ${SHIRT_SIZE_OPTIONS.join(', ')}`,
      };
    }

    // Dropdown: bank_name (column K) → Banks!A2:A(42+1)
    for (let r = 2; r <= maxValidationRows; r++) {
      ws.getCell(`K${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Banks!$A$2:$A$${VN_BANKS.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'bank_name không hợp lệ',
        error: 'Chọn ngân hàng từ sheet Banks',
      };
    }

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  // ─────────────────────────────────────────────────────────────────────
  // PREVIEW
  // ─────────────────────────────────────────────────────────────────────

  async preview(
    eventId: number,
    file: Express.Multer.File | undefined,
  ): Promise<ImportRegistrationsPreviewResponseDto> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event không tồn tại');

    const rawRows = this.parseFile(file);

    // Load roles for this event — both by id and by lowercase role_name.
    const roles = await this.roleRepo.find({ where: { event_id: eventId } });
    const rolesById = new Map<number, VolRole>();
    const roleIdByNameLower = new Map<string, number>();
    for (const r of roles) {
      rolesById.set(r.id, r);
      roleIdByNameLower.set(r.role_name.trim().toLowerCase(), r.id);
    }

    // Load existing (email, role_id) pairs for DB duplicate detection.
    const existing = await this.regRepo
      .createQueryBuilder('r')
      .select(['r.email', 'r.role_id'])
      .where('r.event_id = :eid', { eid: eventId })
      .getMany();
    const existingKeys = new Set<string>();
    for (const e of existing) {
      existingKeys.add(`${e.email.toLowerCase()}|${e.role_id}`);
    }

    // Track duplicates inside this file.
    const seenInFile = new Map<string, number>(); // key -> first row_num
    const cached: CachedRow[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let dupInFile = 0;
    let dupInDb = 0;

    rawRows.forEach((raw, idx) => {
      const row_num = idx + 1; // 1-based data row (header excluded)
      const errors: string[] = [];
      const warnings: string[] = [];
      let duplicate_kind: 'none' | 'in_file' | 'in_db' | null = null;

      // Normalise/trim cell strings we care about.
      const full_name = String(raw.full_name ?? '').trim();
      const email = canonEmail(raw.email);
      const phone = String(raw.phone ?? '').replace(/[\s.-]/g, '');
      const cccd = String(raw.cccd ?? '').trim();
      const dob = String(raw.dob ?? '').trim();
      const shirt_size = String(raw.shirt_size ?? '').trim().toUpperCase();
      const bank_account_number = String(raw.bank_account_number ?? '').trim();
      const bank_holder_name = String(raw.bank_holder_name ?? '').trim();
      const bank_name = String(raw.bank_name ?? '').trim();
      const bank_branch = String(raw.bank_branch ?? '').trim();
      const experience = String(raw.experience ?? '').trim();
      const notes = String(raw.notes ?? '').trim();

      // Core fields
      push(errors, validateFullName(full_name));
      push(errors, validateEmail(email));
      push(errors, validatePhoneVN(phone));

      // Role resolution — either role_id or role_name column accepted.
      const roleRef = resolveRoleRef(
        raw.role_id ?? raw.role_name ?? '',
        rolesById,
        roleIdByNameLower,
      );
      const resolved_role_id = roleRef.id;
      if (roleRef.error) errors.push(roleRef.error);
      const role = resolved_role_id ? rolesById.get(resolved_role_id) : undefined;

      // Optional cells — validated if present.
      const cccdRequired = fieldRequired(role, 'cccd');
      push(errors, validateCCCD(cccd, cccdRequired));

      const dobRequired = fieldRequired(role, 'dob');
      push(errors, validateDob(dob, dobRequired));

      const shirtRequired = fieldRequired(role, 'shirt_size');
      const shirtOpts = fieldOptions(role, 'shirt_size') ?? [...SHIRT_SIZE_OPTIONS];
      push(errors, validateShirtSize(shirt_size, shirtRequired, shirtOpts));

      // Bank group
      const bankAcctRequired = fieldRequired(role, 'bank_account_number');
      if (!bank_account_number && bankAcctRequired) {
        errors.push('Thiếu số tài khoản ngân hàng');
      } else {
        push(errors, validateBankAccount(bank_account_number));
      }

      const bankNameRequired = fieldRequired(role, 'bank_name');
      if (!bank_name && bankNameRequired) {
        errors.push('Thiếu tên ngân hàng');
      } else {
        push(errors, validateBankName(bank_name));
      }

      // Holder name check only when account present.
      if (bank_account_number) {
        const holderRequired = fieldRequired(role, 'bank_holder_name');
        if (!bank_holder_name && holderRequired) {
          errors.push('Thiếu tên chủ tài khoản');
        } else {
          push(errors, validateBankHolderName(bank_holder_name, full_name));
        }
      }

      // Role capacity warnings
      if (role) {
        const isFull = role.filled_slots >= role.max_slots;
        if (isFull && role.waitlist_enabled) {
          warnings.push('Vai trò đã đầy — sẽ vào waitlist');
        } else if (isFull && !role.waitlist_enabled) {
          errors.push('Vai trò đã đầy và không nhận waitlist');
        }
      }

      // CCCD photo missing → warning (not error) — bulk import skips photos.
      if (role && fieldRequired(role, 'cccd_photo')) {
        warnings.push('Thiếu ảnh CCCD — admin cần bổ sung sau import');
      }

      // Duplicate detection — only meaningful if email + role are known.
      if (email && resolved_role_id) {
        const key = `${email}|${resolved_role_id}`;
        if (seenInFile.has(key)) {
          duplicate_kind = 'in_file';
          dupInFile += 1;
        } else {
          seenInFile.set(key, row_num);
          if (existingKeys.has(key)) {
            duplicate_kind = 'in_db';
            dupInDb += 1;
          }
        }
      }

      const isValid =
        errors.length === 0 &&
        duplicate_kind !== 'in_file' &&
        duplicate_kind !== 'in_db';
      if (isValid) validCount += 1;
      else invalidCount += 1;

      cached.push({
        row_num,
        data: {
          full_name,
          email,
          phone,
          role_id: resolved_role_id,
          role_name: role?.role_name ?? '',
          cccd,
          dob,
          shirt_size,
          bank_account_number,
          bank_holder_name,
          bank_name,
          bank_branch,
          experience,
          notes,
        },
        errors,
        warnings,
        valid: isValid,
        duplicate_kind: duplicate_kind ?? 'none',
        resolved_role_id,
        email_canon: email,
      });
    });

    // Stash in Redis for the confirm step.
    const importToken = uuidv4();
    const payload: CachedImport = {
      event_id: eventId,
      rows: cached,
      created_at: Date.now(),
    };
    try {
      await this.redis.set(
        `team:import:${importToken}`,
        JSON.stringify(payload),
        'EX',
        TOKEN_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to cache import token ${importToken}: ${(err as Error).message}`,
      );
      // Continue — confirm will 400 with "phiên hết hạn" if cache is down.
    }

    const rows: ImportRegistrationsPreviewRow[] = cached.map((r) => ({
      row_num: r.row_num,
      data: r.data,
      errors: r.errors,
      warnings: r.warnings,
      valid: r.valid,
      duplicate_kind: r.duplicate_kind,
      resolved_role_id: r.resolved_role_id ?? undefined,
    }));

    return {
      total_rows: cached.length,
      valid_count: validCount,
      invalid_count: invalidCount,
      duplicate_in_file: dupInFile,
      duplicate_in_db: dupInDb,
      rows,
      import_token: importToken,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // CONFIRM
  // ─────────────────────────────────────────────────────────────────────

  async confirmImport(
    eventId: number,
    dto: ConfirmImportRegistrationsDto,
    adminIdentity: string,
  ): Promise<ConfirmImportRegistrationsResponseDto> {
    const key = `team:import:${dto.import_token}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new BadRequestException(
        'Phiên import đã hết hạn, vui lòng tải lại file',
      );
    }
    let payload: CachedImport;
    try {
      payload = JSON.parse(raw) as CachedImport;
    } catch {
      throw new BadRequestException('Phiên import không hợp lệ');
    }
    if (payload.event_id !== eventId) {
      throw new BadRequestException('Token không khớp với event hiện tại');
    }

    const autoApprove = dto.auto_approve === true;
    const skipInvalid = dto.skip_invalid !== false; // default true for safety

    const toProcess = payload.rows.filter((r) => {
      if (r.valid) return true;
      return false; // we never insert invalid rows; skipInvalid only affects error reporting
    });

    // Guard: if user didn't set skipInvalid and there are invalids, refuse.
    const hasInvalid = payload.rows.some((r) => !r.valid);
    if (hasInvalid && !skipInvalid) {
      throw new BadRequestException(
        `Có ${payload.rows.filter((r) => !r.valid).length} dòng lỗi — bật "skip_invalid" hoặc sửa file trước khi import.`,
      );
    }

    const inserted_ids: number[] = [];
    const errors: string[] = [];
    let skipped = payload.rows.length - toProcess.length;

    for (const r of toProcess) {
      const data = r.data as Record<string, string>;
      const roleId = r.resolved_role_id;
      if (!roleId) {
        skipped += 1;
        errors.push(`Dòng ${r.row_num}: thiếu role_id sau khi resolve`);
        continue;
      }

      const form_data: Record<string, unknown> = {};
      const passthrough = [
        'cccd',
        'dob',
        'address',
        'shirt_size',
        'bank_account_number',
        'bank_holder_name',
        'bank_name',
        'bank_branch',
        'experience',
      ];
      for (const k of passthrough) {
        const v = data[k];
        if (v != null && String(v).length > 0) form_data[k] = v;
      }

      try {
        const result = await this.registrationSvc.adminManualRegister(
          {
            role_id: roleId,
            full_name: data.full_name,
            email: data.email,
            phone: data.phone,
            form_data,
            auto_approve: autoApprove,
            notes: data.notes || `Imported by ${adminIdentity} (row ${r.row_num})`,
          },
          adminIdentity,
          // Bulk import: TNV uploads photos later via self-service profile-edit
          // path. Warning was already surfaced in preview stage.
          { skipRequiredPhotos: true },
        );
        inserted_ids.push(result.id);
        // Kick off contract-send chain async if approved.
        if (autoApprove && result.status === 'approved') {
          void this.contractSvc
            .sendContractForRegistrationId(result.id)
            .catch((err) =>
              this.logger.warn(
                `import contract-send failed reg=${result.id}: ${(err as Error).message}`,
              ),
            );
        }
      } catch (err) {
        const msg = (err as Error).message || 'unknown error';
        errors.push(`Dòng ${r.row_num}: ${msg}`);
        skipped += 1;
      }
    }

    // Best-effort cache invalidation + drop the token.
    try {
      await this.cache.invalidateEvent(eventId);
      await this.redis.del(key);
    } catch {
      /* noop */
    }

    this.logger.log(
      `REG_IMPORT admin=${adminIdentity} event=${eventId} inserted=${inserted_ids.length} skipped=${skipped} errors=${errors.length}`,
    );

    return {
      inserted: inserted_ids.length,
      skipped,
      inserted_ids,
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
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s*\*\s*$/, ''),
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
    const lower = new Set(headers);
    for (const req of REQUIRED_HEADERS) {
      if (!lower.has(req)) {
        throw new BadRequestException(`File thiếu cột bắt buộc: ${req}`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────

function push(errors: string[], err: string | null): void {
  if (err) errors.push(err);
}

function fieldRequired(role: VolRole | undefined, key: string): boolean {
  if (!role || !role.form_fields) return false;
  return role.form_fields.some((f: FormFieldConfig) => f.key === key && f.required);
}

function fieldOptions(role: VolRole | undefined, key: string): string[] | null {
  if (!role || !role.form_fields) return null;
  const f = role.form_fields.find((x: FormFieldConfig) => x.key === key);
  return f?.options && f.options.length > 0 ? f.options : null;
}

function normalizeRow(row: Record<string, unknown>): RawRow {
  const out: RawRow = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.trim().toLowerCase().replace(/\s*\*\s*$/, '').replace(/\s*\(.*?\)\s*$/, '')] =
      v == null ? '' : String(v);
  }
  // Keep only known columns so a user accidentally re-using a role-import
  // sheet doesn't pollute form_data.
  const filtered: RawRow = {};
  for (const h of KNOWN_HEADERS) {
    if (out[h] !== undefined) filtered[h] = out[h];
  }
  return filtered;
}

function hasAnyValue(row: RawRow): boolean {
  for (const v of Object.values(row)) {
    if (String(v ?? '').trim() !== '') return true;
  }
  return false;
}
