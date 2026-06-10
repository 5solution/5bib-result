import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { ReconciliationDocument } from '../schemas/reconciliation.schema';
import {
  MerchantConfig,
  MerchantConfigDocument,
} from '../../merchant/schemas/merchant-config.schema';
import { env } from 'src/config';
import { renderPeriodLabel } from './period-label.helper';
import { nowIctDateString } from '../../../common/utils/ict-date.util';

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
  private readonly logger = new Logger(DocxService.name);

  constructor(
    @InjectModel(MerchantConfig.name)
    private readonly merchantConfigModel: Model<MerchantConfigDocument>,
  ) {}

  async generate(rec: ReconciliationDocument): Promise<Buffer> {
    /**
     * BUG-FIX 2026-05-14 (Danny report screenshot Zaha #46): DOCX dùng
     * `tenant_metadata` (sync readonly từ 5BIB platform) thay vì
     * `MerchantConfig` admin-entered tab "Công ty đối tác".
     *
     * Priority resolution (highest → lowest):
     *   1. MerchantConfig admin-entered ("Công ty đối tác" tab) — single source of truth
     *      khi admin đã nhập legal/banking info chính xác
     *   2. `tenant_metadata` sync từ platform — fallback nếu admin chưa nhập
     *   3. `rec.tenant_name` cuối cùng cho companyName fallback
     *
     * Áp dụng 8 field: companyName/legal_name, taxCode, address, representative,
     * representative_title, bankAccount, bankName. Phone giữ từ platform vì
     * MerchantConfig schema chưa có field phone admin-entered.
     */
    const tenantMeta = (rec as any).tenant_metadata ?? {};

    const mc = await this.merchantConfigModel
      .findOne({ tenantId: rec.tenant_id })
      .lean()
      .catch((err) => {
        this.logger.warn(
          `docx_merchant_config_fetch_failed tenant=${rec.tenant_id}: ${(err as Error).message}`,
        );
        return null;
      });

    const companyName =
      mc?.legal_name ??
      tenantMeta.companyName ??
      tenantMeta.company_name ??
      rec.tenant_name;
    const address = mc?.business_address ?? tenantMeta.address ?? '';
    const taxCode =
      mc?.tax_code ?? tenantMeta.companyTax ?? tenantMeta.vat ?? '';
    const phone = tenantMeta.phone ?? '';
    const representative =
      mc?.representative_name ??
      tenantMeta.name ??
      tenantMeta.representative ??
      '';
    const repTitle =
      mc?.representative_title ?? tenantMeta.position ?? 'Tổng Giám đốc';
    const bankAccount = mc?.bank_account ?? tenantMeta.bankAccount ?? '';
    const bankName = mc?.bank_name ?? tenantMeta.bankName ?? '';

    // Audit log: which source won (debugging future bugs)
    this.logger.log(
      `docx_merchant_source tenant=${rec.tenant_id} mc=${mc ? 'yes' : 'no'} ` +
        `companyName=${mc?.legal_name ? 'mc' : tenantMeta.companyName ? 'meta' : 'tenant_name'}`,
    );

    const periodLabel = renderPeriodLabel(rec.period_start, rec.period_end);
    const signedDate = formatDate(
      rec.signed_date_str ?? nowIctDateString(),
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
            para(`Kỳ đối soát: ${periodLabel}`, {
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
  /* Header table: republic text full-width (logo removed F-037 v4)       */
  /* ------------------------------------------------------------------ */
  private buildHeaderTable(_logoImage: ImageRun | null): Table {
    // FEATURE-037 v4 (Danny 2026-05-15 chốt): logo image cell render distort
    // qua Google Drive viewer / Mac Preview (image placeholder shape rỗng,
    // không hiển thị logo đúng). MS Word OK, các viewer khác không.
    // Decision: BỎ logo, header chỉ còn text "CỘNG HÒA..." centered
    // full-width (single cell, no logo column). Cleaner + universal viewer
    // compat.
    //
    // _logoImage param giữ signature backward-compat — load logoImage trong
    // generate() vẫn try nhưng KHÔNG render.
    return new Table({
      width: { size: 9000, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [9000],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: BORDER_NONE,
              width: { size: 9000, type: WidthType.DXA },
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
      // FEATURE-037 v3 fix — fixed layout + columnWidths explicit cho 6 cols:
      // labelW + colonW + 4 × (valueW/4) = 1700 + 200 + 4 × 1775 = 9000.
      // valueW (7100) là logical span của 4 cells khi colspan=4.
      layout: TableLayoutType.FIXED,
      columnWidths: [labelW, colonW, 1775, 1775, 1775, 1775],
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
              // FEATURE-037 fix — colspan cell PHẢI có explicit width để
              // Google Drive viewer / LibreOffice / Mac Preview render
              // đúng. Thiếu width → strict renderer wrap mỗi ký tự thành
              // 1 dòng vertical (MS Word auto-fit OK nhưng người nhận
              // file open bằng viewer khác bị xấu).
              { colspan: 6, width: 9000 },
            ),
          ],
        }),
        // "Và" separator
        new TableRow({
          children: [
            tCell([{ text: 'Và', bold: true }], {
              colspan: 6,
              width: 9000,
              align: AlignmentType.CENTER,
            }),
          ],
        }),
        // BÊN B header
        // FEATURE-030 — provider info đọc từ env config (replace hardcoded
        // legacy commit `205a1c1` với địa chỉ cũ Tôn Thất Thuyết). Defaults
        // trong Joi schema match Danny chốt 2026-05-13.
        new TableRow({
          children: [
            tCell([{ text: 'BÊN B', bold: true }], { width: labelW }),
            tCell([{ text: ':' }], { width: colonW, align: AlignmentType.CENTER }),
            tCell(
              [{ text: env.provider.companyName, bold: true }],
              { width: valueW, colspan: 4 },
            ),
          ],
        }),
        infoRow('Địa chỉ', env.provider.address),
        infoRow('Mã số thuế', env.provider.taxCode),
        infoRow('Điện thoại', env.provider.phone),
        infoRow(
          'Người đại diện',
          `Ông ${env.provider.representativeName}       Chức vụ: ${env.provider.representativeTitle}`,
          true,
        ),
        infoRow('Tài khoản số', env.provider.bankAccount),
        infoRow('Mở tại NH', env.provider.bankName),
        new TableRow({
          children: [
            tCell(
              [
                {
                  text: '(Sau đây gọi tắt là "Bên cung cấp dịch vụ")',
                  bold: true,
                },
              ],
              // FEATURE-037 fix — colspan width explicit
              { colspan: 6, width: 9000 },
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
    // FEATURE-037 v3 fix B — `tableHeader: true` lặp lại header row khi
    // table page-break. Without this, Thuế GTGT (3) + Hoàn trả (4) summary
    // rows push xuống page 2 không có header → render trông như "table 2-col
    // rời". Với tableHeader: true, header + sub-header lặp lại trên page 2
    // → user thấy full table context.
    const headerRow = new TableRow({
      tableHeader: true,
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
      tableHeader: true,
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

    // FEATURE-030 — Bottom row "Vật phẩm bổ sung" hiển thị tổng add_on
    // (áo, vật phẩm khác) — Option A trong Manager Plan. Render conditional
    // chỉ khi có add-on, KHÔNG redesign table 6-col → 7-col (low-risk).
    // Tổng cộng (1) = per-row subtotal + add_on = gross_revenue (Section 1).
    const totalAddOnPrice = rec.line_items.reduce(
      (s, li) => s + li.add_on_price,
      0,
    );
    // FEATURE-037 fix — sum widths cho colspan cells. Strict renderers
    // (Google Drive viewer / LibreOffice / Mac Preview) cần explicit width
    // trên merged cells, nếu không sẽ inherit width col[0] (2300 DXA =
    // 1.6") → text dài "Hoàn trả merchant (4) = (1) - (2) - (3)" wrap mỗi
    // ký tự thành 1 dòng vertical. MS Word auto-fit nên bị mask, người
    // nhận bằng client khác complain.
    const colspan5Width =
      colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4]; // 5620
    const colspan3Width = colWidths[0] + colWidths[1] + colWidths[2]; // 3930
    const colspan6Width = colspan5Width + colWidths[5]; // 6860 — full table

    // FEATURE-037 v3 fix B — `cantSplit: true` per row prevent split
    // mid-row khi cell có multi-line content. Combined với `tableHeader: true`
    // trên header/sub-header → page break safe, không còn render "table 2-col
    // rời" cho summary rows.
    const addOnRow: TableRow | null =
      totalAddOnPrice > 0
        ? new TableRow({
            cantSplit: true,
            children: [
              tCell(
                [{ text: 'Vật phẩm bổ sung (áo, ...)' }],
                { colspan: 5, width: colspan5Width },
              ),
              tCell([{ text: fmtVnd(totalAddOnPrice) }], {
                width: colWidths[5],
                align: AlignmentType.RIGHT,
              }),
            ],
          })
        : null;

    // Summary rows
    const summaryRows: TableRow[] = [
      ...(addOnRow ? [addOnRow] : []),
      // Tổng cộng (1) — gross_revenue = sum(line subtotal) + sum(add_on)
      new TableRow({
        cantSplit: true,
        children: [
          tCell([{ text: 'Tổng cộng (1)', bold: true }], {
            colspan: 3,
            width: colspan3Width,
          }),
          tCell([{ text: String(totalQty), bold: true }], {
            width: colWidths[3],
            align: AlignmentType.RIGHT,
          }),
          tCell([{ text: fmtVnd(totalDiscount), bold: true }], {
            width: colWidths[4],
            align: AlignmentType.RIGHT,
          }),
          tCell([{ text: fmtVnd(rec.net_revenue), bold: true }], {
            width: colWidths[5],
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
      // Phí bán vé (2)
      new TableRow({
        cantSplit: true,
        children: [
          tCell(
            [
              {
                text: 'Phí bán vé (chưa bao gồm thuế GTGT) (2)',
                bold: true,
              },
            ],
            { colspan: 5, width: colspan5Width },
          ),
          tCell([{ text: fmtVnd(rec.fee_amount), bold: true }], {
            width: colWidths[5],
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
      // Thuế GTGT (3)
      new TableRow({
        cantSplit: true,
        children: [
          tCell(
            [{ text: `Thuế GTGT (${rec.fee_vat_rate}%) (3)`, bold: true }],
            { colspan: 5, width: colspan5Width },
          ),
          tCell([{ text: fmtVnd(rec.fee_vat_amount), bold: true }], {
            width: colWidths[5],
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
      // Hoàn trả merchant (4)
      new TableRow({
        cantSplit: true,
        children: [
          tCell(
            [{ text: 'Hoàn trả merchant (4) = (1) - (2) - (3)', bold: true }],
            { colspan: 5, width: colspan5Width },
          ),
          tCell([{ text: fmtVnd(rec.payout_amount), bold: true }], {
            width: colWidths[5],
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
    ];

    return new Table({
      // FEATURE-037 v3 — table width PHẢI match sum(columnWidths) trong
      // fixed layout, nếu không strict renderer hiển thị sai. colWidths
      // sum = 2300+750+880+940+750+1240 = 6860 (≈4.76 inch = 12.1 cm).
      width: { size: 6860, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: colWidths,
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
      // FEATURE-037 v3 — signature table 2 cols × 4500 DXA = 9000 total
      layout: TableLayoutType.FIXED,
      columnWidths: [4500, 4500],
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
                para(env.provider.companyName, {
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
                para(env.provider.representativeName.toUpperCase(), {
                  bold: true,
                  align: AlignmentType.CENTER,
                }),
                para(env.provider.representativeTitle, {
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
