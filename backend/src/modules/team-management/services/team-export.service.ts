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
import { ExportResponseDto } from '../dto/bulk-update.dto';

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

    const regs = await this.regRepo.find({
      where: { event_id: eventId, status: 'approved' },
      relations: { role: true },
      order: { role_id: 'ASC', full_name: 'ASC' },
    });

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
      { header: 'Vai trò', key: 'role_name', width: 16 },
      { header: 'Size áo', key: 'shirt_size', width: 8 },
      { header: 'Ngày công', key: 'working_days', width: 10 },
      { header: 'Đơn giá (VNĐ)', key: 'daily_rate', width: 14 },
      { header: 'Thành tiền (VNĐ)', key: 'compensation', width: 16 },
      { header: 'Đã ký HĐ', key: 'contract', width: 10 },
      { header: 'Check-in', key: 'checkin', width: 18 },
      { header: 'Trạng thái TT', key: 'payment', width: 14 },
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
        });
      });
      // Currency formatting for VND columns
      sheet.getColumn('daily_rate').numFmt = '#,##0';
      sheet.getColumn('compensation').numFmt = '#,##0';
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const key = `team-exports/${eventId}-${Date.now()}.xlsx`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ContentDisposition: `attachment; filename="payment-report-${event.event_name}.xlsx"`,
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
}
