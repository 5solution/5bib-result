import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { env } from 'src/config';
import {
  Contract,
  ContractDocument,
} from '../../contracts/schemas/contract.schema';
import { CostItemsService } from './cost-items.service';
import { PnLService } from './pnl.service';
import { ExcelExportResponseDto } from '../dto/excel-export.dto';
import { buildDocumentFilename } from '../../contracts/utils/build-filename';
import { PnLDashboardFilterDto } from '../dto/dashboard-filter.dto';
import {
  DashboardContractItemDto,
  DashboardGroupBucketDto,
  PnLDashboardResponseDto,
} from '../dto/dashboard-response.dto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExcelJS = require('exceljs');

const SIGNED_URL_TTL = 15 * 60; // 15min (BR-PNL-16)

/**
 * F-028 BR-PNL-15 — single contract P&L Excel export (3 sheet):
 *   Sheet 1 "Chi phí" — table cost items
 *   Sheet 2 "Tổng kết P&L" — Revenue / Cost / Profit / Margin + category breakdown
 *   Sheet 3 "Doanh thu" — revenue compute source detail
 *
 * PAUSE-CODE-028-C resolved: Coder design generic theo BR-PNL-15. KHÔNG có
 * template file (template-input chỉ có quotation.xlsx). Render từ scratch
 * qua ExcelJS — đảm bảo header/format VN accounting standard.
 *
 * PAUSE-CODE-028-D resolved: exceljs đã có F-024 → KHÔNG install package mới.
 */
@Injectable()
export class PnLExcelService {
  private readonly logger = new Logger(PnLExcelService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectModel(Contract.name)
    private readonly contractModel: Model<ContractDocument>,
    private readonly pnlService: PnLService,
    private readonly costItemsService: CostItemsService,
  ) {
    this.s3 = new S3Client({
      region: env.s3.region,
      credentials: {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      },
    });
    this.bucket = env.s3.bucket;
  }

  private fmtVnd(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return new Intl.NumberFormat('vi-VN').format(Math.round(n));
  }

  private fmtPct(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return `${n.toFixed(1)}%`;
  }

  /**
   * Render workbook + upload S3 + return signed URL. Filename theo F-024
   * `buildDocumentFilename` convention với docType="QUOTATION" rồi override
   * label (F-024 build-filename hiện tại không có docType "PNL" — chấp nhận
   * dùng QUOTATION làm placeholder, hoặc generate filename inline).
   */
  async exportSingleContract(
    contractId: string,
    actorId: string,
  ): Promise<ExcelExportResponseDto> {
    if (!Types.ObjectId.isValid(contractId)) {
      throw new NotFoundException(`Contract không tồn tại: ${contractId}`);
    }
    const contract = await this.contractModel.findById(contractId).exec();
    if (!contract || contract.deletedAt) {
      throw new NotFoundException(`Contract không tồn tại: ${contractId}`);
    }

    const summary = await this.pnlService.getSummary(contractId);
    const costItems = await this.costItemsService.findAllActiveByContract(
      contractId,
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = '5BIB Finance F-028';
    wb.created = new Date();

    // ─── Sheet 1: Chi phí ──────────────────────────────────────────────
    const sCost = wb.addWorksheet('Chi phí');
    sCost.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Mô tả', key: 'description', width: 50 },
      { header: 'Nhóm', key: 'category', width: 14 },
      { header: 'Ngày phát sinh', key: 'incurredDate', width: 18 },
      { header: 'Số tiền (VND)', key: 'amount', width: 18 },
      { header: 'Ghi chú', key: 'note', width: 40 },
    ];
    sCost.getRow(1).font = { bold: true };
    sCost.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' },
    };

