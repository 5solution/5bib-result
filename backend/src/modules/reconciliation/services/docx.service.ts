import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { ReconciliationDocument } from '../schemas/reconciliation.schema';

function fmtNum(n: number | undefined | null): string {
  if (n == null) return '0';
  return Math.round(n).toLocaleString('vi-VN');
}

const BORDER_NONE = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
};

const BORDER_THIN = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
};

const BORDER_THICK = {
  top: { style: BorderStyle.SINGLE, size: 8, color: '1E4E79' },
  bottom: { style: BorderStyle.SINGLE, size: 8, color: '1E4E79' },
  left: { style: BorderStyle.SINGLE, size: 8, color: '1E4E79' },
  right: { style: BorderStyle.SINGLE, size: 8, color: '1E4E79' },
};

// Table width: ~16cm in DXA (1 inch = 1440 DXA, 16cm ≈ 9072 DXA)
const TABLE_WIDTH = 9072;

function dataCell(
  text: string,
  opts: {
    bold?: boolean;
    width?: number;
    center?: boolean;
    shade?: string;
    colSpan?: number;
    rightAlign?: boolean;
  } = {},
): TableCell {
  const shade = opts.shade;
  return new TableCell({
    borders: BORDER_THIN,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    columnSpan: opts.colSpan,
    shading: shade
      ? { type: ShadingType.CLEAR, color: 'auto', fill: shade }
      : undefined,
    children: [
      new Paragraph({
        alignment: opts.center
          ? AlignmentType.CENTER
          : opts.rightAlign
            ? AlignmentType.RIGHT
            : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts.bold,
            size: 22,
            color: shade && shade !== 'FFFFFF' && shade !== 'F2F2F2'
              ? 'FFFFFF'
              : '000000',
          }),
        ],
        spacing: { before: 40, after: 40 },
      }),
    ],
  });
}

function sectionHeaderRow(text: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        borders: BORDER_THICK,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1E4E79' },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text, bold: true, size: 22, color: 'FFFFFF' }),
            ],
            spacing: { before: 60, after: 60 },
          }),
        ],
      }),
    ],
  });
}

function summaryRow(
  label: string,
  value: string,
  isTotal = false,
): TableRow {
  const shade = isTotal ? 'FFF2CC' : undefined;
  return new TableRow({
    children: [
      dataCell(label, { bold: isTotal, width: 5500, shade }),
      dataCell(value, { bold: isTotal, width: 3572, rightAlign: true, shade }),
    ],
  });
}

function para(
  text: string,
  bold = false,
  center = false,
): Paragraph {
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({ text, bold, size: bold ? 24 : 22 })],
    spacing: { after: 100 },
  });
}

