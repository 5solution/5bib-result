import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ReconciliationDocument } from '../schemas/reconciliation.schema';

const FONT_BASE: Partial<ExcelJS.Font> = {
  name: 'Times New Roman',
  size: 10,
  color: { argb: 'FF000000' },
};
const FONT_BOLD: Partial<ExcelJS.Font> = { ...FONT_BASE, bold: true };
const FONT_HEADER: Partial<ExcelJS.Font> = { ...FONT_BASE, bold: true, size: 12 };

const VND_FMT = '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)';
const PCT_FMT = '0.0%';

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

/** Apply font, border, numFmt to a cell */
function styleCell(
  cell: ExcelJS.Cell,
  value: any,
  opts: {
    font?: Partial<ExcelJS.Font>;
    numFmt?: string;
    border?: boolean;
    alignment?: Partial<ExcelJS.Alignment>;
  } = {},
) {
  cell.value = value;
  cell.font = opts.font ?? FONT_BASE;
  if (opts.numFmt) cell.numFmt = opts.numFmt;
  if (opts.border !== false) cell.border = BORDER_THIN;
  if (opts.alignment) cell.alignment = opts.alignment;
}

@Injectable()
export class XlsxService {
  async generate(rec: ReconciliationDocument): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '5BIB';
    workbook.created = new Date();

