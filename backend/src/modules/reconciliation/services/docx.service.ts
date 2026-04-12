import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { ReconciliationDocument } from '../schemas/reconciliation.schema';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtVnd(n: number | undefined | null): string {
  if (n == null) return '0';
  return n.toLocaleString('vi-VN');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

// Standard font sizes (half-points)
const SZ_10 = 20; // 10pt
const SZ_12 = 24; // 12pt (unused but kept for reference)
const SZ_14 = 28; // 14pt
const SZ_18 = 36; // 18pt
const SZ_9 = 18; // 9pt

const FONT = 'Times New Roman';

const BORDER_NONE = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const BORDER_THIN = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
};

const LINE_SPACING = { line: 276 }; // 1.15x

/** Bordered table cell */
function tCell(
  texts: Array<{ text: string; bold?: boolean; size?: number }>,
  opts: {
    width?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    borders?: any;
    shading?: string;
    colspan?: number;
    vAlign?: (typeof VerticalAlign)[keyof typeof VerticalAlign];
  } = {},
): TableCell {
  return new TableCell({
    borders: opts.borders ?? BORDER_THIN,
    width: opts.width
      ? { size: opts.width, type: WidthType.DXA }
      : undefined,
    columnSpan: opts.colspan,
    verticalAlign: (opts.vAlign ?? VerticalAlign.CENTER) as any,
    shading: opts.shading
      ? {
          type: ShadingType.SOLID,
          color: opts.shading,
          fill: opts.shading,
        }
      : undefined,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: { before: 60, after: 60, ...LINE_SPACING },
        children: texts.map(
          (t) =>
            new TextRun({
              text: t.text,
              bold: t.bold ?? false,
              size: t.size ?? SZ_10,
              font: FONT,
            }),
        ),
      }),
    ],
  });
}

/** Simple paragraph */
function para(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingAfter?: number;
    spacingBefore?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: {
      before: opts.spacingBefore ?? 0,
      after: opts.spacingAfter ?? 0,
      ...LINE_SPACING,
    },
    children: [
      new TextRun({
        text,
        bold: opts.bold ?? false,
        size: opts.size ?? SZ_10,
        font: FONT,
      }),
    ],
  });
}

/** Multi-run paragraph */
function multiPara(
  runs: Array<{ text: string; bold?: boolean; size?: number }>,
  opts: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingAfter?: number;
    spacingBefore?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: {
      before: opts.spacingBefore ?? 0,
      after: opts.spacingAfter ?? 0,
      ...LINE_SPACING,
    },
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold ?? false,
          size: r.size ?? SZ_10,
          font: FONT,
        }),
    ),
  });
}

@Injectable()
export class DocxService {
  async generate(rec: ReconciliationDocument): Promise<Buffer> {
    const tenantMeta = (rec as any).tenant_metadata ?? {};
    const companyName =
      tenantMeta.companyName ?? tenantMeta.company_name ?? rec.tenant_name;
    const address = tenantMeta.address ?? '';
    const taxCode = tenantMeta.companyTax ?? tenantMeta.vat ?? '';
    const phone = tenantMeta.phone ?? '';
    const representative = tenantMeta.name ?? tenantMeta.representative ?? '';
    const repTitle = tenantMeta.position ?? 'Tổng Giám đốc';
    const bankAccount = tenantMeta.bankAccount ?? '';
    const bankName = tenantMeta.bankName ?? '';

    const periodStart = formatDate(rec.period_start);
    const periodEnd = formatDate(rec.period_end);
    const signedDate = formatDate(
      rec.signed_date_str ?? new Date().toISOString().slice(0, 10),
    );

    const payoutWords = this.numToWords(Math.round(rec.payout_amount));

    // Try to load logo
    let logoImage: ImageRun | null = null;
    try {
      const logoPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'assets',
        'logo_5BIB_white.png',
      );
      const logoData = fs.readFileSync(logoPath);
      logoImage = new ImageRun({
        data: logoData,
        transformation: { width: 112, height: 48 },
        type: 'png',
      });
    } catch {
      // logo not available — skip
    }