@Injectable()
export class DocxService {
  async generate(rec: ReconciliationDocument): Promise<Buffer> {
    const tenantMeta = (rec as any).tenant_metadata ?? {};
    const companyName = tenantMeta.companyName ?? rec.tenant_name ?? '';
    const address = tenantMeta.address ?? '';
    const taxCode = tenantMeta.companyTax ?? tenantMeta.vat ?? '';
    const phone = tenantMeta.phone ?? '';
    const representative = tenantMeta.name ?? '';

    const payoutWords = this.numToWords(Math.round(rec.payout_amount ?? 0));

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              // A4: 210 × 297mm → DXA (1mm ≈ 56.69 DXA)
              size: { width: 11906, height: 16838 },
              margin: {
                top: 1418,    // 25mm
                bottom: 1418, // 25mm
                left: 1701,   // 30mm
                right: 1134,  // 20mm
              },
            },
          },
          children: [
            // ── TITLE ──
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new TextRun({
                  text: 'Độc lập - Tự do - Hạnh phúc',
                  italics: true,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: 'BIÊN BẢN QUYẾT TOÁN',
                  bold: true,
                  size: 32,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
              children: [
                new TextRun({
                  text: `(Kỳ quyết toán: ${rec.period_start} đến ${rec.period_end})`,
                  size: 22,
                  italics: true,
                }),
              ],
            }),

            // ── Race info ──
            para(`Giải đấu: ${rec.race_title}`, true),
            para(
              `Ngày lập: ${rec.signed_date_str ?? new Date().toISOString().slice(0, 10)}`,
            ),
            new Paragraph({ spacing: { after: 240 }, children: [] }),

            // ── BÊN A ──
            para('BÊN A (ĐƠN VỊ TỔ CHỨC):', true),
            para(`Tên công ty/đơn vị: ${companyName}`),
            ...(address ? [para(`Địa chỉ: ${address}`)] : []),
            ...(taxCode ? [para(`Mã số thuế: ${taxCode}`)] : []),
            ...(phone ? [para(`Điện thoại: ${phone}`)] : []),
            ...(representative ? [para(`Đại diện: ${representative}`)] : []),
            new Paragraph({ spacing: { after: 200 }, children: [] }),

            // ── BÊN B ──
            para('BÊN B (ĐƠN VỊ CUNG CẤP DỊCH VỤ):', true),
            para('Tên công ty: CÔNG TY CỔ PHẦN 5BIB'),
            para('Mã số thuế: 0110398986'),
            para('Đại diện: Ông NGUYỄN BÌNH MINH — Chức vụ: Giám đốc'),
            para('Ngân hàng: BIDV — Chi nhánh Hà Nội'),
            para('Số tài khoản: 34110001234567'),
            new Paragraph({ spacing: { after: 300 }, children: [] }),

            // ── NỘI DUNG QUYẾT TOÁN ──
            para('HAI BÊN CÙNG THỐNG NHẤT NỘI DUNG QUYẾT TOÁN SAU:', true),
            new Paragraph({ spacing: { after: 120 }, children: [] }),

            new Table({
              width: { size: TABLE_WIDTH, type: WidthType.DXA },
              rows: [
                // Section I — 5BIB orders
                sectionHeaderRow('I. ĐƠN HÀNG 5BIB'),
                summaryRow('Doanh thu gộp (gross revenue)', fmtNum(rec.gross_revenue)),
                summaryRow('Tổng giảm giá (discount)', fmtNum(rec.total_discount)),
                summaryRow('Doanh thu thực (net revenue)', fmtNum(rec.net_revenue)),
                summaryRow(
                  `Phí dịch vụ${rec.fee_rate_applied != null ? ` (${rec.fee_rate_applied}%)` : ''}`,
                  fmtNum(rec.fee_amount),
                ),
                summaryRow(
                  `VAT trên phí dịch vụ (${rec.fee_vat_rate ?? 0}%)`,
                  fmtNum(rec.fee_vat_amount),
                ),

                // Section II — Manual orders
                sectionHeaderRow('II. ĐƠN HÀNG THỦ CÔNG (MANUAL)'),
                summaryRow('Số vé thủ công', String(rec.manual_ticket_count ?? 0)),
                summaryRow(
                  `Phí dịch vụ/vé thủ công (${fmtNum(rec.manual_fee_per_ticket)} VNĐ/vé)`,
                  fmtNum(rec.manual_fee_amount),
                ),

                // Section III — Adjustments
                ...(rec.manual_adjustment !== 0
                  ? [
                      sectionHeaderRow('III. ĐIỀU CHỈNH'),
                      summaryRow('Điều chỉnh thủ công', fmtNum(rec.manual_adjustment)),
                      ...(rec.adjustment_note
                        ? [summaryRow('Ghi chú', rec.adjustment_note)]
                        : []),
                    ]
                  : []),

                // Total
                new TableRow({
                  children: [
                    new TableCell({
                      borders: BORDER_THICK,
                      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF2CC' },
                      width: { size: 5500, type: WidthType.DXA },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: 'TIỀN THANH TOÁN CHO BÊN A',
                              bold: true,
                              size: 24,
                              color: '1E4E79',
                            }),
                          ],
                          spacing: { before: 80, after: 80 },
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: BORDER_THICK,
                      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF2CC' },
                      width: { size: 3572, type: WidthType.DXA },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: fmtNum(rec.payout_amount),
                              bold: true,
                              size: 24,
                              color: '1E4E79',
                            }),
                          ],
                          spacing: { before: 80, after: 80 },
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            new Paragraph({ spacing: { after: 200 }, children: [] }),
            para(`Bằng chữ: ${payoutWords}`, true),
            new Paragraph({ spacing: { after: 400 }, children: [] }),

            // ── Chi tiết hạng mục 5BIB ──
            ...(rec.line_items.length > 0
              ? [
                  para('CHI TIẾT THEO HẠNG MỤC ĐƠN 5BIB:', true),
                  new Paragraph({ spacing: { after: 120 }, children: [] }),
                  new Table({
                    width: { size: TABLE_WIDTH, type: WidthType.DXA },
                    rows: [
                      new TableRow({
                        children: [
                          dataCell('Loại đơn', {
                            bold: true,
                            width: 2000,
                            center: true,
                            shade: 'D6E4F0',
                          }),
                          dataCell('Cự ly', {
                            bold: true,
                            width: 2000,
                            center: true,
                            shade: 'D6E4F0',
                          }),
                          dataCell('Giai đoạn', {
                            bold: true,
                            width: 2500,
                            center: true,
                            shade: 'D6E4F0',
                          }),
                          dataCell('SL', {
                            bold: true,
                            width: 572,
                            center: true,
                            shade: 'D6E4F0',
                          }),
                          dataCell('Thành tiền', {
                            bold: true,
                            width: 2000,
                            center: true,
                            shade: 'D6E4F0',
                          }),
                        ],
                      }),
                      ...rec.line_items.map(
                        (li) =>
                          new TableRow({
                            children: [
                              dataCell(li.order_category, { width: 2000 }),
                              dataCell(li.distance_name, { width: 2000 }),
                              dataCell(li.ticket_type_name, { width: 2500 }),
                              dataCell(String(li.quantity), {
                                width: 572,
                                center: true,
                              }),
                              dataCell(fmtNum(li.subtotal), {
                                width: 2000,
                                rightAlign: true,
                              }),
                            ],
                          }),
                      ),
                    ],
                  }),
                  new Paragraph({ spacing: { after: 300 }, children: [] }),
                ]
              : []),

            // ── Chi tiết đơn thủ công ──
            ...(rec.manual_orders.length > 0
              ? [
                  para('CHI TIẾT ĐƠN HÀNG THỦ CÔNG:', true),
                  new Paragraph({ spacing: { after: 120 }, children: [] }),
                  new Table({
                    width: { size: TABLE_WIDTH, type: WidthType.DXA },
                    rows: [
                      new TableRow({
                        children: [
                          dataCell('STT', {
                            bold: true,
                            width: 500,
                            center: true,
                            shade: 'D6E4F0',
                          }),
                          dataCell('Order ID', {
                            bold: true,
                            width: 1000,
                            center: true,
                            shade: 'D6E4F0',
                          }),
                          dataCell('Họ tên', {
                            bold: true,
                            width: 2500,
                            shade: 'D6E4F0',
                          }),
                          dataCell('Giai đoạn', {
                            bold: true,
                            width: 2000,
                            shade: 'D6E4F0',
                          }),
                          dataCell('SL', {
                            bold: true,
                            width: 500,
                            center: true,
                            shade: 'D6E4F0',
                          }),
                          dataCell('Thành tiền', {
                            bold: true,
                            width: 2572,
                            center: true,
                            shade: 'D6E4F0',
                          }),
                        ],
                      }),
                      ...rec.manual_orders.map(
                        (mo, idx) =>
                          new TableRow({
                            children: [
                              dataCell(String(idx + 1), {
                                width: 500,
                                center: true,
                              }),
                              dataCell(String(mo.order_id), {
                                width: 1000,
                                center: true,
                              }),
                              dataCell(mo.participant_name, { width: 2500 }),
                              dataCell(mo.ticket_type_name, { width: 2000 }),
                              dataCell(String(mo.quantity), {
                                width: 500,
                                center: true,
                              }),
                              dataCell(fmtNum(mo.subtotal), {
                                width: 2572,
                                rightAlign: true,
                              }),
                            ],
                          }),
                      ),
                    ],
                  }),
                  new Paragraph({ spacing: { after: 400 }, children: [] }),
                ]
              : []),

            // ── Signatures ──
            para('XÁC NHẬN CỦA CÁC BÊN:', true),
            new Paragraph({ spacing: { after: 120 }, children: [] }),
            new Table({
              width: { size: TABLE_WIDTH, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      borders: BORDER_NONE,
                      width: { size: 4536, type: WidthType.DXA },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: 'BÊN A', bold: true, size: 22 }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: '(Ký, ghi rõ họ tên)',
                              size: 20,
                              italics: true,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: BORDER_NONE,
                      width: { size: 4536, type: WidthType.DXA },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: 'BÊN B', bold: true, size: 22 }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: '(Ký, ghi rõ họ tên)',
                              size: 20,
                              italics: true,
                            }),
                          ],
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
                        new Paragraph({
                          spacing: { after: 1200 },
                          children: [],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: representative || '..............................',
                              size: 22,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: BORDER_NONE,
                      children: [
                        new Paragraph({
                          spacing: { after: 1200 },
                          children: [],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: 'NGUYỄN BÌNH MINH',
                              size: 22,
                            }),
                          ],
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
    if (!Number.isFinite(amount) || amount === 0) return 'Không đồng';
    if (amount < 0) return 'Âm ' + this.numToWords(-amount);

    const units = [
      '', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín',
    ];

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
        // nothing to add
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

    result = result.trim();
    return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
  }
}
