import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ReconciliationDocument } from '../schemas/reconciliation.schema';

const VND_FORMAT = '#,##0';

const FILL_SECTION_HEADER: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E4E79' },
};

const FILL_COL_HEADER: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD6E4F0' },
};

const FILL_TOTAL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF2CC' },
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

function applyBorder(row: ExcelJS.Row, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).border = BORDER_THIN;
  }
}

@Injectable()
export class XlsxService {
  async generate(rec: ReconciliationDocument): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '5BIB';
    workbook.created = new Date();

    this.buildSheet1(workbook, rec);
    this.buildSheet2(workbook, rec);
    this.buildSheet3(workbook, rec);
    this.buildSheet4(workbook, rec);
    this.buildSheet5(workbook, rec);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private addSectionHeader(
    ws: ExcelJS.Worksheet,
    text: string,
    colSpan = 2,
  ): ExcelJS.Row {
    const row = ws.addRow([text]);
    ws.mergeCells(row.number, 1, row.number, colSpan);
    const cell = row.getCell(1);
    cell.fill = FILL_SECTION_HEADER;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: 'middle' };
    row.height = 20;
    return row;
  }

  private addColHeader(ws: ExcelJS.Worksheet, labels: string[]): ExcelJS.Row {
    const row = ws.addRow(labels);
    for (let c = 1; c <= labels.length; c++) {
      const cell = row.getCell(c);
      cell.fill = FILL_COL_HEADER;
      cell.font = { bold: true };
      cell.border = BORDER_THIN;
      cell.alignment = { horizontal: 'center', wrapText: true, vertical: 'middle' };
    }
    row.height = 22;
    return row;
  }

  private addDataRow(
    ws: ExcelJS.Worksheet,
    label: string,
    value: number | string | null,
    opts: { isTotal?: boolean; numFmt?: string; indentLabel?: boolean } = {},
  ): ExcelJS.Row {
    const row = ws.addRow([opts.indentLabel ? `    ${label}` : label, value]);
    applyBorder(row, 2);
    if (opts.isTotal) {
      row.getCell(1).font = { bold: true };
      row.getCell(2).font = { bold: true };
      row.getCell(1).fill = FILL_TOTAL;
      row.getCell(2).fill = FILL_TOTAL;
    }
    if (opts.numFmt != null) {
      row.getCell(2).numFmt = opts.numFmt;
    }
    row.getCell(2).alignment = { horizontal: 'right' };
    return row;
  }

  private buildSheet1(wb: ExcelJS.Workbook, rec: ReconciliationDocument) {
    const ws = wb.addWorksheet('Tổng quan');
    ws.views = [{ showGridLines: false }];

    // Title
    const titleRow = ws.addRow(['BIÊN BẢN QUYẾT TOÁN']);
    ws.mergeCells(titleRow.number, 1, titleRow.number, 2);
    titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF1E4E79' } };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 32;

    ws.addRow([]);

    // Meta info
    const metaData: [string, string][] = [
      ['Giải đấu', rec.race_title],
      ['Đơn vị tổ chức', rec.tenant_name],
      ['Kỳ quyết toán', `${rec.period_start} → ${rec.period_end}`],
    ];
    for (const [label, value] of metaData) {
      const row = ws.addRow([label, value]);
      row.getCell(1).font = { bold: true };
    }

    ws.addRow([]);

    // ─── SECTION A: 5BIB orders ───
    this.addSectionHeader(
      ws,
      'A. Đơn hàng 5BIB (ORDINARY / PERSONAL_GROUP / CHANGE_COURSE)',
    );
    this.addColHeader(ws, ['Chỉ tiêu', 'Giá trị (VNĐ)']);

    this.addDataRow(ws, 'Doanh thu gộp (gross_revenue)', rec.gross_revenue, {
      numFmt: VND_FORMAT,
    });
    this.addDataRow(ws, 'Tổng giảm giá (total_discount)', rec.total_discount, {
      numFmt: VND_FORMAT,
    });
    this.addDataRow(ws, 'Doanh thu thực (net_revenue)', rec.net_revenue, {
      numFmt: VND_FORMAT,
    });

    // Fee rate as Excel percentage
    const feeRateRow = ws.addRow([
      'Tỉ lệ phí dịch vụ (fee_rate_applied)',
      rec.fee_rate_applied != null ? rec.fee_rate_applied / 100 : null,
    ]);
    applyBorder(feeRateRow, 2);
    feeRateRow.getCell(2).numFmt = '0.00%';
    feeRateRow.getCell(2).alignment = { horizontal: 'right' };

    this.addDataRow(ws, 'Tiền phí dịch vụ (fee_amount)', rec.fee_amount, {
      numFmt: VND_FORMAT,
    });
    this.addDataRow(
      ws,
      `VAT trên phí (${rec.fee_vat_rate ?? 0}%)`,
      rec.fee_vat_amount,
      { numFmt: VND_FORMAT },
    );

    ws.addRow([]);

    // ─── SECTION B: Manual orders ───
    this.addSectionHeader(ws, 'B. Đơn hàng thủ công (MANUAL)');
    this.addColHeader(ws, ['Chỉ tiêu', 'Giá trị']);

    this.addDataRow(ws, 'Số vé thủ công', rec.manual_ticket_count);
    this.addDataRow(ws, 'Doanh thu thủ công', rec.manual_gross_revenue, {
      numFmt: VND_FORMAT,
    });
    this.addDataRow(ws, 'Phí/vé thủ công (VNĐ)', rec.manual_fee_per_ticket, {
      numFmt: VND_FORMAT,
    });
    this.addDataRow(ws, 'Tổng phí thủ công', rec.manual_fee_amount, {
      numFmt: VND_FORMAT,
    });

    ws.addRow([]);

    // ─── SECTION C: Line items ───
    this.addSectionHeader(ws, 'C. Chi tiết theo hạng mục đơn 5BIB', 8);
    this.addColHeader(ws, [
      'Loại đơn',
      'Cự ly',
      'Giai đoạn',
      'SL',
      'Đơn giá',
      'Giảm giá',
      'Thành tiền',
      'Add-on',
    ]);

    for (const li of rec.line_items) {
      const row = ws.addRow([
        li.order_category,
        li.distance_name,
        li.ticket_type_name,
        li.quantity,
        li.unit_price,
        li.discount_amount,
        li.subtotal,
        li.add_on_price,
      ]);
      applyBorder(row, 8);
      [5, 6, 7, 8].forEach((c) => {
        row.getCell(c).numFmt = VND_FORMAT;
        row.getCell(c).alignment = { horizontal: 'right' };
      });
      row.getCell(4).alignment = { horizontal: 'center' };
    }

    ws.addRow([]);

    // ─── SECTION D: Payout summary ───
    this.addSectionHeader(ws, 'D. Tổng quyết toán');
    this.addColHeader(ws, ['Chỉ tiêu', 'Giá trị (VNĐ)']);

    this.addDataRow(ws, 'Doanh thu thực (net_revenue)', rec.net_revenue, {
      numFmt: VND_FORMAT,
    });
    this.addDataRow(ws, '(−) Phí dịch vụ 5BIB', rec.fee_amount, {
      numFmt: VND_FORMAT,
      indentLabel: true,
    });
    this.addDataRow(ws, '(−) VAT trên phí', rec.fee_vat_amount, {
      numFmt: VND_FORMAT,
      indentLabel: true,
    });
    this.addDataRow(
      ws,
      '(±) Điều chỉnh thủ công',
      rec.manual_adjustment ?? 0,
      { numFmt: VND_FORMAT, indentLabel: true },
    );

    if (rec.adjustment_note) {
      this.addDataRow(ws, 'Ghi chú điều chỉnh', rec.adjustment_note);
    }

    this.addDataRow(
      ws,
      'TIỀN THANH TOÁN CHO ĐƠN VỊ TỔ CHỨC',
      rec.payout_amount,
      { isTotal: true, numFmt: VND_FORMAT },
    );

    // Column widths
    ws.getColumn(1).width = 50;
    ws.getColumn(2).width = 22;
    ws.getColumn(3).width = 25;
    ws.getColumn(4).width = 8;
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 14;
    ws.getColumn(7).width = 16;
    ws.getColumn(8).width = 12;
  }

  private buildSheet2(wb: ExcelJS.Workbook, rec: ReconciliationDocument) {
    const ws = wb.addWorksheet('Pivot');

    const typeNames = [
      ...new Set(rec.line_items.map((li) => li.ticket_type_name)),
    ];
    const distances = [
      ...new Set(rec.line_items.map((li) => li.distance_name)),
    ];

    const headerLabels = ['Giai đoạn / Cự ly'];
    for (const d of distances) {
      headerLabels.push(`${d} - SL`, `${d} - Thành tiền`);
    }
    headerLabels.push('Tổng SL', 'Tổng thành tiền');

    const headerRow = ws.addRow(headerLabels);
    headerRow.font = { bold: true };
    for (let c = 1; c <= headerLabels.length; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = FILL_COL_HEADER;
      cell.border = BORDER_THIN;
      cell.alignment = { horizontal: 'center', wrapText: true };
    }
    headerRow.height = 22;

    for (const typeName of typeNames) {
      const rowData: (string | number)[] = [typeName];
      let totalQty = 0;
      let totalSubtotal = 0;

      for (const d of distances) {
        const item = rec.line_items.find(
          (li) => li.ticket_type_name === typeName && li.distance_name === d,
        );
        const qty = item?.quantity ?? 0;
        const sub = item?.subtotal ?? 0;
        rowData.push(qty, sub);
        totalQty += qty;
        totalSubtotal += sub;
      }

      rowData.push(totalQty, totalSubtotal);
      const row = ws.addRow(rowData);
      for (let c = 1; c <= rowData.length; c++) {
        row.getCell(c).border = BORDER_THIN;
        // Even columns (starting from col 3) are revenue: 3,5,7,... and last col
        if (c >= 3 && c % 2 === 1) {
          // odd col >= 3 → subtotal/revenue
          row.getCell(c).numFmt = VND_FORMAT;
          row.getCell(c).alignment = { horizontal: 'right' };
        }
      }
      // Last col is grand subtotal
      row.getCell(rowData.length).numFmt = VND_FORMAT;
      row.getCell(rowData.length).alignment = { horizontal: 'right' };
    }

    // Grand totals row
    const totalsData: (string | number)[] = ['Tổng cộng'];
    let grandQty = 0;
    let grandSubtotal = 0;
    for (const d of distances) {
      const items = rec.line_items.filter((li) => li.distance_name === d);
      const qty = items.reduce((s, li) => s + li.quantity, 0);
      const sub = items.reduce((s, li) => s + li.subtotal, 0);
      totalsData.push(qty, sub);
      grandQty += qty;
      grandSubtotal += sub;
    }
    totalsData.push(grandQty, grandSubtotal);

    const totalRow = ws.addRow(totalsData);
    totalRow.font = { bold: true };
    for (let c = 1; c <= totalsData.length; c++) {
      totalRow.getCell(c).fill = FILL_TOTAL;
      totalRow.getCell(c).border = BORDER_THIN;
      if (c >= 3 && c % 2 === 1) {
        totalRow.getCell(c).numFmt = VND_FORMAT;
        totalRow.getCell(c).alignment = { horizontal: 'right' };
      }
    }
    totalRow.getCell(totalsData.length).numFmt = VND_FORMAT;
    totalRow.getCell(totalsData.length).alignment = { horizontal: 'right' };

    ws.getColumn(1).width = 30;
    for (let i = 2; i <= headerLabels.length; i++) {
      ws.getColumn(i).width = 18;
    }
  }

  private buildOrderSheet(
    ws: ExcelJS.Worksheet,
    orders: Array<Record<string, any>>,
  ) {
    const headers = [
      'STT',
      'order_id',
      'Loại đơn',
      'Ngày xử lý',
      'Họ tên',
      'Email',
      'SĐT',
      'Cự ly',
      'Giai đoạn',
      'SL',
      'Đơn giá',
      'Giảm giá',
      'Thành tiền',
      'Add-on',
      'Payment Ref',
      'Mã giảm giá',
    ];

    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };
    for (let c = 1; c <= headers.length; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = FILL_COL_HEADER;
      cell.border = BORDER_THIN;
      cell.alignment = { horizontal: 'center', wrapText: true };
    }
    headerRow.height = 22;

    ws.autoFilter = { from: 'A1', to: 'P1' };
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    let stt = 1;
    for (const r of orders) {
      const row = ws.addRow([
        stt++,
        r.order_id,
        r.order_category,
        r.processed_on
          ? new Date(r.processed_on).toLocaleDateString('vi-VN')
          : '',
        r.full_name,
        r.email,
        r.phone_number,
        r.distance,
        r.type_name,
        r.qty,
        r.line_price,
        r.total_discounts,
        r.subtotal_price,
        r.total_add_on_price,
        r.payment_ref,
        r.discount_code,
      ]);
      applyBorder(row, 16);
      [11, 12, 13, 14].forEach((c) => {
        row.getCell(c).numFmt = VND_FORMAT;
        row.getCell(c).alignment = { horizontal: 'right' };
      });
      row.getCell(10).alignment = { horizontal: 'center' };
    }

    const colWidths = [6, 12, 20, 22, 25, 28, 15, 20, 25, 6, 14, 12, 14, 10, 20, 16];
    colWidths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
  }

  private buildSheet3(wb: ExcelJS.Workbook, rec: ReconciliationDocument) {
    const ws = wb.addWorksheet('Tổng quan đơn hàng');
    const all = [...rec.raw_5bib_orders, ...rec.raw_manual_orders];
    this.buildOrderSheet(ws, all);
  }

  private buildSheet4(wb: ExcelJS.Workbook, rec: ReconciliationDocument) {
    const ws = wb.addWorksheet('Đơn hàng 5bib');
    this.buildOrderSheet(ws, rec.raw_5bib_orders);
  }

  private buildSheet5(wb: ExcelJS.Workbook, rec: ReconciliationDocument) {
    const ws = wb.addWorksheet('Đơn hàng thủ công');
    this.buildOrderSheet(ws, rec.raw_manual_orders);
  }
}
