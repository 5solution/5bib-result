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
import { VolStation } from '../entities/vol-station.entity';
import { VN_BANKS } from '../constants/banks';
import {
  canonEmail,
  parseDateInput,
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
import { TeamStationService } from './team-station.service';
import { MailService } from 'src/modules/notification/mail.service';
import { env } from 'src/config';

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
  'birth_date',
  'cccd_issue_date',
  'cccd_issue_place',
  'address',
  'shirt_size',
  'bank_account_number',
  'bank_holder_name',
  'bank_name',
  'bank_branch',
  'experience',
  'expertise',
  'notes',
  'avatar_photo',
  'cccd_photo',
  'cccd_back_photo',
  // v1.6: optional station assignment columns.
  'station_id',
  'station_name',
  'assignment_role',
];

// v1.8: the entity enum has been dropped (derive from registration.role.is_leader_role).
// The import template still surfaces this column for operator convenience, but
// the value is NOT persisted on the assignment anymore — only used during
// import validation to warn when it mismatches the row's role.
type ImportAssignmentRole = 'crew' | 'volunteer';
const ASSIGNMENT_ROLE_VALUES: ReadonlyArray<ImportAssignmentRole> = ['crew', 'volunteer'];

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
  // v1.6 station assignment (optional). Only set when station_id column
  // was provided and validation passed. Carried into confirm step so we
  // can call TeamStationService.createAssignment after the reg lands.
  resolved_station_id: number | null;
  resolved_assignment_role: ImportAssignmentRole | null;
}

interface CachedImport {
  event_id: number;
  rows: CachedRow[];
  created_at: number;
}

/**
 * v037+ — Walks a registration and returns dynamic sections of missing
 * fields. Used to compose the welcome email after import, and the banner
 * on the crew portal status page (`?missing=cccd,bank,...`).
 *
 * Sections are dropped entirely if all their items are present — keeps
 * email tidy when admin Excel had most fields filled.
 */
