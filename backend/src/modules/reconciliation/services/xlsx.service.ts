import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ReconciliationDocument } from '../schemas/reconciliation.schema';

function fmtNum(n: number | undefined | null): string {
  if (n == null) return '0';
  return n.toLocaleString('vi-VN');
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

  private buildSheet1(wb: ExcelJS.Workbook, rec: ReconciliationDocument) {
    const ws = wb.addWorksheet('Tổng quan');

    // Header info
    ws.addRow(['Biên bản quyết toán']);
    ws.addRow(['Giải đấu:', rec.race_title]);
    ws.addRow(['Đơn vị tổ chức:', rec.tenant_name]);
    ws.addRow(['Kỳ quyết toán:', `${rec.period_start} đến ${rec.period_end}`]);
    ws.addRow([]);

    // Table A — 5BIB orders summary
    ws.addRow(['A. Đơn hàng 5BIB (ORDINARY / PERSONAL_GROUP / CHANGE_COURSE)']);
    ws.addRow(['Chỉ tiêu', 'Giá trị (VNĐ)']);
    ws.addRow(['Doanh thu gộp (gross_revenue)', rec.gross_revenue]);
    ws.addRow(['Tổng giảm giá (total_discount)', rec.total_discount]);
    ws.addRow(['Doanh thu thực (net_revenue)', rec.net_revenue]);
    ws.addRow([
      `Tỉ lệ phí (fee_rate_applied)`,
      rec.fee_rate_applied != null ? `${rec.fee_rate_applied}%` : 'Không áp dụng',
    ]);
    ws.addRow(['Tiền phí (fee_amount)', rec.fee_amount]);
    ws.addRow([`VAT trên phí (${rec.fee_vat_rate}%)`, rec.fee_vat_amount]);
    ws.addRow([]);

    // Table B — Manual orders
    ws.addRow(['B. Đơn hàng thủ công (MANUAL)']);
    ws.addRow(['Chỉ tiêu', 'Giá trị']);
    ws.addRow(['Số vé thủ công', rec.manual_ticket_count]);
    ws.addRow(['Doanh thu thủ công', rec.manual_gross_revenue]);
    ws.addRow(['Phí/vé thủ công (VNĐ)', rec.manual_fee_per_ticket]);
    ws.addRow(['Tổng phí thủ công', rec.manual_fee_amount]);
    ws.addRow([]);

    // Table C — Line items
    ws.addRow(['C. Chi tiết theo hạng mục']);
    ws.addRow(['Loại đơn', 'Cự ly', 'Giai đoạn', 'SL', 'Đơn giá', 'Giảm giá', 'Thành tiền', 'Add-on']);
    for (const li of rec.line_items) {
      ws.addRow([
        li.order_category,
        li.distance_name,
        li.ticket_type_name,
        li.quantity,
        li.unit_price,
        li.discount_amount,
        li.subtotal,
        li.add_on_price,
      ]);
    }
    ws.addRow([]);

    // Final totals
    ws.addRow(['D. Tổng quyết toán']);
    ws.addRow(['Điều chỉnh thủ công', rec.manual_adjustment]);
    if (rec.adjustment_note) {
      ws.addRow(['Ghi chú điều chỉnh', rec.adjustment_note]);
    }
    ws.addRow(['TIỀN THANH TOÁN CHO ĐƠN VỊ TỔ CHỨC (payout_amount)', rec.payout_amount]);

    // Style header row
    ws.getRow(1).font = { bold: true, size: 14 };
    ws.getColumn(1).width = 45;
    ws.getColumn(2).width = 30;
  }

  private buildSheet2(wb: ExcelJS.Workbook, rec: ReconciliationDocument) {
    const ws = wb.addWorksheet('Pivot');

    // Pivot: type_name × distance_name → qty & subtotal
    const typeNames = [...new Set(rec.line_items.map((li) => li.ticket_type_name))];
    const distances = [...new Set(rec.line_items.map((li) => li.distance_name))];

    // Header row
    const headerRow = ['Giai đoạn / Cự ly'];
    for (const d of distances) {
      headerRow.push(`${d} - SL`, `${d} - Thành tiền`);
    }
    headerRow.push('Tổng SL', 'Tổng thành tiền');
    ws.addRow(headerRow);
    ws.getRow(1).font = { bold: true };

    for (const typeName of typeNames) {
      const row: (string | number)[] = [typeName];
      let totalQty = 0;
      let totalSubtotal = 0;

      for (const d of distances) {
        const item = rec.line_items.find(
          (li) => li.ticket_type_name === typeName && li.distance_name === d,
        );
        const qty = item?.quantity ?? 0;
        const sub = item?.subtotal ?? 0;
        row.push(qty, sub);
        totalQty += qty;
        totalSubtotal += sub;
      }

      row.push(totalQty, totalSubtotal);
      ws.addRow(row);
    }

    ws.getColumn(1).width = 30;
    for (let i = 2; i <= headerRow.length; i++) {
      ws.getColumn(i).width = 18;
    }
  }

  private buildOrderSheet(
    ws: ExcelJS.Worksheet,
    orders: Array<Record<string, any>>,
  ) {
    const headers = [
      'STT', 'order_id', 'Loại đơn', 'Ngày xử lý', 'Họ tên', 'Email', 'SĐT',
      'Cự ly', 'Giai đoạn', 'SL', 'Đơn giá', 'Giảm giá', 'Thành tiền',
      'Add-on', 'Payment Ref', 'Mã giảm giá',
    ];
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD6E4F0' },
    };

    ws.autoFilter = { from: 'A1', to: `P1` };
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    let stt = 1;
    for (const r of orders) {
      ws.addRow([
        stt++,
        r.order_id,
        r.order_category,
        r.processed_on,
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
    }

    const colWidths = [6, 12, 20, 20, 25, 28, 15, 20, 25, 6, 14, 12, 14, 10, 20, 16];
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