    this.buildTongQuan(workbook, rec);
    this.buildPivot(workbook, rec);
    this.buildRawOrderSheet(workbook, 'Tổng quan đơn hàng', [
      ...rec.raw_5bib_orders,
      ...rec.raw_manual_orders,
    ]);
    this.buildRawOrderSheet(workbook, 'Đơn hàng 5BIB', rec.raw_5bib_orders);
    this.buildRawOrderSheet(
      workbook,
      'Đơn hàng thủ công',
      rec.raw_manual_orders,
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /* ================================================================== */
  /* SHEET 1: Tổng quan — matches reference XLSX layout                  */
  /* ================================================================== */
  private buildTongQuan(wb: ExcelJS.Workbook, rec: ReconciliationDocument) {
    const ws = wb.addWorksheet('Tổng quan');

    // Column widths matching reference
    ws.getColumn(1).width = 35;
    ws.getColumn(2).width = 15;
    ws.getColumn(3).width = 13;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 13;
    ws.getColumn(7).width = 12;
    ws.getColumn(8).width = 22;
    ws.getColumn(9).width = 20;

    let r = 1;

    // --- Header block (rows 1-3) ---
    styleCell(ws.getRow(r).getCell(1), `SỰ KIỆN: ${rec.race_title}`, {
      font: FONT_HEADER,
      border: false,
    });
    r++;
    styleCell(
      ws.getRow(r).getCell(1),
      `Ngày đối soát: ${formatDate(rec.signed_date_str ?? new Date().toISOString().slice(0, 10))}`,
      { font: FONT_HEADER, border: false },
    );
    r++;
    styleCell(
      ws.getRow(r).getCell(1),
      `Giai đoạn: Từ ${formatDate(rec.period_start)} đến hết ${formatDate(rec.period_end)}`,
      { font: FONT_HEADER, border: false },
    );
    r += 2; // skip blank row

    // === SECTION 1: GIAO DỊCH THANH TOÁN QUA 5BIB ===
    styleCell(
      ws.getRow(r).getCell(1),
      '1. GIAO DỊCH THANH TOÁN QUA 5BIB',
      { font: FONT_BOLD, border: false },
    );
    r++;

    // Section 1 header
    ['STT', 'Giá trị giao dịch', 'Tỷ lệ phí', 'Phí bán vé'].forEach(
      (txt, i) =>
        styleCell(ws.getRow(r).getCell(i + 1), txt, { font: FONT_BOLD }),
    );
    r++;

    // Section 1 data
    styleCell(ws.getRow(r).getCell(1), 1);
    styleCell(ws.getRow(r).getCell(2), rec.net_revenue, { numFmt: VND_FMT });
    styleCell(ws.getRow(r).getCell(3), rec.fee_rate_applied != null ? rec.fee_rate_applied / 100 : 0, { numFmt: PCT_FMT });
    styleCell(ws.getRow(r).getCell(4), rec.fee_amount, { numFmt: VND_FMT });
    r++;

    // Section 1 total (A:C merged)
    ws.mergeCells(`A${r}:C${r}`);
    styleCell(ws.getRow(r).getCell(1), 'Tổng cộng', { font: FONT_BOLD });
    styleCell(ws.getRow(r).getCell(4), rec.fee_amount, {
      font: FONT_BOLD,
      numFmt: VND_FMT,
    });
    r += 2; // skip blank

    // === SECTION 2: PHÍ DỊCH VỤ ===
    styleCell(ws.getRow(r).getCell(1), '2. PHÍ DỊCH VỤ', {
      font: FONT_BOLD,
      border: false,
    });
    r++;

    ['STT', 'Số lượng vé', 'Phí/vé', 'Phí dịch vụ'].forEach((txt, i) =>
      styleCell(ws.getRow(r).getCell(i + 1), txt, { font: FONT_BOLD }),
    );
    r++;

    styleCell(ws.getRow(r).getCell(1), 1);
    styleCell(ws.getRow(r).getCell(2), rec.manual_ticket_count || 0);
    styleCell(ws.getRow(r).getCell(3), rec.manual_fee_per_ticket || 0, {
      numFmt: VND_FMT,
    });
    styleCell(ws.getRow(r).getCell(4), rec.manual_fee_amount || 0, {
      numFmt: VND_FMT,
    });
    r++;

    ws.mergeCells(`A${r}:C${r}`);
    styleCell(ws.getRow(r).getCell(1), 'Tổng cộng', { font: FONT_BOLD });
    styleCell(ws.getRow(r).getCell(4), rec.manual_fee_amount || 0, {
      font: FONT_BOLD,
      numFmt: VND_FMT,
    });
    r += 2;

    // === SECTION 3: CHI TIẾT GIAO DỊCH ===
    styleCell(ws.getRow(r).getCell(1), '3. CHI TIẾT GIAO DỊCH', {
      font: FONT_BOLD,
      border: false,
    });
    r++;

    // Column headers
    const h3 = [
      'Cự ly',
      'Đơn giá',
      'Số lượng',
      'Số lượng áo',
      'Đơn giá',
      'Thành tiền áo',
      'Giảm giá',
      'Tổng cộng',
    ];
    h3.forEach((txt, i) =>
      styleCell(ws.getRow(r).getCell(i + 1), txt, { font: FONT_BOLD }),
    );
    r++;

    // Sub-header formula labels
    const subLabels = [
      '',
      '(1)',
      '(2)',
      '(3)',
      '(4)',
      '(5) = (3) x (4)',
      '(6)',
      '(7) = [(1) x (2) + (5)] - (6)',
    ];
    subLabels.forEach((txt, i) =>
      styleCell(ws.getRow(r).getCell(i + 1), txt),
    );
    r++;

    // Data rows — one per line_item
    let totalQty = 0;
    let totalDiscount = 0;
    let grandTotal = 0;

    for (const li of rec.line_items) {
      const row = ws.getRow(r);
      styleCell(row.getCell(1), li.distance_name);
      styleCell(row.getCell(2), li.unit_price, { numFmt: VND_FMT });
      styleCell(row.getCell(3), li.quantity, { numFmt: VND_FMT });
      styleCell(row.getCell(4), 0, { numFmt: VND_FMT }); // add-on qty
      styleCell(row.getCell(5), 0, { numFmt: VND_FMT }); // add-on price
      styleCell(row.getCell(6), 0, { numFmt: VND_FMT }); // add-on total
      styleCell(row.getCell(7), li.discount_amount, { numFmt: VND_FMT });
      styleCell(row.getCell(8), li.subtotal, { numFmt: VND_FMT });
      // Col 9: ticket type name (no border)
      styleCell(row.getCell(9), li.ticket_type_name, { border: false });

      totalQty += li.quantity;
      totalDiscount += li.discount_amount;
      grandTotal += li.subtotal;
      r++;
    }

    // Totals row
    const totRow = ws.getRow(r);
    styleCell(totRow.getCell(1), 'Tổng', { font: FONT_BOLD });
    styleCell(totRow.getCell(2), '', { font: FONT_BOLD });
    styleCell(totRow.getCell(3), totalQty, { font: FONT_BOLD, numFmt: VND_FMT });
    styleCell(totRow.getCell(4), 0, { font: FONT_BOLD, numFmt: VND_FMT });
    styleCell(totRow.getCell(5), '', { font: FONT_BOLD });
    styleCell(totRow.getCell(6), 0, { font: FONT_BOLD, numFmt: VND_FMT });
    styleCell(totRow.getCell(7), totalDiscount, { font: FONT_BOLD, numFmt: VND_FMT });
    styleCell(totRow.getCell(8), grandTotal, { font: FONT_BOLD, numFmt: VND_FMT });
    r++;

    // Summary footer rows (merged A:G)

    // Phí bán vé
    ws.mergeCells(`A${r}:G${r}`);
    styleCell(ws.getRow(r).getCell(1), 'Phí bán vé (chưa bao gồm VAT)', {
      font: FONT_BOLD,
    });
    styleCell(ws.getRow(r).getCell(8), rec.fee_amount, {
      font: FONT_BOLD,
      numFmt: VND_FMT,
    });
    r++;

    // Phí dịch vụ
    ws.mergeCells(`A${r}:G${r}`);
    styleCell(
      ws.getRow(r).getCell(1),
      'Phí dịch vụ (chưa bao gồm VAT)',
      { font: FONT_BOLD },
    );
    styleCell(ws.getRow(r).getCell(8), rec.manual_fee_amount || 0, {
      font: FONT_BOLD,
      numFmt: VND_FMT,
    });
    r++;

    // VAT
    styleCell(
      ws.getRow(r).getCell(1),
      `Giá trị thuế GTGT (${rec.fee_vat_rate}%)`,
      { font: FONT_BOLD },
    );
    for (let c = 2; c <= 7; c++) {
      ws.getRow(r).getCell(c).border = BORDER_THIN;
    }
    styleCell(ws.getRow(r).getCell(8), rec.fee_vat_amount, {
      font: FONT_BOLD,
      numFmt: VND_FMT,
    });
    r++;

    // Hoàn trả merchant
    ws.mergeCells(`A${r}:G${r}`);
    styleCell(
      ws.getRow(r).getCell(1),
      'Hoàn trả merchant (chưa bao gồm VAT)',
      { font: FONT_BOLD },
    );
    styleCell(ws.getRow(r).getCell(8), rec.payout_amount, {
      font: FONT_BOLD,
      numFmt: VND_FMT,
    });
  }

  /* ================================================================== */
  /* SHEET 2: Pivot                                                      */
  /* ================================================================== */
  private buildPivot(wb: ExcelJS.Workbook, rec: ReconciliationDocument) {
    const ws = wb.addWorksheet('Pivot');

    ws.getColumn(1).width = 41;
    ws.getColumn(2).width = 39;
    ws.getColumn(3).width = 13;
    ws.getColumn(4).width = 13;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 21;
    ws.getColumn(7).width = 20;

    // Headers at row 3 (reference has rows 1-2 empty)
    const hdrRow = ws.getRow(3);
    [
      'order_category',
      'type_name',
      'distance',
      'origin_price',
      'Sum of qty',
      'Sum of total_discounts',
      'Sum of subtotal_price',
    ].forEach((txt, i) => {
      hdrRow.getCell(i + 1).value = txt;
      hdrRow.getCell(i + 1).font = FONT_BOLD;
    });

    let r = 4;
    let grandQty = 0;
    let grandDiscount = 0;
    let grandSubtotal = 0;

    for (const li of rec.line_items) {
      const row = ws.getRow(r);
      row.getCell(1).value = li.order_category;
      row.getCell(2).value = li.ticket_type_name;
      row.getCell(3).value = li.distance_name;
      row.getCell(4).value = li.unit_price;
      row.getCell(5).value = li.quantity;
      row.getCell(6).value = li.discount_amount;
      row.getCell(7).value = li.subtotal;
      r++;
      grandQty += li.quantity;
      grandDiscount += li.discount_amount;
      grandSubtotal += li.subtotal;
    }

    const gt = ws.getRow(r);
    gt.getCell(1).value = 'Grand Total';
    gt.getCell(1).font = FONT_BOLD;
    gt.getCell(5).value = grandQty;
    gt.getCell(5).font = FONT_BOLD;
    gt.getCell(6).value = grandDiscount;
    gt.getCell(6).font = FONT_BOLD;
    gt.getCell(7).value = grandSubtotal;
    gt.getCell(7).font = FONT_BOLD;
  }

  /* ================================================================== */
  /* SHEET 3/4/5: Raw order data                                         */
  /* ================================================================== */
  private buildRawOrderSheet(
    wb: ExcelJS.Workbook,
    name: string,
    orders: Array<Record<string, any>>,
  ) {
    const ws = wb.addWorksheet(name);

    const headers = [
      'id',
      'modified_on',
      'order_id',
      'order_category',
      'line_price',
      'create_by',
      'name',
      'email',
      'last_name',
      'first_name',
      'phone_number',
      'internal_status',
      'order_modified_on',
      'payment_ref',
      'processed_on',
      'distance',
      'type_name',
      'origin_price',
      'qty',
      'total_discounts',
      'total_add_on_price',
      'code',
      'subtotal_price',
      'total_price',
      'vat_metadata',
    ];

    const colWidths = [
      9, 19, 8, 13, 8, 8, 12, 28, 11, 11, 26, 19, 19, 25, 19, 30, 13, 9, 3,
      11, 14, 19, 11, 8, 15,
    ];

    const hdrRow = ws.addRow(headers);
    hdrRow.font = FONT_BOLD;

    ws.autoFilter = {
      from: 'A1',
      to: String.fromCharCode(64 + headers.length) + '1',
    };
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    for (const o of orders) {
      ws.addRow(
        headers.map((h) => {
          const v = o[h];
          if (v === undefined || v === null) return '';
          if (typeof v === 'object') return JSON.stringify(v);
          return v;
        }),
      );
    }

    colWidths.forEach((w, i) => {
      if (i < headers.length) ws.getColumn(i + 1).width = w;
    });
  }
}
