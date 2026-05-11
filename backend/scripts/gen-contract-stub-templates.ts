/**
 * F-024 Phase 2B — regenerate DOCX template stubs with proper docxtemplater
 * placeholder + `{#articles}{heading}{body}{/articles}` loop syntax.
 *
 * Output: backend/assets/contract-templates/{name}.docx
 *
 * Run: `npx ts-node --transpile-only backend/scripts/gen-contract-stub-templates.ts`
 *
 * Note: Phase 1 đã có 9 stub generic. Phase 2B regenerate để (a) thêm articles
 * loop syntax, (b) thêm `{totalAmountInWords}`, (c) line-items table loop
 * `{#lineItems}...{/lineItems}`. Sample render verify side-by-side với file mẫu
 * gốc của Danny → tech debt Phase 2A #3.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';

type DocxParaContent =
  | { kind: 'p'; text: string; bold?: boolean; center?: boolean; heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel] }
  | { kind: 'spacer' };

function p(text: string, opts: { bold?: boolean; center?: boolean; heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel] } = {}): DocxParaContent {
  return { kind: 'p', text, ...opts };
}

function spacer(): DocxParaContent {
  return { kind: 'spacer' };
}

function build(blocks: DocxParaContent[]): (Paragraph | Table)[] {
  return blocks.map((b) => {
    if (b.kind === 'spacer') return new Paragraph({ text: '' });
    return new Paragraph({
      heading: b.heading,
      alignment: b.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: b.text, bold: b.bold })],
    });
  });
}

function buildLineItemsTable(): Table {
  const headers = ['STT', 'Mô tả', 'ĐVT', 'SL', 'Đơn giá', 'Giảm giá', 'Thành tiền'];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(
          (h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            }),
        ),
      }),
      // Loop row — docxtemplater paragraph-loop="true" requires the {#lineItems} and {/lineItems}
      // tags placed in their OWN paragraphs inside cells. We place markers at the row cell-level.
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('{#lineItems}{stt}')] }),
          new TableCell({ children: [new Paragraph('{description}')] }),
          new TableCell({ children: [new Paragraph('{unit}')] }),
          new TableCell({ children: [new Paragraph('{quantity}')] }),
          new TableCell({ children: [new Paragraph('{unitPrice}')] }),
          new TableCell({ children: [new Paragraph('{discount}')] }),
          new TableCell({ children: [new Paragraph('{amount}{/lineItems}')] }),
        ],
      }),
    ],
  });
}

function buildContractTemplate(opts: { titleVN: string; subtitle?: string }): Document {
  return new Document({
    sections: [
      {
        properties: {},
        children: [
          ...build([
            p('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { center: true, bold: true }),
            p('Độc lập – Tự do – Hạnh phúc', { center: true, bold: true }),
            spacer(),
            p(opts.titleVN, { center: true, bold: true, heading: HeadingLevel.HEADING_1 }),
            ...(opts.subtitle ? [p(opts.subtitle, { center: true })] : []),
            p('Số: {contractNumber}', { center: true }),
            spacer(),
            p('Hôm nay, ngày {signDay} tháng {signMonth} năm {signYear}, chúng tôi gồm:'),
            spacer(),
            p('BÊN CUNG CẤP DỊCH VỤ (BÊN A):', { bold: true }),
            p('Tên đơn vị: {provider.entityName}'),
            p('Mã số thuế: {provider.taxId}'),
            p('Địa chỉ: {provider.address}'),
            p('Đại diện: {provider.representative} — Chức vụ: {provider.position}'),
            p('Tài khoản: {provider.bankAccount} tại {provider.bankName}'),
            spacer(),
            p('BÊN SỬ DỤNG DỊCH VỤ (BÊN B):', { bold: true }),
            p('Tên đơn vị: {client.entityName}'),
            p('Mã số thuế: {client.taxId}'),
            p('Địa chỉ: {client.address}'),
            p('Đại diện: {client.representative} — Chức vụ: {client.position}'),
            p('Điện thoại: {client.phone}  —  Email: {client.email}'),
            p('Tài khoản: {client.bankAccount} tại {client.bankName}'),
            spacer(),
            p(
              'Sau khi bàn bạc thống nhất, hai bên đồng ý ký Hợp đồng dịch vụ với các điều khoản sau:',
            ),
            spacer(),
            // Articles loop — docxtemplater syntax {#articles}{heading}{body}{/articles}
            p('{#articles}', { bold: true }),
            p('{heading}', { bold: true }),
            p('{body}'),
            spacer(),
            p('{/articles}'),
            spacer(),
            // Line items table — only present nếu fixed-price contract
            p('HẠNG MỤC DỊCH VỤ', { bold: true }),
          ]),
          buildLineItemsTable(),
          ...build([
            spacer(),
            p('Cộng (chưa VAT): {subtotal} VND'),
            p('VAT ({vatRate}%): {vatAmount} VND'),
            p('TỔNG CỘNG: {totalAmount} VND', { bold: true }),
            p('(Bằng chữ: {totalAmountInWords})'),
            spacer(),
            p('Hợp đồng có giá trị từ ngày {signDay}/{signMonth}/{signYear}.'),
            spacer(),
            spacer(),
            p('ĐẠI DIỆN BÊN A                                ĐẠI DIỆN BÊN B', { center: true, bold: true }),
            p('(Ký tên, đóng dấu)                                (Ký tên, đóng dấu)', { center: true }),
          ]),
        ],
      },
    ],
  });
}

function buildAcceptanceTemplate(): Document {
  return new Document({
    sections: [
      {
        properties: {},
        children: [
          ...build([
            p('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { center: true, bold: true }),
            p('Độc lập – Tự do – Hạnh phúc', { center: true, bold: true }),
            spacer(),
            p('BIÊN BẢN NGHIỆM THU', { center: true, bold: true, heading: HeadingLevel.HEADING_1 }),
            p('Hợp đồng số: {contractNumber}', { center: true }),
            spacer(),
            p('Hôm nay, ngày {acceptanceReport.reportDate}, đại diện hai bên gồm:'),
            spacer(),
            p('BÊN A: {provider.entityName}'),
            p('BÊN B: {client.entityName}'),
            spacer(),
            p('Cùng tiến hành nghiệm thu hạng mục dịch vụ theo Hợp đồng nêu trên, kết quả như sau:'),
            spacer(),
            p('I. HẠNG MỤC THỰC TẾ', { bold: true }),
          ]),
          // Acceptance line items table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ['STT', 'Mô tả', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'].map(
                  (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
                ),
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('{#acceptanceReport.actualValues}{stt}')] }),
                  new TableCell({ children: [new Paragraph('{description}')] }),
                  new TableCell({ children: [new Paragraph('{unit}')] }),
                  new TableCell({ children: [new Paragraph('{quantity}')] }),
                  new TableCell({ children: [new Paragraph('{unitPrice}')] }),
                  new TableCell({ children: [new Paragraph('{amount}{/acceptanceReport.actualValues}')] }),
                ],
              }),
            ],
          }),
          ...build([
            spacer(),
            p('II. TỔNG HỢP TÀI CHÍNH', { bold: true }),
            p('Cộng (chưa VAT): {acceptanceReport.actualSubtotal} VND'),
            p('VAT: {acceptanceReport.actualVatAmount} VND'),
            p('Tổng (đã VAT): {acceptanceReport.actualTotalWithVat} VND'),
            p('Chênh lệch vs HĐ: {acceptanceReport.diffAmount} VND'),
            p('Đã tạm ứng: {acceptanceReport.advancePaid} VND'),
            p('Còn phải thanh toán: {acceptanceReport.remainingBalance} VND', { bold: true }),
            spacer(),
            p('III. KẾT LUẬN', { bold: true }),
            p('Kết quả nghiệm thu: {acceptanceReport.verdict}'),
            p('Ghi chú: {acceptanceReport.notes}'),
            spacer(),
            spacer(),
            p('ĐẠI DIỆN BÊN A                                ĐẠI DIỆN BÊN B', { center: true, bold: true }),
            p('(Ký tên, đóng dấu)                                (Ký tên, đóng dấu)', { center: true }),
          ]),
        ],
      },
    ],
  });
}

function buildPaymentRequestTemplate(): Document {
  return new Document({
    sections: [
      {
        properties: {},
        children: build([
          p('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { center: true, bold: true }),
          p('Độc lập – Tự do – Hạnh phúc', { center: true, bold: true }),
          spacer(),
          p('ĐỀ NGHỊ THANH TOÁN', { center: true, bold: true, heading: HeadingLevel.HEADING_1 }),
          spacer(),
          p('Kính gửi: {client.entityName}'),
          p('Theo Hợp đồng số: {contractNumber} ký ngày {signDay}/{signMonth}/{signYear}.'),
          spacer(),
          p('Sau khi nghiệm thu, đề nghị Quý đơn vị thanh toán như sau:'),
          spacer(),
          p('Tổng giá trị HĐ (đã VAT): {paymentRequest.totalAmount} VND'),
          p('Đã tạm ứng: {paymentRequest.advancePaid} VND'),
          p('Số tiền cần thanh toán: {paymentRequest.amountDue} VND', { bold: true }),
          p('(Bằng chữ: {totalAmountInWords})'),
          p('Hạn thanh toán: {paymentRequest.paymentDeadline}'),
          spacer(),
          p('Thanh toán vào tài khoản:'),
          p('Số TK: {provider.bankAccount}'),
          p('Tại: {provider.bankName}'),
          p('Đơn vị: {provider.entityName}'),
          spacer(),
          p('Ghi chú: {paymentRequest.notes}'),
          spacer(),
          spacer(),
          p('Trân trọng cảm ơn!', { center: true, bold: true }),
          spacer(),
          p('ĐẠI DIỆN BÊN A', { center: true, bold: true }),
          p('(Ký tên, đóng dấu)', { center: true }),
        ]),
      },
    ],
  });
}

function buildQuotationTemplate(): Document {
  return new Document({
    sections: [
      {
        properties: {},
        children: [
          ...build([
            p('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { center: true, bold: true }),
            p('Độc lập – Tự do – Hạnh phúc', { center: true, bold: true }),
            spacer(),
            p('BÁO GIÁ DỊCH VỤ', { center: true, bold: true, heading: HeadingLevel.HEADING_1 }),
            p('Số: {contractNumber}', { center: true }),
            spacer(),
            p('Kính gửi: {client.entityName}'),
            p('Đơn vị báo giá: {provider.entityName}'),
            p('Ngày báo giá: {signDay}/{signMonth}/{signYear}'),
            spacer(),
            p('Theo yêu cầu của Quý đơn vị, chúng tôi xin gửi báo giá dịch vụ cho sự kiện "{raceName}":'),
            spacer(),
            p('HẠNG MỤC BÁO GIÁ', { bold: true }),
          ]),
          buildLineItemsTable(),
          ...build([
            spacer(),
            p('Cộng (chưa VAT): {subtotal} VND'),
            p('VAT ({vatRate}%): {vatAmount} VND'),
            p('TỔNG CỘNG: {totalAmount} VND', { bold: true }),
            p('(Bằng chữ: {totalAmountInWords})'),
            spacer(),
            p('Báo giá có hiệu lực trong vòng 15 ngày kể từ ngày phát hành.'),
            spacer(),
            p('Trân trọng!', { center: true, bold: true }),
            spacer(),
            p('ĐẠI DIỆN ĐƠN VỊ BÁO GIÁ', { center: true, bold: true }),
            p('(Ký tên, đóng dấu)', { center: true }),
          ]),
        ],
      },
    ],
  });
}

const TEMPLATES: { file: string; doc: Document }[] = [
  { file: 'contract-timing.docx', doc: buildContractTemplate({ titleVN: 'HỢP ĐỒNG DỊCH VỤ TÍNH GIỜ' }) },
  { file: 'contract-racekit.docx', doc: buildContractTemplate({ titleVN: 'HỢP ĐỒNG VẬN HÀNH RACEKIT' }) },
  { file: 'contract-operations.docx', doc: buildContractTemplate({ titleVN: 'HỢP ĐỒNG VẬN HÀNH SỰ KIỆN' }) },
  { file: 'contract-ticket-sales.docx', doc: buildContractTemplate({ titleVN: 'HỢP ĐỒNG BÁN VÉ' }) },
  { file: 'acceptance-timing.docx', doc: buildAcceptanceTemplate() },
  { file: 'acceptance-racekit.docx', doc: buildAcceptanceTemplate() },
  { file: 'acceptance-operations.docx', doc: buildAcceptanceTemplate() },
  { file: 'payment-request.docx', doc: buildPaymentRequestTemplate() },
  { file: 'quotation.docx', doc: buildQuotationTemplate() },
];

async function main() {
  const outDir = path.join(__dirname, '..', 'assets', 'contract-templates');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  for (const { file, doc } of TEMPLATES) {
    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(path.join(outDir, file), buf);
    console.log(`✓ ${file} (${buf.length} bytes)`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
