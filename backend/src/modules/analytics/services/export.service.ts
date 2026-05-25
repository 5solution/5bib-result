import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { AnalyticsService } from '../analytics.service';
import { MerchantComparisonService } from './merchant-comparison.service';
import { RacePerformanceService } from './race-performance.service';
import { RunnerAnalyticsService } from './runner-analytics.service';
import type { ExportAnalyticsQueryDto } from '../dto/export-analytics.dto';

/**
 * F-062 Wave 2C-3 NEW SERVICE — Export Analytics CSV/Excel (BR-SA-10 v3).
 *
 * Generates downloadable file from analytics endpoint data per `reportType`.
 *
 * - CSV: UTF-8 BOM header (U+FEFF) cho Excel VN mở đúng encoding
 * - Excel: exceljs với sheet name = reportType, format VND cho cột tiền
 * - File name: `5bib-analytics-{reportType}-{YYYYMMDD}.{csv|xlsx}`
 * - Max rows: 10,000 → vượt throws 400 (PRD spec line 305)
 * - Auth: LogtoAdminGuard (class-level inherited)
 * - NO cache (always fresh data)
 *
 * Resolves TD-F026-EXPORT-STUB (previous F-026 era export was stub).
 */
const MAX_EXPORT_ROWS = 10_000;
const CSV_BOM = '﻿';

interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: 'vnd' | 'percent' | 'text' | 'integer';
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly merchantService: MerchantComparisonService,
    private readonly raceService: RacePerformanceService,
    private readonly runnerService: RunnerAnalyticsService,
  ) {}

  /**
   * Generate export buffer + filename + MIME type per reportType + format.
   */
  async generate(query: ExportAnalyticsQueryDto): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }> {
    const format = query.format ?? 'xlsx';
    const reportType = query.reportType ?? 'overview';

    const { rows, columns } = await this._fetchReportData(reportType, query);

    if (rows.length > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        'Dữ liệu quá lớn, vui lòng thu hẹp phạm vi thời gian',
      );
    }

    const today = new Date();
    const ymd = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, '0')}${String(today.getUTCDate()).padStart(2, '0')}`;
    const filename = `5bib-analytics-${reportType}-${ymd}.${format}`;

    if (format === 'csv') {
      const csv = this._toCsv(rows, columns);
      return {
        buffer: Buffer.from(CSV_BOM + csv, 'utf-8'),
        filename,
        mimeType: 'text/csv; charset=utf-8',
      };
    }

    const xlsx = await this._toXlsx(rows, columns, reportType);
    return {
      buffer: xlsx,
      filename,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Fetch data + define columns per reportType. Returns Array<object> rows.
   */
  private async _fetchReportData(
    reportType: ExportAnalyticsQueryDto['reportType'],
    query: ExportAnalyticsQueryDto,
  ): Promise<{ rows: Array<Record<string, unknown>>; columns: ExportColumn[] }> {
    switch (reportType) {
      case 'revenue': {
        const data = await this.analyticsService.getDailyRevenue(query);
        return {
          rows: data as Array<Record<string, unknown>>,
          columns: [
            { header: 'Ngày', key: 'date', width: 12, format: 'text' },
            { header: 'Số đơn', key: 'orderCount', width: 10, format: 'integer' },
            { header: 'GMV', key: 'gmv', width: 18, format: 'vnd' },
            { header: 'Net GMV', key: 'netGmv', width: 18, format: 'vnd' },
          ],
        };
      }
      case 'races': {
        const data = await this.raceService.getPerformanceList({
          from: query.from,
          to: query.to,
          month: query.month,
          tenantId: query.tenantId,
          limit: MAX_EXPORT_ROWS,
        });
        return {
          rows: data.data as unknown as Array<Record<string, unknown>>,
          columns: [
            { header: 'Race ID', key: 'raceId', width: 10, format: 'integer' },
            { header: 'Tên giải', key: 'raceName', width: 35, format: 'text' },
            { header: 'Merchant', key: 'merchant', width: 25, format: 'text' },
            { header: 'Loại', key: 'raceType', width: 18, format: 'text' },
            { header: 'Ngày', key: 'date', width: 12, format: 'text' },
            { header: 'Số đơn', key: 'orders', width: 10, format: 'integer' },
            { header: 'GMV', key: 'gmv', width: 18, format: 'vnd' },
            { header: 'Phí 5BIB', key: 'platformFee', width: 18, format: 'vnd' },
            {
              header: 'Trung bình/đơn',
              key: 'avgPerOrder',
              width: 16,
              format: 'vnd',
            },
            { header: 'Huỷ %', key: 'voidedPct', width: 10, format: 'percent' },
          ],
        };
      }
      case 'merchants': {
        const data = await this.merchantService.getComparisonTable(query);
        return {
          rows: data.data as unknown as Array<Record<string, unknown>>,
          columns: [
            { header: 'Tenant ID', key: 'tenantId', width: 10, format: 'integer' },
            { header: 'Merchant', key: 'tenantName', width: 35, format: 'text' },
            { header: 'Fee rate %', key: 'feeRate', width: 12, format: 'percent' },
            { header: 'Số giải', key: 'races', width: 10, format: 'integer' },
            { header: 'Đơn hàng', key: 'orders', width: 12, format: 'integer' },
            { header: 'GMV', key: 'gmv', width: 18, format: 'vnd' },
            { header: 'Phí 5BIB', key: 'fee', width: 18, format: 'vnd' },
            { header: 'Thủ công %', key: 'manualPct', width: 12, format: 'percent' },
            { header: 'Huỷ %', key: 'voidedPct', width: 10, format: 'percent' },
            { header: 'Status', key: 'status', width: 12, format: 'text' },
            { header: 'Health Score', key: 'healthScore', width: 14, format: 'integer' },
          ],
        };
      }
      case 'funnel': {
        const data = await this.analyticsService.getFunnel(query);
        // Funnel returns object — flatten to single-row export (limit edge case)
        return {
          rows: [data as Record<string, unknown>],
          columns: [
            { header: 'Metric', key: 'metric', width: 30, format: 'text' },
            { header: 'Value', key: 'value', width: 18, format: 'integer' },
          ],
        };
      }
      case 'runners': {
        const data = await this.runnerService.getSummaryKpi(query);
        return {
          rows: [
            { metric: 'Unique Runners', value: data.uniqueRunners },
            { metric: 'Repeat Rate %', value: data.repeatRate },
            { metric: 'Avg Lead Time (ngày)', value: data.avgLeadTime ?? 0 },
            { metric: 'Avg đơn/Runner', value: data.avgOrdersPerRunner },
          ],
          columns: [
            { header: 'Chỉ số', key: 'metric', width: 30, format: 'text' },
            { header: 'Giá trị', key: 'value', width: 18, format: 'integer' },
          ],
        };
      }
      case 'overview':
      default: {
        const data = await this.analyticsService.getOverview(query);
        const d = data as Record<string, unknown>;
        return {
          rows: [
            { metric: 'GMV', value: d.gmv ?? 0 },
            { metric: 'Net GMV', value: d.netGmv ?? 0 },
            { metric: 'Số đơn', value: d.orderCount ?? 0 },
            { metric: 'Phí 5BIB', value: d.platformFee ?? 0 },
            { metric: 'Voided', value: d.voidedCount ?? 0 },
            { metric: 'Open races', value: d.openRaces ?? 0 },
            { metric: 'AOV', value: d.avgOrderValue ?? 0 },
          ],
          columns: [
            { header: 'Chỉ số', key: 'metric', width: 30, format: 'text' },
            { header: 'Giá trị', key: 'value', width: 18, format: 'vnd' },
          ],
        };
      }
    }
  }

  private _toCsv(
    rows: Array<Record<string, unknown>>,
    columns: ExportColumn[],
  ): string {
    const escape = (v: unknown): string => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const header = columns.map((c) => escape(c.header)).join(',');
    const body = rows
      .map((row) => columns.map((c) => escape(row[c.key])).join(','))
      .join('\n');
    return `${header}\n${body}`;
  }

  private async _toXlsx(
    rows: Array<Record<string, unknown>>,
    columns: ExportColumn[],
    reportType: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '5BIB Analytics';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(reportType);

    sheet.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? 15,
    }));

    // Header row styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows + apply format
    rows.forEach((row) => {
      const newRow = sheet.addRow(row);
      columns.forEach((c, idx) => {
        const cell = newRow.getCell(idx + 1);
        if (c.format === 'vnd') {
          cell.numFmt = '#,##0 "₫"';
        } else if (c.format === 'percent') {
          cell.numFmt = '0.00"%"';
        } else if (c.format === 'integer') {
          cell.numFmt = '#,##0';
        }
      });
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }
}