    costItems.forEach((c, idx) => {
      sCost.addRow({
        stt: idx + 1,
        description: c.description,
        category: c.category,
        incurredDate: c.incurredDate ?? '',
        amount: c.amount,
        note: c.note ?? '',
      });
    });
    // Total row
    if (costItems.length > 0) {
      const totalRow = sCost.addRow({
        stt: '',
        description: 'TỔNG',
        category: '',
        incurredDate: '',
        amount: summary.totalCost,
        note: '',
      });
      totalRow.font = { bold: true };
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' },
      };
    }
    sCost.getColumn('amount').numFmt = '#,##0';

    // ─── Sheet 2: Tổng kết P&L ─────────────────────────────────────────
    const sSummary = wb.addWorksheet('Tổng kết P&L');
    sSummary.columns = [
      { header: 'Mục', key: 'k', width: 32 },
      { header: 'Giá trị', key: 'v', width: 24 },
    ];
    sSummary.getRow(1).font = { bold: true };
    sSummary.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' },
    };

    const sourceLabel =
      summary.revenueSource === 'ACTUAL' ? 'Actual (chốt)' : 'Estimated (ước tính)';
    sSummary.addRow({
      k: 'Mã hợp đồng',
      v: contract.contractNumber ?? '(DRAFT)',
    });
    sSummary.addRow({ k: 'Đối tác', v: contract.client?.entityName ?? '' });
    sSummary.addRow({ k: 'Loại HĐ', v: contract.contractType });
    sSummary.addRow({ k: 'Race', v: contract.raceName ?? '' });
    sSummary.addRow({ k: '', v: '' });
    sSummary.addRow({ k: 'Doanh thu', v: this.fmtVnd(summary.revenue) });
    sSummary.addRow({ k: 'Nguồn doanh thu', v: sourceLabel });
    sSummary.addRow({ k: 'Tổng chi phí', v: this.fmtVnd(summary.totalCost) });
    sSummary.addRow({ k: 'Lãi/Lỗ', v: this.fmtVnd(summary.profit) });
    sSummary.addRow({ k: 'Margin %', v: this.fmtPct(summary.margin) });
    sSummary.addRow({
      k: 'Phân loại',
      v:
        summary.marginTier === 'loss'
          ? 'LỖ (margin < 0%)'
          : summary.marginTier === 'thin'
            ? 'Mỏng (0-10%)'
            : summary.marginTier === 'healthy'
              ? 'Healthy (>10%)'
              : 'Trung tính',
    });
    sSummary.addRow({ k: '', v: '' });
    sSummary.addRow({ k: 'Số mục chi phí', v: summary.costItemCount });
    sSummary.addRow({ k: '', v: '' });

    // Category breakdown
    const breakdownHeader = sSummary.addRow({
      k: 'Phân bổ chi phí theo nhóm',
      v: '',
    });
    breakdownHeader.font = { bold: true };
    for (const [cat, amt] of Object.entries(summary.costByCategory)) {
      sSummary.addRow({ k: `  ${cat}`, v: this.fmtVnd(amt) });
    }

    if (summary.warning) {
      sSummary.addRow({ k: '', v: '' });
      const warnRow = sSummary.addRow({
        k: '⚠️ Cảnh báo',
        v: summary.warning,
      });
      warnRow.font = { italic: true, color: { argb: 'FFB45309' } };
    }

    // ─── Sheet 3: Doanh thu (source detail) ─────────────────────────────
    const sRev = wb.addWorksheet('Doanh thu');
    sRev.columns = [
      { header: 'Trường', key: 'k', width: 30 },
      { header: 'Giá trị', key: 'v', width: 40 },
    ];
    sRev.getRow(1).font = { bold: true };
    sRev.addRow({ k: 'Mã HĐ', v: contract.contractNumber ?? '(DRAFT)' });
    sRev.addRow({ k: 'Loại HĐ', v: contract.contractType });
    sRev.addRow({ k: 'Trạng thái', v: contract.status });
    sRev.addRow({
      k: 'BBNT status',
      v: contract.acceptanceReport?.status ?? '(chưa có)',
    });
    sRev.addRow({
      k: 'contract.totalAmount',
      v: this.fmtVnd(contract.totalAmount ?? 0),
    });
    sRev.addRow({
      k: 'BBNT actualTotalWithVat',
      v: this.fmtVnd(contract.acceptanceReport?.actualTotalWithVat ?? 0),
    });
    sRev.addRow({
      k: 'revenueShare.estimatedFee',
      v: this.fmtVnd(contract.revenueShare?.estimatedFee ?? 0),
    });
    sRev.addRow({ k: '', v: '' });
    sRev.addRow({
      k: 'Doanh thu áp dụng',
      v: this.fmtVnd(summary.revenue),
    });
    sRev.addRow({ k: 'Nguồn', v: sourceLabel });
    if (summary.warning) {
      sRev.addRow({ k: '⚠️ Cảnh báo', v: summary.warning });
    }

    // ─── Write + Upload S3 ─────────────────────────────────────────────
    const buf: ArrayBuffer = await wb.xlsx.writeBuffer();
    const body = Buffer.from(buf);

    const ts = Date.now();
    const s3Key = `finance-pnl-exports/${actorId}/${ts}-${contractId}.xlsx`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: body,
        ContentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const signedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      { expiresIn: SIGNED_URL_TTL },
    );

    // Filename: reuse F-024 buildDocumentFilename — dùng docType=QUOTATION
    // làm placeholder vì F-024 GeneratedDocType enum chưa có "PNL". Acceptable
    // cho Phase 1 — Phase 2 có thể extend enum.
    let filename: string;
    try {
      filename = buildDocumentFilename({
        providerId: contract.providerId,
        partnerName: contract.client?.entityName ?? 'Doi-tac',
        docType: 'QUOTATION',
        contractType: contract.contractType,
        signDate: contract.signDate ?? null,
        fallbackDate: contract.createdAt,
        format: 'xlsx',
      }).replace('Báo giá', 'P&L');
    } catch {
      filename = `PnL-${contract.contractNumber ?? contractId}-${ts}.xlsx`;
    }

    this.logger.log(
      `[finance] PnL Excel exported contractId=${contractId} bytes=${body.length}`,
    );

    return {
      s3Key,
      signedUrl,
      filename,
      bytes: body.length,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // F-028 Phase 2 — Aggregated dashboard Excel (5 sheets)
  // ────────────────────────────────────────────────────────────────────────

  private addContractsSheet(
    wb: any,
    name: string,
    items: DashboardContractItemDto[],
  ): void {
    const sh = wb.addWorksheet(name);
    sh.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Mã HĐ', key: 'contractNumber', width: 20 },
      { header: 'Đối tác', key: 'partnerName', width: 30 },
      { header: 'Race', key: 'raceName', width: 24 },
      { header: 'Loại HĐ', key: 'contractType', width: 14 },
      { header: 'Trạng thái', key: 'status', width: 14 },
      { header: 'Tháng', key: 'anchorMonth', width: 10 },
      { header: 'Doanh thu', key: 'revenue', width: 16 },
      { header: 'Nguồn DT', key: 'revenueSource', width: 10 },
      { header: 'Tổng CP', key: 'totalCost', width: 16 },
      { header: 'Lãi/Lỗ', key: 'profit', width: 16 },
      { header: 'Margin %', key: 'margin', width: 10 },
      { header: 'Phân loại', key: 'marginTier', width: 12 },
    ];
    sh.getRow(1).font = { bold: true };
    sh.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' },
    };
    items.forEach((i, idx) => {
      sh.addRow({
        stt: idx + 1,
        contractNumber: i.contractNumber ?? '(DRAFT)',
        partnerName: i.partnerName ?? '',
        raceName: i.raceName ?? '',
        contractType: i.contractType,
        status: i.status,
        anchorMonth: i.anchorMonth ?? '',
        revenue: i.revenue,
        revenueSource: i.revenueSource,
        totalCost: i.totalCost,
        profit: i.profit,
        margin: i.margin ?? '',
        marginTier:
          i.marginTier === 'loss'
            ? 'LỖ'
            : i.marginTier === 'thin'
              ? 'Mỏng'
              : i.marginTier === 'healthy'
                ? 'Healthy'
                : 'Trung tính',
      });
    });
    sh.getColumn('revenue').numFmt = '#,##0';
    sh.getColumn('totalCost').numFmt = '#,##0';
    sh.getColumn('profit').numFmt = '#,##0';
    sh.getColumn('margin').numFmt = '0.0';
  }

  private addGroupSheet(
    wb: any,
    name: string,
    groupHeader: string,
    buckets: DashboardGroupBucketDto[],
  ): void {
    const sh = wb.addWorksheet(name);
    sh.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: groupHeader, key: 'label', width: 32 },
      { header: 'Số HĐ', key: 'cnt', width: 10 },
      { header: 'Tổng DT', key: 'rev', width: 18 },
      { header: 'Tổng CP', key: 'cost', width: 18 },
      { header: 'Tổng Lãi/Lỗ', key: 'profit', width: 18 },
      { header: 'Margin TB %', key: 'margin', width: 12 },
    ];
    sh.getRow(1).font = { bold: true };
    sh.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' },
    };
    buckets.forEach((b, idx) => {
      sh.addRow({
        stt: idx + 1,
        label: b.label,
        cnt: b.contractCount,
        rev: b.totalRevenue,
        cost: b.totalCost,
        profit: b.totalProfit,
        margin: b.avgMargin ?? '',
      });
    });
    sh.getColumn('rev').numFmt = '#,##0';
    sh.getColumn('cost').numFmt = '#,##0';
    sh.getColumn('profit').numFmt = '#,##0';
    sh.getColumn('margin').numFmt = '0.0';
  }

  async exportAggregated(
    filter: PnLDashboardFilterDto,
    actorId: string,
  ): Promise<ExcelExportResponseDto> {
    const data: PnLDashboardResponseDto =
      await this.pnlService.getDashboardData(filter);

    const wb = new ExcelJS.Workbook();
    wb.creator = '5BIB Finance F-028 (Phase 2 Aggregated)';
    wb.created = new Date();

    // ── Sheet 1: Tổng quan ──────────────────────────────────────────────
    const sOverview = wb.addWorksheet('Tổng quan');
    sOverview.columns = [
      { header: 'Mục', key: 'k', width: 32 },
      { header: 'Giá trị', key: 'v', width: 30 },
    ];
    sOverview.getRow(1).font = { bold: true };
    sOverview.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' },
    };
    sOverview.addRow({ k: 'Period', v: data.period });
    sOverview.addRow({ k: 'Từ ngày', v: data.dateFrom });
    sOverview.addRow({ k: 'Đến ngày', v: data.dateTo });
    sOverview.addRow({ k: 'Generated at', v: data.generatedAt });
    sOverview.addRow({ k: '', v: '' });
    sOverview.addRow({ k: 'Số HĐ', v: data.totals.contractCount });
    sOverview.addRow({ k: 'Tổng doanh thu', v: this.fmtVnd(data.totals.totalRevenue) });
    sOverview.addRow({ k: 'Tổng chi phí', v: this.fmtVnd(data.totals.totalCost) });
    sOverview.addRow({ k: 'Tổng Lãi/Lỗ', v: this.fmtVnd(data.totals.totalProfit) });
    sOverview.addRow({ k: 'Margin TB', v: this.fmtPct(data.totals.avgMargin) });
    sOverview.addRow({ k: '', v: '' });
    const breakdownRow = sOverview.addRow({
      k: 'Phân bổ chi phí theo nhóm',
      v: '',
    });
    breakdownRow.font = { bold: true };
    for (const [cat, amt] of Object.entries(data.totals.costByCategory)) {
      sOverview.addRow({ k: `  ${cat}`, v: this.fmtVnd(amt) });
    }

    // ── Sheet 2: Top lãi ────────────────────────────────────────────────
    this.addContractsSheet(wb, 'Top lãi', data.topProfit);

    // ── Sheet 3: Lỗ ─────────────────────────────────────────────────────
    this.addContractsSheet(wb, 'Lỗ', data.lossMaking);

    // ── Sheet 4: Theo loại HĐ ───────────────────────────────────────────
    this.addGroupSheet(wb, 'Theo loại HĐ', 'Loại HĐ', data.byType);

    // ── Sheet 5: Theo đối tác ───────────────────────────────────────────
    this.addGroupSheet(wb, 'Theo đối tác', 'Đối tác', data.byPartner);

    // ── Write + Upload S3 ──────────────────────────────────────────────
    const buf: ArrayBuffer = await wb.xlsx.writeBuffer();
    const body = Buffer.from(buf);

    const ts = Date.now();
    const s3Key = `finance-pnl-exports/dashboard/${actorId}/${ts}.xlsx`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: body,
        ContentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const signedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      { expiresIn: SIGNED_URL_TTL },
    );

    const filename = `PnL-Tong-hop-${data.dateFrom}_${data.dateTo}-${ts}.xlsx`;
    this.logger.log(
      `[finance] PnL Dashboard Excel exported period=${data.period} contracts=${data.totals.contractCount} bytes=${body.length}`,
    );
    return { s3Key, signedUrl, filename, bytes: body.length };
  }
}