export function computeMissingSections(
  reg: VolRegistration,
): Array<{ tag: string; title: string; items: string[] }> {
  const fd = (reg.form_data ?? {}) as Record<string, unknown>;
  const isStr = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

  const personal: string[] = [];
  if (!reg.birth_date) personal.push('Ngày sinh');
  if (!isStr(fd.cccd)) personal.push('Số CCCD/CMND');
  if (!reg.cccd_issue_date) personal.push('Ngày cấp CCCD');
  if (!reg.cccd_issue_place) personal.push('Nơi cấp CCCD');
  if (!isStr(fd.address)) personal.push('Địa chỉ thường trú');

  const photos: string[] = [];
  if (!reg.cccd_photo_url) photos.push('Ảnh CCCD/CMND mặt trước');
  if (!reg.cccd_back_photo_url) photos.push('Ảnh CCCD/CMND mặt sau');
  if (!reg.avatar_photo_url) photos.push('Ảnh chân dung');

  const bank: string[] = [];
  if (!isStr(fd.bank_account_number)) bank.push('Số tài khoản ngân hàng');
  if (!isStr(fd.bank_holder_name)) bank.push('Tên chủ tài khoản');
  if (!isStr(fd.bank_name)) bank.push('Ngân hàng');

  const other: string[] = [];
  if (!reg.shirt_size) other.push('Size áo');

  const out: Array<{ tag: string; title: string; items: string[] }> = [];
  if (personal.length) out.push({ tag: 'personal', title: '📋 THÔNG TIN CÁ NHÂN (cần cho hợp đồng)', items: personal });
  if (photos.length) out.push({ tag: 'photo', title: '📷 ẢNH (bắt buộc)', items: photos });
  if (bank.length) out.push({ tag: 'bank', title: '💳 THÔNG TIN THANH TOÁN', items: bank });
  if (other.length) out.push({ tag: 'other', title: '👕 KHÁC', items: other });
  return out;
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
    @InjectRepository(VolStation, 'volunteer')
    private readonly stationRepo: Repository<VolStation>,
    @InjectRedis() private readonly redis: Redis,
    private readonly registrationSvc: TeamRegistrationService,
    private readonly contractSvc: TeamContractService,
    private readonly cache: TeamCacheService,
    private readonly stationSvc: TeamStationService,
    private readonly mail: MailService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // TEMPLATE
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Build an XLSX template with 4 sheets:
   *   1) "Rows" — import columns + one example row + dropdown validations
   *   2) "Roles" — role reference (id, name, rate, slots) for this event
   *   3) "Banks" — allowed VN_BANKS values for the bank_name dropdown
   *   4) "Stations" — v1.6 reference sheet: station_id + role info so admin
   *      can match a TNV to a trạm directly at import time.
   */
  async generateTemplateXlsx(eventId: number): Promise<Buffer> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event không tồn tại');

    const roles = await this.roleRepo.find({
      where: { event_id: eventId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });

    // v1.8: stations belong to team categories (not roles). Display category name.
    const rolesById = new Map<number, VolRole>();
    for (const r of roles) rolesById.set(r.id, r);
    const stationsRaw = await this.stationRepo.find({
      where: { event_id: eventId },
      relations: { category: true },
      order: { category_id: 'ASC', sort_order: 'ASC', id: 'ASC' },
    });
    const stations = stationsRaw
      .map((s) => ({
        id: s.id,
        station_name: s.station_name,
        category_id: s.category_id,
        category_name: s.category?.name ?? `(category ${s.category_id})`,
        status: s.status,
      }))
      .sort((a, b) => a.category_name.localeCompare(b.category_name, 'vi'));
    const assignableStations = stations.filter((s) => s.status !== 'closed');

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
      // v037+ identity fields — TNV bổ sung qua portal nếu admin để trống
      { header: 'dob (DD/MM/YYYY)', key: 'dob', width: 14, required: false },
      { header: 'cccd_issue_date (DD/MM/YYYY)', key: 'cccd_issue_date', width: 18, required: false },
      { header: 'cccd_issue_place', key: 'cccd_issue_place', width: 28, required: false },
      { header: 'address', key: 'address', width: 36, required: false },
      { header: 'shirt_size', key: 'shirt_size', width: 10, required: false },
      { header: 'bank_account_number', key: 'bank_account_number', width: 22, required: false },
      { header: 'bank_holder_name', key: 'bank_holder_name', width: 28, required: false },
      { header: 'bank_name', key: 'bank_name', width: 26, required: false },
      { header: 'bank_branch', key: 'bank_branch', width: 20, required: false },
      { header: 'experience', key: 'experience', width: 40, required: false },
      { header: 'expertise', key: 'expertise', width: 40, required: false },
      { header: 'notes', key: 'notes', width: 30, required: false },
      // v1.6 station assignment columns — all optional.
      { header: 'station_id', key: 'station_id', width: 12, required: false },
      { header: 'station_name (tham khảo)', key: 'station_name', width: 28, required: false },
      { header: 'assignment_role', key: 'assignment_role', width: 16, required: false },
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
    const exampleRole = roles.find((r) => r.is_leader_role !== true) ?? roles[0];
    const exampleStation = assignableStations.find(
      (s) => s.category_id === exampleRole?.category_id,
    );
    ws.addRow({
      full_name: 'Nguyễn Văn A',
      email: 'nguyenvana@example.com',
      phone: '0901234567',
      role_id: exampleRole?.id ?? 1,
      role_name: exampleRole?.role_name ?? '(xem sheet Roles)',
      cccd: '012345678901',
      dob: '15/06/1995',
      shirt_size: 'M',
      bank_account_number: '9704123456789',
      bank_holder_name: 'NGUYEN VAN A',
      bank_name: 'Vietcombank (VCB)',
      bank_branch: 'Hà Nội',
      experience: 'Đã tham gia 3 giải',
      notes: '',
      station_id: exampleStation?.id ?? '',
      station_name: exampleStation?.station_name ?? '',
      assignment_role: exampleStation ? 'volunteer' : '',
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

    // --- Sheet 4: Stations (v1.6) ----------------------------------------
    // Reference so admin can pick the correct station_id for a TNV. Leader
    // roles are excluded (BR-STN-03 — leaders can't be assigned). Closed
    // stations are excluded too (status='closed' rejects assignment).
    const stationsWs = wb.addWorksheet('Stations');
    stationsWs.columns = [
      { header: 'id', key: 'id', width: 8 },
      { header: 'station_name', key: 'station_name', width: 30 },
      { header: 'category_id', key: 'category_id', width: 10 },
      { header: 'category_name', key: 'category_name', width: 30 },
      { header: 'status', key: 'status', width: 12 },
    ];
    stationsWs.getRow(1).font = { bold: true };
    for (const s of assignableStations) {
      stationsWs.addRow({
        id: s.id,
        station_name: s.station_name,
        category_id: s.category_id,
        category_name: s.category_name,
        status: s.status,
      });
    }

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

    // Dropdown: shirt_size (column I — after `address` column H)
    // Header index: A full_name, B email, C phone, D role_id, E role_name,
    // F cccd, G dob, H address, I shirt_size, J bank_account_number,
    // K bank_holder_name, L bank_name, M bank_branch, N experience,
    // O notes, P station_id, Q station_name, R assignment_role
    for (let r = 2; r <= maxValidationRows; r++) {
      ws.getCell(`I${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${SHIRT_SIZE_OPTIONS.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'shirt_size không hợp lệ',
        error: `Chọn: ${SHIRT_SIZE_OPTIONS.join(', ')}`,
      };
    }

    // Dropdown: bank_name (column L) → Banks!A2:A(VN_BANKS+1)
    for (let r = 2; r <= maxValidationRows; r++) {
      ws.getCell(`L${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Banks!$A$2:$A$${VN_BANKS.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'bank_name không hợp lệ',
        error: 'Chọn ngân hàng từ sheet Banks',
      };
    }

    // v1.6 Dropdown: station_id (column P) → Stations!A2:A(N+1)
    if (assignableStations.length > 0) {
      for (let r = 2; r <= maxValidationRows; r++) {
        ws.getCell(`P${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Stations!$A$2:$A$${assignableStations.length + 1}`],
          showErrorMessage: true,
          errorTitle: 'station_id không hợp lệ',
          error:
            'Chọn một station_id từ sheet Stations (role_id phải khớp cột D)',
        };
      }
    }

    // v1.6 Dropdown: assignment_role (column R) — inline enum
    for (let r = 2; r <= maxValidationRows; r++) {
      ws.getCell(`R${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${ASSIGNMENT_ROLE_VALUES.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'assignment_role không hợp lệ',
        error: `Chọn: ${ASSIGNMENT_ROLE_VALUES.join(', ')}`,
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

    // v1.6: load all stations for this event for station_id resolution.
    const stations = await this.stationRepo.find({
      where: { event_id: eventId },
    });
    const stationsById = new Map<number, VolStation>();
    for (const s of stations) stationsById.set(s.id, s);

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
      // dob: accept dd/mm/yyyy (Vietnamese) or yyyy-mm-dd (ISO).
      // Normalize to YYYY-MM-DD for DB storage regardless of input format.
      const dobRaw = String(raw.dob ?? '').trim();
      const dob = parseDateInput(dobRaw) ?? dobRaw;
      const shirt_size = String(raw.shirt_size ?? '').trim().toUpperCase();
      const bank_account_number = String(raw.bank_account_number ?? '').trim();
      const bank_holder_name = String(raw.bank_holder_name ?? '').trim();
      const bank_name = String(raw.bank_name ?? '').trim();
      const bank_branch = String(raw.bank_branch ?? '').trim();
      const experience = String(raw.experience ?? '').trim();
      const notes = String(raw.notes ?? '').trim();

      // Core fields — full_name + email bắt buộc valid (email cần unique).
      push(errors, validateFullName(full_name));
      push(errors, validateEmail(email));
      // v037+ Danny request: phone format → WARNING (TNV bổ sung qua portal).
      push(warnings, validatePhoneVN(phone));

      // v037+ — Role resolution với 2-step fallback:
      //   1. Try role_id (numeric column). Nếu OK → use.
      //   2. Nếu role_id sai/empty, try role_name. Nếu OK → use + warn.
      //   3. Nếu cả 2 fail → hard error (FK target missing, không thể insert).
      // Đây là smart fallback giúp admin import file template từ event khác
      // (role_id stale) miễn là role_name khớp với role hiện tại.
      const rawRoleId = String(raw.role_id ?? '').trim();
      const rawRoleName = String(raw.role_name ?? '').trim();
      let resolved_role_id: number | null = null;
      if (rawRoleId) {
        const tryById = resolveRoleRef(rawRoleId, rolesById, roleIdByNameLower);
        if (tryById.id) {
          resolved_role_id = tryById.id;
        } else if (rawRoleName) {
          // role_id sai, fall back to role_name.
          const tryByName = resolveRoleRef(rawRoleName, rolesById, roleIdByNameLower);
          if (tryByName.id) {
            resolved_role_id = tryByName.id;
            warnings.push(
              `${tryById.error ?? `role_id=${rawRoleId} sai`} — fallback theo role_name "${rawRoleName}"`,
            );
          } else {
            errors.push(`Cả role_id=${rawRoleId} và role_name="${rawRoleName}" đều không tồn tại trong event`);
          }
        } else {
          errors.push(tryById.error ?? `role_id=${rawRoleId} không tồn tại trong event`);
        }
      } else if (rawRoleName) {
        const tryByName = resolveRoleRef(rawRoleName, rolesById, roleIdByNameLower);
        if (tryByName.id) {
          resolved_role_id = tryByName.id;
        } else {
          errors.push(tryByName.error ?? `Vai trò "${rawRoleName}" không tìm thấy`);
        }
      } else {
        errors.push('Thiếu vai trò (role_id hoặc role_name)');
      }
      const role = resolved_role_id ? rolesById.get(resolved_role_id) : undefined;

      // v037+ Danny request: tất cả validation về data shape (CCCD format,
      // DOB, shirt size, bank info) đều là WARNING — KHÔNG block import.
      // TNV nhận welcome email với danh sách field cần bổ sung/sửa qua portal.
      // Hard errors chỉ giữ cho: missing full_name, invalid email, role
      // không tồn tại, role full + không waitlist (operational blockers).
      push(warnings, validateCCCD(cccd, false));
      push(warnings, validateDob(dob, false));
      const shirtOpts = fieldOptions(role, 'shirt_size') ?? [...SHIRT_SIZE_OPTIONS];
      push(warnings, validateShirtSize(shirt_size, false, shirtOpts));
      push(warnings, validateBankAccount(bank_account_number));
      push(warnings, validateBankName(bank_name));
      if (bank_account_number) {
        push(warnings, validateBankHolderName(bank_holder_name, full_name));
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

      // v1.6 — optional station assignment columns.
      const stationIdRaw = String(raw.station_id ?? '').trim();
      const assignmentRoleRaw = String(raw.assignment_role ?? '')
        .trim()
        .toLowerCase();
      let resolved_station_id: number | null = null;
      let resolved_assignment_role: ImportAssignmentRole | null = null;

      if (stationIdRaw) {
        const sid = Number.parseInt(stationIdRaw, 10);
        if (!Number.isFinite(sid) || sid <= 0) {
          errors.push(`station_id không hợp lệ: "${stationIdRaw}"`);
        } else {
          const station = stationsById.get(sid);
          if (!station) {
            // Spec: warning (not error) — user needs to create station first.
            warnings.push(
              `Trạm #${sid} chưa tồn tại — tạo trạm trước rồi import lại để gán`,
            );
          } else {
            // v1.8: stations belong to team categories (not roles). The row's
            // role must be in the same category as the station.
            const rowRole =
              resolved_role_id !== null
                ? rolesById.get(resolved_role_id)
                : null;
            const rowCategoryId = rowRole?.category_id ?? null;
            if (
              rowCategoryId !== null &&
              station.category_id !== rowCategoryId
            ) {
              errors.push(
                `station_id=${sid} thuộc team ${station.category_id}, không khớp team của role_id=${resolved_role_id} (team=${rowCategoryId})`,
              );
            } else if (station.status === 'closed') {
              errors.push(`Trạm #${sid} đã đóng — không thể gán thêm`);
            } else {
              resolved_station_id = station.id;
            }
          }
        }
      }

      if (assignmentRoleRaw) {
        if (assignmentRoleRaw !== 'crew' && assignmentRoleRaw !== 'volunteer') {
          errors.push(
            `assignment_role phải là "crew" hoặc "volunteer" (nhận: "${assignmentRoleRaw}")`,
          );
        } else if (!stationIdRaw) {
          warnings.push(
            'assignment_role được set nhưng không có station_id — sẽ bỏ qua',
          );
        } else {
          resolved_assignment_role = assignmentRoleRaw as ImportAssignmentRole;
        }
      } else if (resolved_station_id !== null) {
        // Default when station_id provided but assignment_role empty.
        resolved_assignment_role = 'volunteer';
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
          // v1.6 — echo the resolved station so the preview UI can show
          // it in the diff table. Null when no station was provided.
          station_id: resolved_station_id,
          station_name: resolved_station_id
            ? stationsById.get(resolved_station_id)?.station_name ?? ''
            : '',
          assignment_role: resolved_assignment_role,
        },
        errors,
        warnings,
        valid: isValid,
        duplicate_kind: duplicate_kind ?? 'none',
        resolved_role_id,
        email_canon: email,
        resolved_station_id,
        resolved_assignment_role,
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
    let assigned = 0;

    // v1.6: only registrations past the approval gate may be station-assigned.
    const POST_APPROVE_STATUSES = new Set([
      'approved',
      'contract_sent',
      'contract_signed',
      'qr_sent',
      'checked_in',
      'completed',
    ]);

    for (const r of toProcess) {
      const data = r.data as Record<string, unknown>;
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
        'birth_date',
        'cccd_issue_date',
        'cccd_issue_place',
        'address',
        'shirt_size',
        'bank_account_number',
        'bank_holder_name',
        'bank_name',
        'bank_branch',
        'experience',
        'expertise',
      ];
      for (const k of passthrough) {
        const v = data[k];
        if (v != null && String(v).length > 0) form_data[k] = String(v);
      }

      const fullName = String(data.full_name ?? '');
      const emailStr = String(data.email ?? '');
      const phoneStr = String(data.phone ?? '');
      const notesStr = String(data.notes ?? '');

      try {
        const result = await this.registrationSvc.adminManualRegister(
          {
            role_id: roleId,
            full_name: fullName,
            email: emailStr,
            phone: phoneStr,
            form_data,
            auto_approve: autoApprove,
            notes: notesStr || `Imported by ${adminIdentity} (row ${r.row_num})`,
          },
          adminIdentity,
          // Bulk import: TNV fills the rest later via the welcome-email
          // magic link (computeMissingSections lists what's missing). Skip
          // ALL required fields, not just photos — Excel template often
          // omits cccd_issue_*, address, birth_date for staff records.
          { skipAllRequired: true },
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

        // v1.6 — station assignment (best-effort, non-fatal).
        if (r.resolved_station_id && r.resolved_assignment_role) {
          if (!POST_APPROVE_STATUSES.has(result.status)) {
            // auto_approve=false → registration lands in pending_approval →
            // BR-STN-02 blocks assignment. Warn and skip.
            errors.push(
              `Dòng ${r.row_num}: registration #${result.id} chưa qua approval (status="${result.status}") — bỏ qua gán trạm. Bật auto_approve hoặc approve thủ công rồi gán sau.`,
            );
          } else {
            try {
              // v1.8: assignment_role no longer persisted on assignment —
              // supervisor-vs-worker derives from registration.role.is_leader_role.
              // The import column is kept for operator-side classification but
              // not forwarded to createAssignment.
              await this.stationSvc.createAssignment(r.resolved_station_id, {
                registration_id: result.id,
                note: null,
              });
              assigned += 1;
            } catch (assignErr) {
              const am =
                (assignErr as Error).message || 'unknown assignment error';
              errors.push(
                `Dòng ${r.row_num}: reg #${result.id} tạo OK nhưng gán trạm thất bại — ${am}`,
              );
            }
          }
        }
      } catch (err) {
        const msg = (err as Error).message || 'unknown error';
        // v037+ debug: log full error so admin can debug import failures.
        // Without this, "errors=N" in the summary is opaque.
        this.logger.warn(
          `Import row ${r.row_num} fail: ${msg} (email=${data.email}, role=${roleId})`,
        );
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
      `REG_IMPORT admin=${adminIdentity} event=${eventId} inserted=${inserted_ids.length} assigned=${assigned} skipped=${skipped} errors=${errors.length}`,
    );

    // v037+ — Welcome email (opt-in default true). Throttle 20 per second
    // to stay under Mailchimp tier limits when admin imports 200+ rows.
    const sendWelcome = dto.send_welcome_email ?? true;
    if (sendWelcome && inserted_ids.length > 0) {
      void this.sendWelcomeEmailsBatch(inserted_ids, eventId).catch((err) =>
        this.logger.warn(`Welcome email batch failed: ${(err as Error).message}`),
      );
    }

    return {
      inserted: inserted_ids.length,
      skipped,
      inserted_ids,
      errors,
      assigned,
    };
  }

  /**
   * Resend the import-welcome email for a single registration. Used when
   * admin clicks "Gửi lại lời mời" on registration detail. Reuses same
   * magic_token (intentional — same TNV; switching the token would break
   * any earlier links they bookmarked).
   */
  async resendImportInvite(regId: number, adminIdentity: string): Promise<void> {
    const reg = await this.regRepo.findOne({
      where: { id: regId },
      relations: { role: true, event: true },
    });
    if (!reg) throw new BadRequestException('Registration not found');
    if (!reg.event) throw new BadRequestException('Event not loaded');

    const missing = computeMissingSections(reg);
    if (missing.length === 0) {
      throw new BadRequestException(
        'TNV đã có đầy đủ thông tin — không cần gửi lại lời mời',
      );
    }
    const startDate = new Date(reg.event.event_start_date);
    const deadline = new Date(startDate.getTime() - 24 * 3600 * 1000);
    const magicLink = `${env.teamManagement.crewBaseUrl}/status/${reg.magic_token}?missing=${missing.map((s) => s.tag).join(',')}`;
    await this.mail.sendTeamImportedWelcome({
      toEmail: reg.email,
      fullName: reg.full_name,
      eventName: reg.event.event_name,
      roleName: reg.role?.role_name ?? '',
      magicLink,
      deadline: deadline.toLocaleDateString('vi-VN'),
      missingSections: missing.map(({ title, items }) => ({ title, items })),
      contactEmail: reg.event.contact_email,
      contactPhone: reg.event.contact_phone,
    });
    this.logger.log(`RESEND_INVITE admin=${adminIdentity} reg=${regId}`);
  }

  /**
   * v037+ — Send welcome email to imported TNV with dynamic list of missing
   * fields. Best-effort, fire-and-forget — runs in background after confirm
   * response is returned. Throttled 20 emails/second to avoid Mailchimp 429.
   */
  private async sendWelcomeEmailsBatch(
    regIds: number[],
    eventId: number,
  ): Promise<void> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) return;
    // Deadline = event_start_date - 24h, fallback to event_start_date.
    const startDate = new Date(event.event_start_date);
    const deadline = new Date(startDate.getTime() - 24 * 3600 * 1000);
    const deadlineStr = deadline.toLocaleDateString('vi-VN');

    const BATCH = 20;
    for (let i = 0; i < regIds.length; i += BATCH) {
      const chunk = regIds.slice(i, i + BATCH);
      const regs = await this.regRepo.find({
        where: chunk.map((id) => ({ id })),
        relations: { role: true },
      });
      await Promise.all(
        regs.map(async (reg) => {
          const missing = computeMissingSections(reg);
          if (missing.length === 0) return; // nothing to ask, skip email.
          const magicLink = `${env.teamManagement.crewBaseUrl}/status/${reg.magic_token}?missing=${missing.map((s) => s.tag).join(',')}`;
          await this.mail
            .sendTeamImportedWelcome({
              toEmail: reg.email,
              fullName: reg.full_name,
              eventName: event.event_name,
              roleName: reg.role?.role_name ?? '',
              magicLink,
              deadline: deadlineStr,
              missingSections: missing.map(({ title, items }) => ({ title, items })),
              contactEmail: event.contact_email,
              contactPhone: event.contact_phone,
            })
            .catch((err) =>
              this.logger.warn(
                `Welcome email reg=${reg.id} failed: ${(err as Error).message}`,
              ),
            );
        }),
      );
      // Throttle: 1 second between batches.
      if (i + BATCH < regIds.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    this.logger.log(
      `WELCOME_BATCH event=${eventId} sent=${regIds.length}`,
    );
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
