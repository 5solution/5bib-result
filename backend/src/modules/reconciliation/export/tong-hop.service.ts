import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface TongHopRow {
  tenant_name: string;
  race_count: number;
  paid_orders: number;
  gross_revenue: number;
  fee_amount: number;
  fee_rate: number | null;
  period: string;
}

const BLUE = '1E40AF';
const GRAY = 'F3F4F6';

@Injectable()
export class TongHopService {
  async generate(rows: TongHopRow[], label: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = '5BIB Platform';
    const ws = wb.addWorksheet('Tổng hợp');

    ws.columns = [
      { key: 'stt', width: 6 },
      { key: 'tenant_name', width: 28 },
      { key: 'period', width: 18 },
      { key: 'race_count', width: 12 },
      { key: 'paid_orders', width: 14 },
      { key: 'gross_revenue', width: 20 },
      { key: 'fee_amount', width: 20 },
      { key: 'fee_rate', width: 12 },
      { key: 'status', width: 12 },
    ];

    // Title row
    ws.mergeCells('A1:I1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `TỔNG HỢP ĐỐI SOÁT — ${label.toUpperCase()}`;
    titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BLUE}` } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    // Header row
    const headers = [
      'STT', 'Merchant', 'Kỳ đối soát', 'Số giải',
      'Đơn paid', 'Tổng GMV (VNĐ)', 'Phí nền tảng (VNĐ)', 'Fee rate', 'Trạng thái',
    ];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BLUE}` } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
    ws.getRow(2).height = 22;

    // Data rows
    let totalOrders = 0;
    let totalGmv = 0;
    let totalFee = 0;

    rows.forEach((r, idx) => {
      totalOrders += r.paid_orders;
      totalGmv += r.gross_revenue;
      totalFee += r.fee_amount;

      const row = ws.addRow([
        idx + 1,
        r.tenant_name,
        r.period,
        r.race_count,
        r.paid_orders,
        r.gross_revenue,
        r.fee_amount,
        r.fee_rate != null ? `${r.fee_rate}%` : 'Manual',
        'Đã xuất',
      ]);

      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GRAY}` } };
        });
      }

      // Number format for money columns
      row.getCell(6).numFmt = '#,##0';
      row.getCell(7).numFmt = '#,##0';
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(7).alignment = { horizontal: 'right' };
    });

    // Total row
    const totalRow = ws.addRow([
      '', 'TỔNG CỘNG', '', '', totalOrders, totalGmv, totalFee, '', '',
    ]);
    totalRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.border = { top: { style: 'medium', color: { argb: 'FF1E40AF' } } };
    });
    totalRow.getCell(5).numFmt = '#,##0';
    totalRow.getCell(6).numFmt = '#,##0';
    totalRow.getCell(7).numFmt = '#,##0';
    totalRow.getCell(5).alignment = { horizontal: 'right' };
    totalRow.getCell(6).alignment = { horizontal: 'right' };
    totalRow.getCell(7).alignment = { horizontal: 'right' };

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
