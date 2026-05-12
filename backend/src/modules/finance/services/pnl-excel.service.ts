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
}
