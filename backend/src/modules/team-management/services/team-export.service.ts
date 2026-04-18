import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { env } from 'src/config';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
import { VolRole } from '../entities/vol-role.entity';
import {
  ExportResponseDto,
  PersonnelExportResponseDto,
} from '../dto/bulk-update.dto';

@Injectable()
export class TeamExportService {
  private readonly logger = new Logger(TeamExportService.name);
  private readonly bucket = env.teamManagement.s3Bucket;

  constructor(
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    private readonly s3: S3Client,
  ) {}

  /**
   * Generate a payment-report .xlsx and return a 10-min presigned URL.
   * Columns: STT | Họ tên | CCCD | SĐT | Email | Vai trò | Size áo |
   *          Ngày công thực tế | Đơn giá | Thành tiền | Ký HĐ |
   *          Check-in | Trạng thái TT
   */
  async exportPaymentReport(eventId: number): Promise<ExportResponseDto> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // v1.4: payment report includes anyone in an active pipeline state
    // (from approved onwards — excludes pending_approval, waitlisted,
    // rejected, cancelled).
    const POST_APPROVE_STATUSES: Array<
      | 'approved'
      | 'contract_sent'
      | 'contract_signed'
      | 'qr_sent'
      | 'checked_in'
      | 'completed'
    > = [
      'approved',
      'contract_sent',
      'contract_signed',
      'qr_sent',
      'checked_in',
      'completed',
    ];
    const regs = await this.regRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.role', 'role')
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere('r.status IN (:...statuses)', {
        statuses: POST_APPROVE_STATUSES,
      })
      .orderBy('r.role_id', 'ASC')
      .addOrderBy('r.full_name', 'ASC')
      .getMany();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '5BIB Team Management';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`${event.event_name}`.slice(0, 30), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Họ và tên', key: 'full_name', width: 28 },
      { header: 'CCCD', key: 'cccd', width: 16 },
      { header: 'SĐT', key: 'phone', width: 14 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Địa chỉ', key: 'address', width: 32 },
      { header: 'Vai trò', key: 'role_name', width: 16 },
      { header: 'Size áo', key: 'shirt_size', width: 8 },
      { header: 'Ngày công', key: 'working_days', width: 10 },
      { header: 'Đơn giá (VNĐ)', key: 'daily_rate', width: 14 },
      { header: 'Thành tiền (VNĐ)', key: 'compensation', width: 16 },
      { header: 'Đã ký HĐ', key: 'contract', width: 10 },
      { header: 'Check-in', key: 'checkin', width: 18 },
      { header: 'Trạng thái TT', key: 'payment', width: 14 },
      // Payout info — appended at the end so kế toán can bank-transfer
      // straight from this sheet. Chi nhánh is skipped on purpose — the
      // accountant team does not need it for the 3-field interbank form.
      { header: 'STK', key: 'bank_account_number', width: 20 },
      { header: 'Chủ TK', key: 'bank_holder_name', width: 24 },
      { header: 'Ngân hàng', key: 'bank_name', width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    if (regs.length === 0) {
      sheet.addRow({ stt: 1, full_name: '— Chưa có dữ liệu —' });
    } else {
      regs.forEach((reg, idx) => {
        const form = (reg.form_data ?? {}) as Record<string, unknown>;
        const dailyRate = Number(reg.role?.daily_rate ?? 0);
        const workingDays =
          reg.actual_working_days ?? reg.role?.working_days ?? 0;
        const compensation = reg.actual_compensation
          ? Number(reg.actual_compensation)
          : dailyRate * workingDays;
        sheet.addRow({
          stt: idx + 1,
          full_name: reg.full_name,
          cccd: typeof form.cccd === 'string' ? form.cccd : '',
          phone: reg.phone,
          email: reg.email,
          address: typeof form.address === 'string' ? form.address : '',
          role_name: reg.role?.role_name ?? '',
          shirt_size: reg.shirt_size ?? '',
          working_days: workingDays,
          daily_rate: dailyRate,
          compensation,
          contract: reg.contract_status === 'signed' ? '✓' : '',
          checkin: reg.checked_in_at
            ? reg.checked_in_at.toISOString()
            : '',
          payment: reg.payment_status === 'paid' ? 'Đã TT' : 'Chờ',
          bank_account_number:
            typeof form.bank_account_number === 'string'
              ? form.bank_account_number
              : '',
          bank_holder_name:
            typeof form.bank_holder_name === 'string'
              ? form.bank_holder_name
              : '',
          bank_name:
            typeof form.bank_name === 'string' ? form.bank_name : '',
        });
      });
      // Currency formatting for VND columns
      sheet.getColumn('daily_rate').numFmt = '#,##0';
      sheet.getColumn('compensation').numFmt = '#,##0';
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const key = `team-exports/${eventId}-${Date.now()}.xlsx`;
    // AWS SDK v3 header signing requires ASCII — Vietnamese chars in the
    // filename break the signature. Use an ASCII-safe slug for the classic
    // `filename=` and the RFC 5987 `filename*=` for the original UTF-8 name.
    const asciiName = asciiSlug(event.event_name) || `event-${event.id}`;
    const utf8Name = encodeURIComponent(`payment-report-${event.event_name}.xlsx`);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ContentDisposition: `attachment; filename="payment-report-${asciiName}.xlsx"; filename*=UTF-8''${utf8Name}`,
      }),
    );
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 600 },
    );
    this.logger.log(
      `Export generated event=${eventId} rows=${regs.length} key=${key}`,
    );
    return { download_url: url, row_count: regs.length };
  }

  /**
   * Full personnel export — admin-only. Mirrors the list endpoint filters
   * but pulls ALL matching rows (no pagination). Unlike the public list DTO
   * this export is NOT sanitized: CCCD is full, admin ghi chú is full.
   */
  async exportPersonnelReport(
    eventId: number,
    filters: {
      status?: string;
      role_id?: number;
      search?: string;
      adminIdentity?: string;
    } = {},
  ): Promise<PersonnelExportResponseDto> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Mirror TeamRegistrationService.listForEvent query pattern for
    // filter consistency — but no pagination, ALL matches.
    const qb = this.regRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.role', 'role')
      .where('r.event_id = :eid', { eid: eventId })
      .orderBy('role.role_name', 'ASC')
      .addOrderBy('r.full_name', 'ASC');
    if (filters.status) qb.andWhere('r.status = :s', { s: filters.status });
    if (filters.role_id) qb.andWhere('r.role_id = :rid', { rid: filters.role_id });
    if (filters.search) {
      qb.andWhere(
        '(r.full_name LIKE :q OR r.email LIKE :q OR r.phone LIKE :q)',
        { q: `%${filters.search}%` },
      );
    }
    const regs = await qb.getMany();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '5BIB Team Management';
    workbook.created = new Date();

    const sheetName = `${event.event_name}`.slice(0, 30) || 'Nhân sự';
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Họ và tên', key: 'full_name', width: 26 },
      { header: 'SĐT', key: 'phone', width: 14 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'CCCD', key: 'cccd', width: 16 },
      { header: 'Ngày sinh', key: 'dob', width: 12 },
      { header: 'Địa chỉ', key: 'address', width: 32 },
      { header: 'Size áo', key: 'shirt_size', width: 8 },
      // Payout info — block of 4 between Size áo and Vai trò so HR +
      // Accounting can both scan horizontally without jumping columns.
      { header: 'STK', key: 'bank_account_number', width: 20 },
      { header: 'Chủ TK', key: 'bank_holder_name', width: 24 },
      { header: 'Ngân hàng', key: 'bank_name', width: 22 },
      { header: 'Chi nhánh', key: 'bank_branch', width: 18 },
      { header: 'Vai trò', key: 'role_name', width: 18 },
      { header: 'Trạng thái', key: 'status', width: 14 },
      { header: 'Lý do từ chối', key: 'rejection_reason', width: 28 },
      { header: 'Waitlist pos', key: 'waitlist_position', width: 12 },
      { header: 'HĐ', key: 'contract_status', width: 12 },
      { header: 'Ngày ký HĐ', key: 'contract_signed_at', width: 18 },
      { header: 'Check-in', key: 'checked_in_at', width: 18 },
      { header: 'Phương thức CI', key: 'checkin_method', width: 14 },
      // v1.4: completion audit trail.
      { header: 'Ngày XN hoàn thành', key: 'completion_confirmed_at', width: 18 },
      { header: 'Người XN', key: 'completion_confirmed_by', width: 10 },
      { header: 'Nghi vấn', key: 'suspicious_checkin', width: 10 },
      { header: 'Ngày công thực tế', key: 'actual_working_days', width: 14 },
      { header: 'Đơn giá/ngày', key: 'daily_rate', width: 14 },
      {
        header: 'Snapshot đơn giá',
        key: 'snapshot_daily_rate',
        width: 14,
      },
      {
        header: 'Snapshot ngày công',
        key: 'snapshot_working_days',
        width: 14,
      },
      { header: 'Thành tiền', key: 'compensation', width: 16 },
      { header: 'Thanh toán', key: 'payment_status', width: 12 },
      { header: 'Ghi chú admin', key: 'notes', width: 30 },
      { header: 'Tạo lúc', key: 'created_at', width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Auto-filter on the header row covering all columns.
    const lastCol = sheet.columnCount;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: lastCol },
    };

    // v1.4: cover all 10 operational statuses.
    const statusLabel: Record<string, string> = {
      pending_approval: 'Chờ duyệt',
      approved: 'Đã duyệt',
      contract_sent: 'Đã gửi HĐ',
      contract_signed: 'Đã ký HĐ',
      qr_sent: 'Đã gửi QR',
      checked_in: 'Đã check-in',
      completed: 'Hoàn thành',
      waitlisted: 'Waitlist',
      rejected: 'Từ chối',
      cancelled: 'Đã hủy',
    };
    const completionByLabel: Record<string, string> = {
      leader: 'Leader',
      admin: 'Admin',
    };
    const contractLabel: Record<string, string> = {
      not_sent: 'Chưa gửi',
      sent: 'Đã gửi',
      signed: 'Đã ký',
      expired: 'Hết hạn',
    };
    const paymentLabel: Record<string, string> = {
      pending: 'Chờ',
      paid: 'Đã TT',
    };

    regs.forEach((reg, idx) => {
      const form = (reg.form_data ?? {}) as Record<string, unknown>;
      const dailyRate = Number(reg.role?.daily_rate ?? 0);
      const workingDays = reg.actual_working_days;
      const compensation =
        workingDays != null ? dailyRate * workingDays : '';
      sheet.addRow({
        stt: idx + 1,
        full_name: reg.full_name,
        phone: reg.phone,
        email: reg.email,
        cccd: typeof form.cccd === 'string' ? form.cccd : '',
        dob: typeof form.dob === 'string' ? form.dob : '',
        address: typeof form.address === 'string' ? form.address : '',
        shirt_size: reg.shirt_size ?? '',
        bank_account_number:
          typeof form.bank_account_number === 'string'
            ? form.bank_account_number
            : '',
        bank_holder_name:
          typeof form.bank_holder_name === 'string'
            ? form.bank_holder_name
            : '',
        bank_name:
          typeof form.bank_name === 'string' ? form.bank_name : '',
        bank_branch:
          typeof form.bank_branch === 'string' ? form.bank_branch : '',
        role_name: reg.role?.role_name ?? '',
        status: statusLabel[reg.status] ?? reg.status,
        rejection_reason: reg.rejection_reason ?? '',
        waitlist_position: reg.waitlist_position ?? '',
        contract_status:
          contractLabel[reg.contract_status] ?? reg.contract_status,
        contract_signed_at: reg.contract_signed_at
          ? formatVnDateTime(reg.contract_signed_at)
          : '',
        checked_in_at: reg.checked_in_at
          ? formatVnDateTime(reg.checked_in_at)
          : '',
        checkin_method: reg.checkin_method ?? '',
        completion_confirmed_at: reg.completion_confirmed_at
          ? formatVnDateTime(reg.completion_confirmed_at)
          : '',
        completion_confirmed_by: reg.completion_confirmed_by
          ? completionByLabel[reg.completion_confirmed_by] ??
            reg.completion_confirmed_by
          : '',
        suspicious_checkin: reg.suspicious_checkin ? 'CÓ' : '',
        actual_working_days: workingDays ?? '',
        daily_rate: dailyRate,
        snapshot_daily_rate: reg.snapshot_daily_rate
          ? Number(reg.snapshot_daily_rate)
          : '',
        snapshot_working_days: reg.snapshot_working_days ?? '',
        compensation,
        payment_status: paymentLabel[reg.payment_status] ?? reg.payment_status,
        notes: reg.notes ?? '',
        created_at: reg.created_at ? formatVnDateTime(reg.created_at) : '',
      });
    });

    if (regs.length === 0) {
      sheet.addRow({ stt: '', full_name: '— Không có dữ liệu khớp filter —' });
    }

    // Number formatting for money columns.
    sheet.getColumn('daily_rate').numFmt = '#,##0';
    sheet.getColumn('snapshot_daily_rate').numFmt = '#,##0';
    sheet.getColumn('compensation').numFmt = '#,##0';

    // Auto-width approximation — ExcelJS doesn't have true auto-fit; we
    // size each column to the longest cell length (cap 40, floor 6).
    sheet.columns.forEach((col) => {
      let maxLen = (col.header as string | undefined)?.length ?? 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const v = cell.value == null ? '' : String(cell.value);
        if (v.length > maxLen) maxLen = v.length;
      });
      col.width = Math.min(40, Math.max(col.width ?? 6, maxLen + 2));
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const ts = formatFilenameTimestamp(new Date());
    const asciiName = asciiSlug(event.event_name) || `event-${event.id}`;
    const filename = `team-nhansu-${asciiName}-${ts}.xlsx`;
    const key = `team-exports/personnel-${eventId}-${Date.now()}.xlsx`;
    const utf8Name = encodeURIComponent(
      `team-nhansu-${event.event_name}-${ts}.xlsx`,
    );
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ContentDisposition: `attachment; filename="${filename}"; filename*=UTF-8''${utf8Name}`,
      }),
    );
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 600 },
    );

    this.logger.log(
      `PERSONNEL_EXPORT admin=${filters.adminIdentity ?? '?'} eventId=${eventId} rows=${regs.length} filters=${JSON.stringify(
        {
          status: filters.status ?? null,
          role_id: filters.role_id ?? null,
          search: filters.search ?? null,
        },
      )}`,
    );

    return {
      url,
      filename,
      expires_in: 600,
      row_count: regs.length,
    };
  }
}

/**
 * Format a Date in vi-VN style: `dd/mm/yyyy hh:mm`. Uses the local
 * timezone of the host (VN prod server = Asia/Ho_Chi_Minh).
 */
function formatVnDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * YYYYMMDD-HHmm for filenames — timezone-local.
 */
function formatFilenameTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Strip diacritics (Vietnamese → ASCII) and drop anything outside [a-z0-9-_]
 * so the value is safe in an HTTP `filename=` token.
 */
function asciiSlug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