    // Calculate totals for display
    const totalQty = rec.line_items.reduce((s, li) => s + li.quantity, 0);
    const totalDiscount = rec.line_items.reduce(
      (s, li) => s + li.discount_amount,
      0,
    );

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: FONT, size: SZ_10 },
            paragraph: { spacing: LINE_SPACING },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1008,
                right: 1008,
                bottom: 1008,
                left: 1008,
              },
            },
          },
          footers: {
            default: {
              options: {
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: '5BIB | ',
                        font: FONT,
                        size: SZ_9,
                        color: '333333',
                      }),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        font: FONT,
                        size: SZ_9,
                        color: '333333',
                      }),
                    ],
                  }),
                ],
              },
            },
          },
          children: [
            // === 1. HEADER TABLE (logo + republic text) ===
            this.buildHeaderTable(logoImage),

            // === 2. TITLE BLOCK ===
            para('BIÊN BẢN QUYẾT TOÁN', {
              bold: true,
              size: SZ_18,
              align: AlignmentType.CENTER,
              spacingBefore: 240,
            }),
            para('DOANH THU BÁN VÉ SỰ KIỆN', {
              bold: true,
              size: SZ_14,
              align: AlignmentType.CENTER,
            }),
            para(rec.race_title, {
              bold: true,
              size: SZ_14,
              align: AlignmentType.CENTER,
            }),
            para(`(Từ ${periodStart} đến hết ${periodEnd})`, {
              bold: true,
              align: AlignmentType.CENTER,
              spacingAfter: 120,
            }),

            // === 3. PREAMBLE ===
            para(
              `Hôm nay, ngày ${signedDate}, tại Hà Nội, chúng tôi gồm có:`,
              { bold: true, spacingBefore: 120, spacingAfter: 120 },
            ),

            // === 4. PARTY INFO TABLE ===
            this.buildPartyTable(
              companyName,
              address,
              taxCode,
              phone,
              representative,
              repTitle,
              bankAccount,
              bankName,
            ),

            // === 5. TRANSITION PARAGRAPHS ===
            para(
              'Hai bên cùng nhau xác nhận kết quả đối soát doanh thu bán vé sự kiện như sau:',
              { bold: true, spacingBefore: 240, spacingAfter: 120 },
            ),
            para('NỘI DUNG NGHIỆM THU', {
              bold: true,
              spacingAfter: 60,
            }),
            para(
              'Doanh thu bán vé, Phí Dịch vụ và Giá trị thanh toán thực tế.',
              { bold: true, spacingAfter: 120 },
            ),

            // === 6. REVENUE DATA TABLE ===
            this.buildRevenueTable(rec, totalQty, totalDiscount),

            // === 7. DETAIL PARAGRAPHS ===
            para('', { spacingAfter: 120 }),
            multiPara(
              [
                {
                  text: `Tổng doanh thu bán vé qua 5BIB: `,
                  bold: true,
                },
                {
                  text: `${fmtVnd(rec.net_revenue)} đồng`,
                  bold: true,
                },
              ],
              { spacingAfter: 60 },
            ),
            multiPara(
              [
                {
                  text: `Phí bán vé (${rec.fee_rate_applied ?? 0}% doanh thu, chưa bao gồm thuế GTGT): `,
                },
                { text: `${fmtVnd(rec.fee_amount)} đồng`, bold: true },
              ],
              { spacingAfter: 60 },
            ),
            multiPara(
              [
                {
                  text: `Thuế GTGT (${rec.fee_vat_rate}%): `,
                },
                {
                  text: `${fmtVnd(rec.fee_vat_amount)} đồng`,
                  bold: true,
                },
              ],
              { spacingAfter: 60 },
            ),
            multiPara(
              [
                { text: 'Giá trị thanh toán thực tế: ', bold: true },
                {
                  text: `${fmtVnd(rec.payout_amount)} đồng`,
                  bold: true,
                },
              ],
              { spacingAfter: 60 },
            ),
            para(`(Bằng chữ: ${payoutWords})`, {
              bold: true,
              spacingAfter: 120,
            }),
            para(
              '* 5BIB sẽ xuất hóa đơn GTGT cho phí dịch vụ theo quy định.',
              { spacingAfter: 240 },
            ),

            // === 8. CONCLUSION ===
            para('KẾT LUẬN', { bold: true, spacingAfter: 120 }),
            para(
              'Hai bên đã đối soát và thống nhất các số liệu nêu trên. Biên bản được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản.',
              { spacingAfter: 240 },
            ),

            // === 9. SIGNATURE TABLE ===
            this.buildSignatureTable(
              companyName,
              representative,
              repTitle,
            ),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  /* ------------------------------------------------------------------ */
  /* Header table: logo | republic text                                  */
  /* ------------------------------------------------------------------ */
  private buildHeaderTable(logoImage: ImageRun | null): Table {
    const logoParagraph = logoImage
      ? new Paragraph({ children: [logoImage] })
      : new Paragraph({
          children: [
            new TextRun({ text: '5BIB', bold: true, size: SZ_14, font: FONT }),
          ],
        });

    return new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: BORDER_NONE,
              width: { size: 2000, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              children: [logoParagraph],
            }),
            new TableCell({
              borders: BORDER_NONE,
              width: { size: 7000, type: WidthType.DXA },
              children: [
                para('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', {
                  bold: true,
                  align: AlignmentType.CENTER,
                }),
                para('Độc lập - Tự do - Hạnh phúc', {
                  bold: true,
                  align: AlignmentType.CENTER,
                }),
                para('--- oOo ---', { align: AlignmentType.CENTER }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  /* ------------------------------------------------------------------ */
  /* Party info table (Bên A + Bên B)                                    */
  /* ------------------------------------------------------------------ */
  private buildPartyTable(
    companyName: string,
    address: string,
    taxCode: string,
    phone: string,
    representative: string,
    repTitle: string,
    bankAccount: string,
    bankName: string,
  ): Table {
    const labelW = 1700;
    const colonW = 200;
    const valueW = 7100;

    const infoRow = (
      label: string,
      value: string,
      valueBold = false,
    ): TableRow =>
      new TableRow({
        children: [
          tCell([{ text: label, bold: true }], { width: labelW }),
          tCell([{ text: ':' }], { width: colonW, align: AlignmentType.CENTER }),
          tCell([{ text: value, bold: valueBold }], {
            width: valueW,
            colspan: 4,
          }),
        ],
      });

    return new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: [
        // BÊN A header
        new TableRow({
          children: [
            tCell([{ text: 'BÊN A', bold: true }], { width: labelW }),
            tCell([{ text: ':' }], { width: colonW, align: AlignmentType.CENTER }),
            tCell([{ text: companyName, bold: true }], {
              width: valueW,
              colspan: 4,
            }),
          ],
        }),
        infoRow('Địa chỉ', address),
        infoRow('Mã số thuế', taxCode),
        infoRow('Điện thoại', phone),
        infoRow(
          'Người đại diện',
          `${representative}${repTitle ? `       Chức vụ: ${repTitle}` : ''}`,
          true,
        ),
        ...(bankAccount
          ? [
              infoRow('Tài khoản số', bankAccount),
              infoRow('Mở tại NH', bankName),
            ]
          : []),
        // Description row
        new TableRow({
          children: [
            tCell(
              [
                {
                  text: '(Sau đây gọi tắt là "Bên sử dụng dịch vụ")',
                  bold: true,
                },
              ],
              { colspan: 6 },
            ),
          ],
        }),
        // "Và" separator
        new TableRow({
          children: [
            tCell([{ text: 'Và', bold: true }], {
              colspan: 6,
              align: AlignmentType.CENTER,
            }),
          ],
        }),
        // BÊN B header
        new TableRow({
          children: [
            tCell([{ text: 'BÊN B', bold: true }], { width: labelW }),
            tCell([{ text: ':' }], { width: colonW, align: AlignmentType.CENTER }),
            tCell(
              [{ text: 'CÔNG TY CỔ PHẦN 5BIB', bold: true }],
              { width: valueW, colspan: 4 },
            ),
          ],
        }),
        infoRow('Địa chỉ', 'Số 8 Tôn Thất Thuyết, Phường Mỹ Đình 2, Quận Nam Từ Liêm, TP. Hà Nội'),
        infoRow('Mã số thuế', '0110398986'),
        infoRow('Điện thoại', '1900 636 997'),
        infoRow('Người đại diện', 'Ông NGUYỄN BÌNH MINH       Chức vụ: Giám Đốc', true),
        infoRow('Tài khoản số', '34110001234567'),
        infoRow('Mở tại NH', 'BIDV - Chi nhánh Hà Nội'),
        new TableRow({
          children: [
            tCell(
              [
                {
                  text: '(Sau đây gọi tắt là "Bên cung cấp dịch vụ")',
                  bold: true,
                },
              ],
              { colspan: 6 },
            ),
          ],
        }),
      ],
    });
  }

  /* ------------------------------------------------------------------ */
  /* Revenue data table (matches reference: 6 cols, blue header)         */
  /* ------------------------------------------------------------------ */
  private buildRevenueTable(
    rec: ReconciliationDocument,
    totalQty: number,
    totalDiscount: number,
  ): Table {
    const HEADER_BG = 'BDD7EE';
    const colWidths = [2300, 750, 880, 940, 750, 1240];

    // Header row
    const headerRow = new TableRow({
      children: [
        tCell([{ text: 'Cự ly', bold: true }], {
          width: colWidths[0],
          shading: HEADER_BG,
        }),
        tCell([{ text: 'Giai đoạn', bold: true }], {
          width: colWidths[1],
          shading: HEADER_BG,
        }),
        tCell([{ text: 'Đơn giá', bold: true }], {
          width: colWidths[2],
          shading: HEADER_BG,
          align: AlignmentType.RIGHT,
        }),
        tCell([{ text: 'Số lượng BIB', bold: true }], {
          width: colWidths[3],
          shading: HEADER_BG,
          align: AlignmentType.RIGHT,
        }),
        tCell([{ text: 'Giảm giá', bold: true }], {
          width: colWidths[4],
          shading: HEADER_BG,
          align: AlignmentType.RIGHT,
        }),
        tCell([{ text: 'Tổng cộng', bold: true }], {
          width: colWidths[5],
          shading: HEADER_BG,
          align: AlignmentType.RIGHT,
        }),
      ],
    });

    // Sub-header (formula labels)
    const subHeaderRow = new TableRow({
      children: [
        tCell([{ text: '' }], { width: colWidths[0] }),
        tCell([{ text: '' }], { width: colWidths[1] }),
        tCell([{ text: '(a)' }], {
          width: colWidths[2],
          align: AlignmentType.CENTER,
        }),
        tCell([{ text: '(b)' }], {
          width: colWidths[3],
          align: AlignmentType.CENTER,
        }),
        tCell([{ text: '(c)' }], {
          width: colWidths[4],
          align: AlignmentType.CENTER,
        }),
        tCell([{ text: '(d) = (a) x (b) - (c)' }], {
          width: colWidths[5],
          align: AlignmentType.CENTER,
        }),
      ],
    });

    // Data rows
    const dataRows: TableRow[] = rec.line_items.map(
      (li) =>
        new TableRow({
          children: [
            tCell([{ text: li.distance_name }], { width: colWidths[0] }),
            tCell([{ text: li.ticket_type_name }], { width: colWidths[1] }),
            tCell([{ text: fmtVnd(li.unit_price) }], {
              width: colWidths[2],
              align: AlignmentType.RIGHT,
            }),
            tCell([{ text: String(li.quantity) }], {
              width: colWidths[3],
              align: AlignmentType.RIGHT,
            }),
            tCell([{ text: fmtVnd(li.discount_amount) }], {
              width: colWidths[4],
              align: AlignmentType.RIGHT,
            }),
            tCell([{ text: fmtVnd(li.subtotal) }], {
              width: colWidths[5],
              align: AlignmentType.RIGHT,
            }),
          ],
        }),
    );

    // Summary rows
    const summaryRows: TableRow[] = [
      // Tổng cộng (1)
      new TableRow({
        children: [
          tCell([{ text: 'Tổng cộng (1)', bold: true }], {
            colspan: 3,
          }),
          tCell([{ text: String(totalQty), bold: true }], {
            align: AlignmentType.RIGHT,
          }),
          tCell([{ text: fmtVnd(totalDiscount), bold: true }], {
            align: AlignmentType.RIGHT,
          }),
          tCell([{ text: fmtVnd(rec.net_revenue), bold: true }], {
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
      // Phí bán vé (2)
      new TableRow({
        children: [
          tCell(
            [
              {
                text: 'Phí bán vé (chưa bao gồm thuế GTGT) (2)',
                bold: true,
              },
            ],
            { colspan: 5 },
          ),
          tCell([{ text: fmtVnd(rec.fee_amount), bold: true }], {
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
      // Thuế GTGT (3)
      new TableRow({
        children: [
          tCell(
            [{ text: `Thuế GTGT (${rec.fee_vat_rate}%) (3)`, bold: true }],
            { colspan: 5 },
          ),
          tCell([{ text: fmtVnd(rec.fee_vat_amount), bold: true }], {
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
      // Hoàn trả merchant (4)
      new TableRow({
        children: [
          tCell(
            [{ text: 'Hoàn trả merchant (4) = (1) - (2) - (3)', bold: true }],
            { colspan: 5 },
          ),
          tCell([{ text: fmtVnd(rec.payout_amount), bold: true }], {
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
    ];

    return new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: [headerRow, subHeaderRow, ...dataRows, ...summaryRows],
    });
  }

  /* ------------------------------------------------------------------ */
  /* Signature table                                                     */
  /* ------------------------------------------------------------------ */
  private buildSignatureTable(
    companyName: string,
    representative: string,
    repTitle: string,
  ): Table {
    return new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: BORDER_NONE,
              width: { size: 4500, type: WidthType.DXA },
              children: [
                para(`ĐẠI DIỆN BÊN SỬ DỤNG`, {
                  bold: true,
                  align: AlignmentType.CENTER,
                }),
                para(companyName.toUpperCase(), {
                  bold: true,
                  align: AlignmentType.CENTER,
                  spacingAfter: 60,
                }),
              ],
            }),
            new TableCell({
              borders: BORDER_NONE,
              width: { size: 4500, type: WidthType.DXA },
              children: [
                para('ĐẠI DIỆN BÊN CUNG CẤP', {
                  bold: true,
                  align: AlignmentType.CENTER,
                }),
                para('CÔNG TY CỔ PHẦN 5BIB', {
                  bold: true,
                  align: AlignmentType.CENTER,
                  spacingAfter: 60,
                }),
              ],
            }),
          ],
        }),
        // Blank space for signatures
        new TableRow({
          children: [
            new TableCell({
              borders: BORDER_NONE,
              shading: {
                type: ShadingType.SOLID,
                color: 'F2F2F2',
                fill: 'F2F2F2',
              },
              children: [
                para('', { spacingAfter: 1200 }),
                para(representative || '...........', {
                  bold: true,
                  align: AlignmentType.CENTER,
                }),
                para(repTitle || '', {
                  align: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              borders: BORDER_NONE,
              shading: {
                type: ShadingType.SOLID,
                color: 'F2F2F2',
                fill: 'F2F2F2',
              },
              children: [
                para('', { spacingAfter: 1200 }),
                para('NGUYỄN BÌNH MINH', {
                  bold: true,
                  align: AlignmentType.CENTER,
                }),
                para('Giám Đốc', {
                  align: AlignmentType.CENTER,
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  /* ------------------------------------------------------------------ */
  /* Vietnamese number to words                                          */
  /* ------------------------------------------------------------------ */
  private numToWords(amount: number): string {
    if (amount === 0) return 'Không đồng';
    if (amount < 0) return 'Âm ' + this.numToWords(-amount);

    const units = [
      '',
      'một',
      'hai',
      'ba',
      'bốn',
      'năm',
      'sáu',
      'bảy',
      'tám',
      'chín',
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
        result += units[ones];
      }

      return result.trim();
    };

    const billion = Math.floor(amount / 1_000_000_000);
    const million = Math.floor((amount % 1_000_000_000) / 1_000_000);
    const thousand = Math.floor((amount % 1_000_000) / 1_000);
    const remainder = Math.round(amount % 1_000);

    let result = '';
    if (billion > 0) result += convertThreeDigit(billion) + ' tỷ ';
    if (million > 0) result += convertThreeDigit(million) + ' triệu ';
    if (thousand > 0) result += convertThreeDigit(thousand) + ' nghìn ';
    if (remainder > 0) result += convertThreeDigit(remainder);

    result = result.trim();
    return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
  }
}
