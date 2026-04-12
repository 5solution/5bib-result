import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { ReconciliationDocument } from '../schemas/reconciliation.schema';

function fmtNum(n: number | undefined | null): string {
  if (n == null) return '0';
  return n.toLocaleString('vi-VN');
}

const BORDER_NONE = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
};

const BORDER_THIN = {
  top: { style: BorderStyle.SINGLE, size: 1 },
  bottom: { style: BorderStyle.SINGLE, size: 1 },
  left: { style: BorderStyle.SINGLE, size: 1 },
  right: { style: BorderStyle.SINGLE, size: 1 },
};

function cell(text: string, bold = false, width?: number): TableCell {
  return new TableCell({
    borders: BORDER_THIN,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 22 })],
      }),
    ],
  });
}

function para(text: string, bold = false, center = false, heading?: typeof HeadingLevel[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({
    heading,
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({ text, bold, size: bold ? 26 : 22 })],
    spacing: { after: 100 },
  });
}

@Injectable()
export class DocxService {
  async generate(rec: ReconciliationDocument): Promise<Buffer> {
    const tenantMeta = (rec as any).tenant_metadata ?? {};
    const companyName = tenantMeta.companyName ?? rec.tenant_name;
    const address = tenantMeta.address ?? '';
    const taxCode = tenantMeta.companyTax ?? tenantMeta.vat ?? '';
    const phone = tenantMeta.phone ?? '';
    const representative = tenantMeta.name ?? '';

    const payoutWords = this.numToWords(rec.payout_amount);

    const doc = new Document({
      sections: [
        {
          children: [
            // Title
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [new TextRun({ text: 'BIÊN BẢN QUYẾT TOÁN', bold: true, size: 32 })],
            }),

            // Race info
            para(`Giải đấu: ${rec.race_title}`, true),
            para(`Kỳ quyết toán: ${rec.period_start} đến ${rec.period_end}`),
            para(
              `Ngày lập: ${rec.signed_date_str ?? new Date().toISOString().slice(0, 10)}`,
            ),
            new Paragraph({ spacing: { after: 200 }, children: [] }),

            // Bên A — Merchant
            para('BÊN A (ĐƠN VỊ TỔ CHỨC):', true),
            para(`Tên công ty: ${companyName}`),
            para(`Địa chỉ: ${address}`),
            para(`MST: ${taxCode}`),
            para(`Điện thoại: ${phone}`),
            para(`Đại diện: ${representative}`),
            new Paragraph({ spacing: { after: 200 }, children: [] }),

            // Bên B — 5BIB
            para('BÊN B (ĐƠN VỊ CUNG CẤP DỊCH VỤ):', true),
            para('Tên công ty: CÔNG TY CỔ PHẦN 5BIB'),
            para('MST: 0110398986'),
            para('Đại diện: Ông NGUYỄN BÌNH MINH, Giám đốc'),
            para('Ngân hàng: BIDV - Chi nhánh Hà Nội'),
            para('STK: 34110001234567'),
            new Paragraph({ spacing: { after: 200 }, children: [] }),

            // Main reconciliation table
            para('NỘI DUNG QUYẾT TOÁN:', true),
            new Table({
              width: { size: 9000, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    cell('Chỉ tiêu', true, 5000),
                    cell('Giá trị (VNĐ)', true, 4000),
                  ],
                }),
                new TableRow({
                  children: [
                    cell('I. Đơn hàng 5BIB', true),
                    cell(''),
                  ],
                }),
                new TableRow({
                  children: [
                    cell('Doanh thu gộp'),
                    cell(fmtNum(rec.gross_revenue)),
                  ],
                }),
                new TableRow({
                  children: [
                    cell('Tổng giảm giá'),
                    cell(fmtNum(rec.total_discount)),
                  ],
                }),
                new TableRow({
                  children: [
                    cell('Doanh thu thực (net)'),
                    cell(fmtNum(rec.net_revenue)),
                  ],
                }),
                new TableRow({
                  children: [
                    cell(
                      `Phí dịch vụ${rec.fee_rate_applied != null ? ` (${rec.fee_rate_applied}%)` : ''}`,
                    ),
                    cell(fmtNum(rec.fee_amount)),
                  ],
                }),
                new TableRow({
                  children: [
                    cell(`VAT trên phí (${rec.fee_vat_rate}%)`),
                    cell(fmtNum(rec.fee_vat_amount)),
                  ],
                }),
                new TableRow({
                  children: [
                    cell('II. Đơn hàng thủ công (MANUAL)', true),
                    cell(''),
                  ],
                }),
                new TableRow({
                  children: [
                    cell('Số vé thủ công'),
                    cell(String(rec.manual_ticket_count)),
                  ],
                }),
                new TableRow({
                  children: [
                    cell('Phí/vé thủ công (VNĐ)'),
                    cell(fmtNum(rec.manual_fee_per_ticket)),
                  ],
                }),
                new TableRow({
                  children: [
                    cell('Tổng phí thủ công'),
                    cell(fmtNum(rec.manual_fee_amount)),
                  ],
                }),
                new TableRow({
                  children: [
                    cell('III. Điều chỉnh', true),
                    cell(''),
                  ],
                }),
                new TableRow({
                  children: [
                    cell('Điều chỉnh thủ công'),
                    cell(fmtNum(rec.manual_adjustment)),
                  ],
                }),
                ...(rec.adjustment_note
                  ? [
                      new TableRow({
                        children: [
                          cell('Ghi chú điều chỉnh'),
                          cell(rec.adjustment_note),
                        ],
                      }),
                    ]
                  : []),
                new TableRow({
                  children: [
                    cell('TIỀN THANH TOÁN CHO BÊN A', true),
                    cell(fmtNum(rec.payout_amount), true),
                  ],
                }),
              ],
            }),
            new Paragraph({ spacing: { after: 200 }, children: [] }),

            // Amount in words
            para(`Bằng chữ: ${payoutWords}`, true),
            new Paragraph({ spacing: { after: 400 }, children: [] }),

            // Line items breakdown
            para('CHI TIẾT THEO HẠNG MỤC:', true),
            new Table({
              width: { size: 9000, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    cell('Loại đơn', true, 2000),
                    cell('Cự ly', true, 2000),
                    cell('Giai đoạn', true, 2000),
                    cell('SL', true, 800),
                    cell('Thành tiền', true, 2200),
                  ],
                }),
                ...rec.line_items.map(
                  (li) =>
                    new TableRow({
                      children: [
                        cell(li.order_category),
                        cell(li.distance_name),
                        cell(li.ticket_type_name),
                        cell(String(li.quantity)),
                        cell(fmtNum(li.subtotal)),
                      ],
                    }),
                ),
              ],
            }),
            new Paragraph({ spacing: { after: 400 }, children: [] }),

            // Signatures
            para('XÁC NHẬN CỦA CÁC BÊN:', true),
            new Table({
              width: { size: 9000, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      borders: BORDER_NONE,
                      width: { size: 4500, type: WidthType.DXA },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: 'BÊN A', bold: true, size: 22 })],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: '(Ký, ghi rõ họ tên)', size: 20, italics: true })],
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: BORDER_NONE,
                      width: { size: 4500, type: WidthType.DXA },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: 'BÊN B', bold: true, size: 22 })],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: '(Ký, ghi rõ họ tên)', size: 20, italics: true })],
                        }),
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      borders: BORDER_NONE,
                      children: [
                        new Paragraph({ spacing: { after: 1200 }, children: [] }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: representative || '...........', size: 22 })],
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: BORDER_NONE,
                      children: [
                        new Paragraph({ spacing: { after: 1200 }, children: [] }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: 'NGUYỄN BÌNH MINH', size: 22 })],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  private numToWords(amount: number): string {
    if (amount === 0) return 'Không đồng';
    if (amount < 0) return 'Âm ' + this.numToWords(-amount);

    const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

    const convertThreeDigit = (n: number): string => {
      const hundreds = Math.floor(n / 100);
      const remainder = n % 100;
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;

      let result = '';

      if (hundreds > 0) {
        result += units[hundreds] + ' trăm';
        if (remainder > 0) result += ' ';
      }

      if (tens === 0 && ones === 0) {
        // nothing
      } else if (tens === 0 && hundreds > 0) {
        result += 'lẻ ' + units[ones];
      } else if (tens === 1) {
        result += 'mười';
        if (ones === 1) result += ' một';
        else if (ones === 5) result += ' lăm';
        else if (ones > 0) result += ' ' + units[ones];
      } else if (tens > 1) {
        result += units[tens] + ' mươi';
        if (ones === 1) result += ' mốt';
        else if (ones === 5) result += ' lăm';
        else if (ones > 0) result += ' ' + units[ones];
      } else {
        // tens === 0, no hundreds
        result += units[ones];
      }

      return result.trim();
    };

    const billion = Math.floor(amount / 1_000_000_000);
    const million = Math.floor((amount % 1_000_000_000) / 1_000_000);
    const thousand = Math.floor((amount % 1_000_000) / 1_000);
    const remainder = amount % 1_000;

    let result = '';
    if (billion > 0) result += convertThreeDigit(billion) + ' tỷ ';
    if (million > 0) result += convertThreeDigit(million) + ' triệu ';
    if (thousand > 0) result += convertThreeDigit(thousand) + ' nghìn ';
    if (remainder > 0) result += convertThreeDigit(remainder);

    // Capitalize first letter
    result = result.trim();
    return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
  }
}
