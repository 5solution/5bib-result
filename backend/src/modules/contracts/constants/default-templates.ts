/**
 * F-024 Contract Management — Default Boilerplate Templates
 *
 * 🛑 PAUSE-CODE-NEW-B (legal-sensitive content):
 * Nội dung Điều 1-11 dưới đây EXTRACTED NGUYÊN VĂN từ 4 file mẫu DOCX
 * trong `.5bib-workflow/features/FEATURE-024-contract-management/templates-input/`:
 *   - [5BIB] Hợp đồng bán vé Giải chạy ... 2026.docx               → TICKET_SALES
 *   - [Timing] - 5BIB - Hợp đồng dịch vụ tính giờ ... .docx        → TIMING
 *   - [RACEKIT] - 5BIB - Hợp đồng vận hành racekit ... .docx       → RACEKIT
 *   - 14.4.26 [Hành Trình ...] - 5Sport - Hợp đồng vận hành (1).docx → OPERATIONS
 *
 * RE-EXTRACT 2026-05-11: Coder Phase 1 đã rút gọn quá tay (5-10 dòng/article).
 * Bản này paste NGUYÊN VĂN từ file gốc, chỉ thay hardcoded values bằng placeholder
 * (vd: tên đối tác → {client.entityName}, MST → {client.taxId}, etc.).
 *
 * Danny phải REVIEW file này TRƯỚC khi áp vào generator (PAUSE-CODE-NEW-B).
 * Nếu cần sửa câu chữ, sửa trực tiếp trong file này (admin UI sẽ override
 * per-contract qua `templateOverrides.articles`).
 *
 * BR-CM-11 dual-mode: text trong file này = default boilerplate. Admin có thể
 * override từng article cho từng contract qua `templateOverrides.articles[key]`.
 *
 * Placeholder convention:
 *   {client.entityName}      — tên đối tác (Bên A)
 *   {client.taxId}           — MST Bên A
 *   {client.address}         — địa chỉ Bên A
 *   {client.phone}           — điện thoại Bên A
 *   {client.representative}  — đại diện Bên A
 *   {client.position}        — chức vụ đại diện Bên A
 *   {client.bankAccount}     — số tài khoản Bên A
 *   {client.bankName}        — tên ngân hàng Bên A
 *   {provider.entityName}    — tên Bên B (5BIB / 5Solution)
 *   (provider.* tương tự client.*)
 *   {raceName}               — tên giải
 *   {raceDate}               — ngày diễn ra giải
 *   {raceLocation}           — địa điểm giải
 *   {totalAmount}            — tổng giá trị HĐ (VND)
 *   {totalAmountInWords}     — số tiền bằng chữ
 *   {advanceAmount}          — tiền tạm ứng (VND)
 *   {advancePercentage}      — % tạm ứng (typical 50)
 *   {remainderAmount}        — phần thanh toán còn lại
 *   {vatRate}                — % VAT (typical 8 hoặc 10)
 *   {paymentTerms.latePenaltyRate} — lãi suất chậm thanh toán
 *   {paymentTerms.latePenaltyUnit} — đơn vị (%/ngày, %/năm, etc.)
 *   {signDate}               — ngày ký HĐ
 *   {contractNumber}         — số hợp đồng
 *   {athleteCount}           — số lượng VĐV
 *   {ticketFeePercent}       — % phí bán vé (TICKET_SALES)
 *   {athleteManagementFee}   — phí quản lý VĐV/lượt (TICKET_SALES)
 */

import { ContractType } from '../schemas/contract.schema';

export interface ArticleSection {
  /** Stable key for override lookup (vd: 'article-1', 'article-5') */
  key: string;
  /** Heading hiển thị trong DOCX (vd: 'ĐIỀU 1. ĐỐI TƯỢNG VÀ PHẠM VI') */
  heading: string;
  /** Default body text — supports {placeholder} via docxtemplater */
  body: string;
}

/* ============================================================================
 * SHARED BOILERPLATE — RACEKIT + OPERATIONS (Điều 5-11)
 * ----------------------------------------------------------------------------
 * RACEKIT (file gốc Đ5-11) và OPERATIONS (file gốc Đ5-11) chia sẻ NGUYÊN VĂN
 * giống nhau cho Article 5-11. TIMING có articles riêng (BẢO HIỂM tách thành
 * Đ6 + structure khác) nên KHÔNG dùng SHARED này.
 * ========================================================================== */
const SHARED_RACEKIT_OPERATIONS: ArticleSection[] = [
  {
    key: 'article-5',
    heading: 'ĐIỀU 5. QUYỀN LỢI VÀ TRÁCH NHIỆM CỦA BÊN B',
    body: `Quyền của Bên B
- Được nhận Phí Dịch vụ theo thỏa thuận tại Hợp đồng này.
- Được yêu cầu bồi thường các thiệt hại trực tiếp do lỗi vi phạm Hợp đồng của Bên A (nếu có).
- Yêu cầu Bên A thanh toán theo đúng giá trị và thời hạn đã quy định trong Hợp đồng.

Trách nhiệm của Bên B
- Cung cấp đầy đủ, đúng hạn các hạng mục thuộc Dịch vụ theo quy định tại Hợp đồng này và Phụ lục đính kèm; đảm bảo chất lượng, số lượng, quy cách, mô tả của sản phẩm Dịch vụ và Dịch vụ đáp ứng yêu cầu của Hợp đồng và thỏa thuận của hai Bên.
- Tạo điều kiện để người đại diện của Bên A cùng tham gia giám sát và phối hợp với Bên B trong việc triển khai, thực hiện Dịch vụ.
- Chịu trách nhiệm lập kế hoạch, lên nội dung, ý tưởng, kịch bản để triển khai Dịch vụ và trình Bên A phê duyệt trước khi thực hiện.
- Tiến hành chỉnh sửa các nội dung chi tiết của từng hạng mục thuộc Dịch vụ theo yêu cầu của Bên A cho đến khi Bên A đồng ý phê duyệt trước khi tiến hành các hạng mục nêu tại Phụ lục 01 của Hợp đồng.
- Báo cáo về tiến độ và kết quả thực hiện Dịch vụ trong giai đoạn chuẩn bị cho Bên A và cung cấp các tài liệu liên quan khi được Bên A yêu cầu.
- Trong thời gian diễn ra các Sự kiện, Bên B có trách nhiệm ngay lập tức thông báo cho Bên A khi xảy ra các sự cố có thể làm ảnh hưởng đến việc thực hiện các hạng mục thuộc Dịch vụ đúng theo yêu cầu hoặc tiến độ như đã thỏa thuận giữa hai Bên để thảo luận, thống nhất giải pháp xử lí và tiến hành xử lý các sự cố trong thời gian hai (02) giờ kể từ khi phát sinh sự cố.
- Bên B cam kết giữ cho Bên A không phải chịu bất kỳ trách nhiệm nào đối với các tổn thất, thiệt hại hoặc chi phí phát sinh từ khiếu nại, tranh chấp hoặc kiện tụng của bên thứ ba liên quan đến việc Bên B cung cấp dịch vụ cho Sự kiện, hoặc việc sử dụng, thuê, cung cấp hàng hóa từ bên thứ ba để thực hiện Hợp đồng này. Trường hợp Bên A phải trực tiếp tham gia giải quyết các tranh chấp hoặc khiếu nại nói trên, Bên B có trách nhiệm hoàn trả toàn bộ chi phí mà Bên A đã chi trả, bao gồm nhưng không giới hạn ở chi phí bồi thường, luật sư, tố tụng, xử lý khủng hoảng truyền thông và các khoản chi phí hợp lý khác (nếu có).
- Cung cấp bản tóm tắt chi phí thực tế chính xác cho Bên A ngay sau khi hoàn tất cung cấp các hạng mục thuộc Dịch vụ theo Hợp đồng.
- Thu dọn, di dời thiết bị, công cụ và phế liệu sau khi Sự kiện kết thúc theo Hợp đồng và tự chịu trách nhiệm với các hỏng hóc về thiết bị, công cụ sử dụng trong quá trình cung cấp Dịch vụ.`,
  },
  {
    key: 'article-6',
    heading: 'ĐIỀU 6. CHẤM DỨT HỢP ĐỒNG',
    body: `Hợp Đồng có thể chấm dứt theo một trong các trường hợp sau:
- Hai Bên thỏa thuận chấm dứt Hợp Đồng này bằng văn bản.
- Các Bên đã hoàn thành đầy đủ các nghĩa vụ của mình theo Hợp Đồng này và Hợp Đồng được tự động thanh lý.
- Một Bên vi phạm nghĩa vụ theo thỏa thuận tại Hợp đồng này, đã được bên kia thông báo bằng văn bản/thư điện tử trong vòng 15 ngày kể từ ngày nhận được thông báo mà không sửa chữa, khắc phục được sẽ được xem là vi phạm hợp đồng. Bên gửi thông báo được quyền đơn phương chấm dứt hợp đồng. Bên cạnh đó, bên vi phạm sẽ bị xử lý theo quy định tại Điều 8.
- Một trong hai bên buộc phải giải thể, phá sản theo quyết định của Cơ quan Nhà nước có thẩm quyền.

Trong trường hợp một trong hai bên đơn phương chấm dứt Hợp Đồng này trước thời hạn mà không có lý do chính đáng, bên đơn phương chấm dứt hợp đồng sẽ phải thanh toán 100% phí Dịch vụ của hợp đồng cũng như bồi thường toàn bộ thiệt hại (nếu có).`,
  },
  {
    key: 'article-7',
    heading: 'ĐIỀU 7. BẤT KHẢ KHÁNG',
    body: `Sự kiện bất khả kháng được quy định bao gồm nhưng không giới hạn ở: luật pháp hiện tại hoặc tương lai thay đổi tác động đến các điều khoản hợp đồng, quy định hoặc mệnh lệnh từ các cấp có thẩm quyền can thiệp vào sự kiện hoặc hợp đồng, thiên tai, động đất, sóng thần, lũ lụt, mưa lớn, hỏa hoạn, dịch bệnh, tai nạn, vụ nổ, thương vong, tranh chấp lao động (bao gồm nhưng không giới hạn ở việc đe dọa hoặc đình công tại xưởng làm việc, tẩy chay hoặc đình công ở khu vực gần xưởng), bạo loạn, xáo trộn dân sự, xung đột chiến tranh hoặc vũ trang, chậm trễ của hãng chuyên chở công cộng hoặc hãng chuyên chở quốc tế.

Sự kiện bất khả kháng tác động lên một trong hai Bên hoặc cả hai Bên thì các nghĩa vụ của Bên bị tác động sẽ bị tạm ngừng thực hiện mà không bị coi là vi phạm Hợp đồng này.

Nếu Sự kiện bị hủy toàn bộ hoặc một phần do sự kiện bất khả kháng, cả hai Bên sẽ được giải phóng khỏi nghĩa vụ tương ứng của mình. Trong trường hợp này, hai Bên sẽ thỏa thuận trách nhiệm đối với Bên B về tất cả các chi phí thực sự phát sinh mà Bên B đã phải gánh chịu đối với các nghĩa vụ đã thực hiện theo thỏa thuận này cho đến ngày thông báo hủy toàn bộ hoặc phần còn lại của Sự kiện.

Trong mọi trường hợp liên quan đến bất khả kháng, hai Bên thống nhất sẽ phối hợp chặt chẽ để đảm bảo kết quả Dịch vụ, khắc phục thiệt hại của nhau và đảm bảo giữ gìn uy tín của nhau trước cộng đồng.`,
  },
  {
    key: 'article-8',
    heading: 'ĐIỀU 8. BỒI THƯỜNG VÀ PHẠT VI PHẠM HỢP ĐỒNG',
    body: `Một trong Hai bên không thực hiện đúng các nghĩa vụ của mình được thỏa thuận tại Hợp Đồng này đều bị xem là vi phạm Hợp Đồng và phải chịu phạt là 8% giá trị phần bị vi phạm. (Trừ trường hợp đơn phương chấm dứt hợp đồng thì chịu phạt giống Điều 6). Bên cạnh đó, Bên vi phạm còn phải chịu trách nhiệm bồi thường toàn bộ thiệt hại thực tế phát sinh mà Bên bị vi phạm phải gánh chịu, trừ trường hợp do Sự kiện bất khả kháng hoặc do lỗi của bên còn lại.

Bên vi phạm có nghĩa vụ nộp tiền phạt vi phạm và/hoặc bồi thường thiệt hại cho Bên kia trong thời hạn 10 (mười) ngày kể từ ngày nhận được Thông báo "Đề nghị thanh toán tiền phạt và/hoặc bồi thường thiệt hại". Trong trường hợp chậm nộp tiền phạt vi phạm và/hoặc bồi thường thiệt hại, Bên có nghĩa vụ thanh toán thêm tiền lãi suất chậm trả tương ứng với thời gian chậm nộp với lãi suất {paymentTerms.latePenaltyRate}{paymentTerms.latePenaltyUnit}.

Trong mọi trường hợp, nếu có bất kỳ việc khiếu nại, tranh chấp phát sinh liên quan đến Hợp Đồng này, thì Các Bên đồng ý, thống nhất và đảm bảo rằng một phần và/hoặc toàn bộ trách nhiệm của Bên B sẽ không vượt quá mức Phí dịch vụ mà Bên B nhận được theo Hợp Đồng này.`,
  },
  {
    key: 'article-9',
    heading: 'ĐIỀU 9. BẢO MẬT THÔNG TIN',
    body: `Các Bên thoả thuận và đảm bảo rằng mỗi Bên phải có trách nhiệm bảo mật và giữ kín tất cả các thông tin được cung cấp bởi một Bên (Bên cung cấp thông tin) đến Bên còn lại (Bên tiếp nhận) và theo đó các thông tin này sẽ không được tiết lộ cho bất kỳ bên thứ ba nào khác mà không có sự chấp thuận trước bằng văn bản của Bên cung cấp thông tin ngoại trừ việc cung cấp thông tin là nhằm mục đích thực hiện Hợp Đồng này hoặc theo lệnh, quyết định của cơ quan Nhà nước có thẩm quyền.

Hiệu lực và giới hạn của điều khoản bảo mật:
- Hiệu lực kéo dài: Nghĩa vụ bảo mật theo quy định này sẽ tiếp tục có hiệu lực vô thời hạn sau khi Hợp đồng kết thúc hoặc chấm dứt vì bất kỳ lý do gì.
- Ngoại lệ của nghĩa vụ bảo mật: Các Bên không phải bảo mật đối với các thông tin thuộc một trong các trường hợp sau:
  + Thông tin đã được công bố công khai hoặc đã phổ biến rộng rãi không phải do lỗi của Bên tiếp nhận thông tin; hoặc
  + Thông tin phải cung cấp theo yêu cầu của cơ quan nhà nước có thẩm quyền theo quy định pháp luật.
- Nghĩa vụ thông báo: Trong trường hợp Bên tiếp nhận thông tin phải tiết lộ thông tin bảo mật theo yêu cầu của cơ quan nhà nước có thẩm quyền, Bên đó phải thông báo bằng văn bản cho Bên cung cấp thông tin trước khi tiết lộ, nêu rõ lý do, phạm vi thông tin cần tiết lộ và cơ quan yêu cầu tiết lộ.

Các Bên cam kết sẽ tuân thủ các quy định pháp luật về bảo vệ dữ liệu cá nhân được quy định tại Nghị định 13/2023/NĐ-CP ngày 17/04/2023 (và các văn bản hướng dẫn, sửa đổi, bổ sung, thay thế khác (nếu có)) cùng các văn bản pháp luật có liên quan. Đồng thời, các Bên cam kết sẽ trao đổi, thương lượng và/hoặc đồng ý ký kết (các) văn bản, Phụ lục Hợp đồng để điều chỉnh các nội dung liên quan đến việc bảo vệ Dữ liệu cá nhân theo (các) đề xuất, yêu cầu từ Bên còn lại vào mọi thời điểm trong quá trình thực hiện Hợp đồng để đảm bảo tuân thủ quy định pháp luật. Trường hợp Bên nào không tuân thủ các cam kết này, được xem là Bên đó đã vi phạm Hợp đồng và phải chịu hoàn toàn trách nhiệm theo quy định cho các vi phạm do mình gây ra. Bên còn lại có quyền đơn phương chấm dứt Hợp Đồng và các Phụ lục Hợp Đồng ngay lập tức.

Để làm rõ, việc Hai Bên không hoàn thành việc giao kết các văn bản, Phụ lục trong thời hạn đã cam kết mà xuất phát từ lỗi của Một Bên thì được xem là hành vi vi phạm Hợp đồng của Bên đó. Khi đó, Bên còn lại có quyền được miễn trừ trách nhiệm.`,
  },
  {
    key: 'article-10',
    heading: 'ĐIỀU 10. GIẢI QUYẾT TRANH CHẤP HỢP ĐỒNG',
    body: `Trong quá trình thực hiện Hợp Đồng hai Bên cần chủ động thông báo cho nhau biết tiến độ thực hiện Hợp Đồng, nếu có vấn đề bất lợi phát sinh hoặc xảy ra tranh chấp, các Bên phải kịp thời thông báo bằng văn bản cho nhau biết và phải chủ động bàn bạc giải quyết trên cơ sở thương lượng, tôn trọng quyền và lợi ích hợp pháp của các Bên.

Trong quá trình thực hiện Hợp đồng này, nếu có bất kỳ tranh chấp, mâu thuẫn nào phát sinh từ hoặc liên quan đến Hợp đồng, Các Bên trước hết sẽ nỗ lực cùng nhau thương lượng, thảo luận giải quyết trên tinh thần đôi bên đều có lợi. Trường hợp Các Bên không thể giải quyết được các tranh chấp, mâu thuẫn đó trên tinh thần thiện chí trong vòng 30 (ba mươi) ngày kể từ khi một Bên đề cập vấn đề cho Bên kia bằng văn bản, Các Bên đồng ý rằng vụ việc, tranh chấp sẽ được giải quyết tại Tòa án nhân dân có thẩm quyền theo quy định của pháp luật.`,
  },
  {
    key: 'article-11',
    heading: 'ĐIỀU 11. ĐIỀU KHOẢN CHUNG',
    body: `Hợp Đồng này và những phụ lục kèm theo tạo thành một chỉnh thể thống nhất, không tách rời và thay thế tất cả thỏa thuận trước đây bằng miệng hoặc bằng văn bản giữa các Bên.

Mọi sửa đổi, bổ sung hoặc hiệu chỉnh đối với Hợp Đồng này chỉ có giá trị khi được Các Bên lập thành văn bản.

Các Bên cam kết thực hiện đúng và đầy đủ các quyền và nghĩa vụ của mình quy định tại Hợp đồng này và các Phụ lục kèm theo (nếu có).

Mỗi Bên chịu trách nhiệm thanh toán nghĩa vụ thuế của mỗi bên phát sinh từ giao dịch theo Hợp đồng này. Nếu có bất kỳ khoản thuế nào thuộc nghĩa vụ của Bên A mà Bên B có trách nhiệm khấu trừ và nộp hộ theo pháp luật Việt Nam thì Bên B phải tính và khấu trừ, nộp hộ cho Bên A theo đúng quy định của pháp luật. Và khoản tiền này được khấu trừ vào khoản tiền Bên B thanh toán cho Bên A.

Bất kỳ tranh chấp nào phát sinh từ hoặc liên quan đến Hợp Đồng này trước tiên sẽ giải quyết thông qua thương lượng và hòa giải giữa Các Bên. Trong trường hợp giữa Các Bên có tranh chấp mà không thể giải quyết bằng thương lượng và hòa giải thì mọi tranh chấp phát sinh từ hoặc liên quan đến Hợp Đồng này sẽ được giải quyết tại Tòa án Nhân dân có thẩm quyền của Việt Nam.

Hợp Đồng này được điều chỉnh và giải thích phù hợp với pháp luật Việt Nam.

Các Bên thống nhất rằng trong vòng 07 ngày kể từ ngày Các Bên hoàn thành các nghĩa vụ và/hoặc kết thúc thời hạn theo quy định tại Hợp Đồng này mà không có bất kỳ khiếu nại, tranh chấp của một trong Các Bên hoặc Hai Bên thì Hợp Đồng này được tự động thanh lý.

Hợp Đồng này được làm thành 02 (hai) bản gốc bằng tiếng Việt và có giá trị pháp lý như nhau. Mỗi Bên giữ 01 (một) bản để thực hiện.

ĐỂ LÀM BẰNG CHỨNG, Các Bên dưới đây đã đồng ý ký tên vào ngày được nêu trên phần đầu của Hợp Đồng này.`,
  },
];

/* ============================================================================
 * DEFAULT TEMPLATES per ContractType
 * ========================================================================== */
export const DEFAULT_TEMPLATES: Record<ContractType, ArticleSection[]> = {
  /* --------------------------------------------------------------------------
   * TIMING — Hợp đồng dịch vụ tính giờ (5BIB ↔ đối tác)
   * File gốc: [Timing] - 5BIB - Hợp đồng dịch vụ tính giờ ... .docx
   * 11 Điều: ĐỐI TƯỢNG / GIÁ TRỊ HĐ / HỆ THỐNG LIÊN HỆ / QUYỀN+TN CÁC BÊN /
   *          CHẤM DỨT / BẢO HIỂM / BẤT KHẢ KHÁNG / BỒI THƯỜNG+PHẠT /
   *          BẢO MẬT / TRANH CHẤP / ĐIỀU KHOẢN CHUNG
   * ------------------------------------------------------------------------ */
  TIMING: [
    {
      key: 'article-1',
      heading: 'ĐIỀU 1. ĐỐI TƯỢNG VÀ PHẠM VI HỢP ĐỒNG',
      body: `Bên B sẽ cung cấp dịch vụ ghi nhận thành tích thi đấu, còn được gọi là "Dịch vụ tính giờ" (sau đây gọi tắt là "Dịch vụ") cho Bên A tại sự kiện do Bên A tổ chức. Thành tích được tính dựa trên chip tính giờ gắn đằng sau số đeo trên mỗi vận động viên tham gia sự kiện của Bên A, tính chính xác đến phần trăm giây.

Trong trường hợp xảy ra lỗi kỹ thuật khi ghi nhận bằng chip tính giờ (bao gồm nhưng không giới hạn ở nguyên nhân bất khả kháng hoặc hành vi của vận động viên làm hư hỏng thiết bị), Bên B có trách nhiệm phối hợp với Bên A để sử dụng hình ảnh ghi nhận (do Bên B hoặc Bên A cung cấp) nhằm xác định kết quả tương đối chính xác, với sai số không quá 0,5 giây. Tuy nhiên, Bên B cam kết đảm bảo việc ghi nhận kết quả chính xác tối thiểu cho 98% tổng số vận động viên tham gia sự kiện, trừ trường hợp bất khả kháng được quy định tại Hợp đồng. Trong các tình huống sự cố ngoài mong muốn, hai bên sẽ cùng làm việc bằng văn bản để xác định giải pháp hợp lý, đảm bảo kết quả sự kiện được công bố minh bạch, khách quan và hạn chế tối đa ảnh hưởng đến uy tín của Bên A.

Bên B công bố kết quả chung của toàn bộ người tham gia trên website của Bên B (trang web: https://5bib.com).

Bên B giữ nguyên tắc không thay đổi kết quả dẫn tới sai lệch thứ hạng xếp hạng của các hạng mục thi đấu tại sự kiện (kể cả nếu Bên A yêu cầu) nếu qua kết quả đó đo bằng thiết bị hoạt động bình thường và các bằng chứng cho thấy không có sai sót trong toàn bộ quá trình thực hiện dịch vụ tính giờ. Trong trường hợp Bên A tự ý thay đổi và công bố kết quả đã được thay đổi, Bên B có quyền và có thể công bố kết quả đúng như ghi nhận nếu cần thiết.

Hai Bên có quyền cung cấp các bằng chứng liên quan đến hành vi vi phạm luật thi đấu, luật thể thao, hoặc quy định pháp luật nói chung của vận động viên tham gia sự kiện do Bên A tổ chức. Trường hợp cả hai Bên cùng thống nhất rằng bằng chứng là xác đáng, kết quả thi đấu của vận động viên đó – dù đã được tính giờ hay chưa – sẽ bị loại bỏ khỏi kết quả chính thức.

Bên A phải có trách nhiệm thực hiện mọi điều kiện cần thiết để Bên B thiết lập hệ thống để phục vụ "Dịch vụ tính giờ" của mình như quy định tại Điều 4 của Hợp đồng này để đảm bảo kết quả công việc.

Chi tiết dịch vụ và chi phí hạng mục từng phần cấu thành dịch vụ được đính kèm Phụ lục của Hợp đồng như một phần không thể tách rời.

Phụ lục được lập kèm theo Hợp đồng và là một bộ phận không thể tách rời của Hợp đồng chính. Mọi nội dung quy định trong Phụ lục có giá trị pháp lý tương đương như các điều khoản trong Hợp đồng và được áp dụng cùng với Hợp đồng chính. Trong trường hợp có sự khác biệt giữa nội dung của Phụ lục và Hợp đồng chính, các bên sẽ ưu tiên áp dụng quy định được hai bên thống nhất ghi tại Phụ lục, trừ khi có thỏa thuận khác bằng văn bản.`,
    },
    {
      key: 'article-2',
      heading: 'ĐIỀU 2. GIÁ TRỊ CỦA HỢP ĐỒNG, PHƯƠNG THỨC THANH TOÁN',
      body: `Hợp đồng này là một gói dịch vụ có giá trị: {totalAmount} VND, đã bao gồm VAT ({vatRate}%). (Bằng chữ: {totalAmountInWords}).

Chi tiết các hạng mục đính kèm phụ lục của hợp đồng này, được thanh toán theo nghiệm thu phát sinh thực tế.

Hợp đồng được thanh toán chia làm 02 (hai) lần:
- Lần 1 thanh toán trước {advancePercentage}% ({advanceAmount} VND) theo giá trị hợp đồng, trong vòng 05 (năm) ngày sau khi hai Bên ký kết Hợp đồng;
- Lần 2 thanh toán toàn bộ phần còn lại theo nghiệm thu cộng với giá trị VAT theo quy định tại thời điểm thanh toán, thời điểm thanh toán không muộn quá 30 ngày làm việc kể từ khi ký nghiệm thu hợp đồng.

Việc chậm trễ thanh toán sau khoảng thời gian quy định trên sẽ được tính là nợ quá hạn của Bên A với mức lãi suất được tính là {paymentTerms.latePenaltyRate}{paymentTerms.latePenaltyUnit} trên khoản nợ phải trả bất kể nghiệm thu thanh lý Hợp đồng được xác nhận vào thời điểm nào.`,
    },
    {
      key: 'article-3',
      heading: 'ĐIỀU 3. HỆ THỐNG LIÊN HỆ VÀ TRAO ĐỔI THÔNG TIN',
      body: `Nguyên tắc liên lạc

Trừ khi có thỏa thuận khác bằng văn bản giữa hai Bên, mọi thông báo, tài liệu, yêu cầu hoặc trao đổi liên quan đến Hợp đồng và các Phụ lục đính kèm phải được thực hiện bằng văn bản và gửi qua một trong các hình thức hợp lệ sau:
- Thư chuyển phát bảo đảm đến địa chỉ của Bên nhận như đã ghi trong phần đầu của Hợp đồng hoặc địa chỉ thay đổi đã được thông báo chính thức;
- Email gửi từ địa chỉ email của người đại diện ký hợp đồng hoặc đầu mối liên hệ được chỉ định chính thức trong hợp đồng hoặc văn bản sau này;
- Văn bản trực tiếp có chữ ký của người có thẩm quyền và có xác nhận từ Bên nhận.

Thời điểm xác lập việc nhận thông báo

Trừ trường hợp hoàn cảnh cụ thể có quy định khác, thời điểm một Bên được coi là đã nhận thông báo hợp lệ được xác định như sau:
- Đối với thư chuyển phát bảo đảm: Thời điểm người nhận ký nhận hoặc thời điểm hệ thống bưu chính xác nhận đã phát thành công.
- Đối với email: Thời điểm hệ thống của Bên gửi xác nhận email đã được gửi thành công, với điều kiện trong vòng 24 giờ kể từ thời điểm đó, Bên gửi có gửi thêm một email xác nhận nội dung gửi đi và không nhận được phản hồi lỗi kỹ thuật từ hệ thống email của Bên nhận.
- Đối với văn bản giao nhận trực tiếp: Thời điểm người đại diện hoặc đầu mối của Bên nhận ký xác nhận vào bản sao văn bản.

Thay đổi thông tin liên hệ

Mỗi Bên có trách nhiệm thông báo kịp thời và chính thức bằng văn bản hoặc email về bất kỳ thay đổi nào liên quan đến thông tin liên hệ (địa chỉ, email, người đại diện, đầu mối phụ trách…). Thông báo thay đổi chỉ có hiệu lực sau khi đã được Bên còn lại xác nhận bằng văn bản hoặc email.

Trường hợp Bên thay đổi thông tin nhưng không thông báo hoặc thông báo không hợp lệ, Bên còn lại được miễn trừ mọi trách nhiệm pháp lý phát sinh do việc không tiếp nhận, chậm tiếp nhận hoặc không thực hiện nghĩa vụ liên quan đến liên lạc.

Đầu mối liên hệ

Mỗi Bên sẽ chỉ định ít nhất một đầu mối liên hệ chính thức để phối hợp triển khai công việc liên quan đến hợp đồng. Danh sách đầu mối liên hệ (bao gồm họ tên, chức vụ, số điện thoại, email) sẽ được xác nhận tại thời điểm ký hợp đồng và có thể được cập nhật bằng thông báo chính thức giữa hai Bên.`,
    },
    {
      key: 'article-4',
      heading: 'ĐIỀU 4. QUYỀN LỢI VÀ TRÁCH NHIỆM CỦA CÁC BÊN',
      body: `Quyền lợi Bên A
- Yêu cầu Bên B cung cấp đầy đủ, chính xác và đúng hạn dữ liệu kết quả tính giờ (bao gồm bảng kết quả tổng hợp, dữ liệu kỹ thuật, hình ảnh minh chứng nếu có) để phục vụ công tác tổng kết, truyền thông.
- Kiểm tra, giám sát quá trình triển khai dịch vụ tính giờ để đảm bảo tính minh bạch, chính xác và tuân thủ quy định chuyên môn.
- Sử dụng kết quả tính giờ và dữ liệu liên quan do Bên B thu thập phục vụ mục đích truyền thông, lưu trữ và tổ chức sự kiện, với điều kiện tuân thủ các quy định bảo mật thông tin.
- Yêu cầu điều chỉnh hoặc làm rõ các nội dung liên quan đến kết quả nếu có căn cứ nghi ngờ sai lệch trong quá trình cung cấp dịch vụ.

Trách nhiệm Bên A
- Cung cấp miễn phí và đúng hạn:
  + Tài liệu mô tả sự kiện, sơ đồ đường chạy, vị trí thảm tính giờ;
  + Danh sách vận động viên đúng mẫu;
  + Mẫu chứng nhận kết quả (PDF, 500KB–1000KB), gửi trước ít nhất 07 ngày;
  + Mẫu thiết kế số đeo (bib), dải số, số lượng bib và chip, gửi trước ít nhất 21 ngày.
- Gửi danh sách vận động viên cuối cùng đúng định dạng không muộn hơn 21:00 ngày trước sự kiện. Mọi thay đổi sau thời điểm này sẽ tính thêm phí phát sinh.
- Đảm bảo điều kiện triển khai cho Bên B:
  + Cung cấp đầy đủ cọc tiêu, hàng rào, lều 3x3m có mái che, quạt, ổ điện tại khu vực đích;
  + Hỗ trợ nhân sự phối hợp, đảm bảo an ninh, bảo vệ thiết bị của Bên B;
  + Đảm bảo quyền tiếp cận và hoạt động không bị gián đoạn từ ít nhất 5 giờ trước đến 5 giờ sau sự kiện;
  + Phối hợp với cơ quan chức năng để đảm bảo pháp lý cho triển khai dịch vụ (nếu cần).
- Thực hiện đầy đủ nghĩa vụ thanh toán theo tiến độ, đảm bảo không làm ảnh hưởng đến hoạt động của Bên B.

Quyền lợi Bên B
- Được đề cập hợp tác với Bên A và sự kiện trong các tài liệu truyền thông hoặc hồ sơ năng lực, với điều kiện không sử dụng tên/logo Bên A nếu chưa được phê duyệt.
- Được bảo lưu và công bố độc lập kết quả tính giờ đo đúng kỹ thuật, nếu Bên A công bố kết quả khác và hai bên đồng ý công bố số liệu đã thống nhất.
- Được từ chối thực hiện các yêu cầu nằm ngoài phạm vi dịch vụ đã ký kết nếu không có thỏa thuận bổ sung bằng văn bản.
- Được yêu cầu Bên A cử đầu mối phối hợp tại hiện trường và hỗ trợ kịp thời khi cần thiết.
- Được truy cập dữ liệu dịch vụ (kết quả, log kỹ thuật) trong vòng 15 ngày sau sự kiện để phục vụ bảo trì, thống kê hoặc xử lý phản hồi (nếu có).

Trách nhiệm Bên B
- Đảm bảo cung cấp đầy đủ, đúng hạn thiết bị, chip, vật tư, nhân sự có chuyên môn phù hợp theo đúng yêu cầu kỹ thuật.
- Chủ động kiểm tra và nghiệm thu hệ thống thiết bị ít nhất 12 giờ trước khi sự kiện diễn ra, và phối hợp xử lý sự cố phát sinh.
- Tham gia xử lý tình huống khẩn cấp trong sự kiện (kỹ thuật, y tế, thiên tai…) cùng Bên A để đảm bảo an toàn và duy trì tính liên tục của hệ thống.
- Tự trang bị hoặc mua bảo hiểm cho thiết bị và nhân sự (nếu cần thiết), chịu trách nhiệm với tài sản của mình trong suốt quá trình làm việc.
- Tuân thủ quy định về an toàn, an ninh, nội quy sự kiện và quy định pháp luật tại địa phương nơi tổ chức sự kiện.
- Cung cấp báo cáo tổng hợp kết quả và dữ liệu liên quan (nếu có yêu cầu) trong vòng 05 ngày làm việc kể từ khi sự kiện kết thúc.
- Bảo mật toàn bộ dữ liệu cá nhân, kết quả vận động viên, tuyệt đối không tiết lộ cho bên thứ ba nếu không có sự đồng ý bằng văn bản từ Bên A.`,
    },
    {
      key: 'article-5',
      heading: 'ĐIỀU 5. CHẤM DỨT HỢP ĐỒNG',
      body: `Hợp Đồng có thể chấm dứt theo một trong các trường hợp sau:
- Hai Bên thỏa thuận chấm dứt Hợp Đồng này bằng văn bản;
- Các Bên đã hoàn thành đầy đủ các nghĩa vụ của mình theo Hợp Đồng này và Hợp Đồng được tự động thanh lý;
- Một Bên vi phạm nghĩa vụ theo thỏa thuận tại Hợp đồng này, đã được bên kia thông báo bằng văn bản/thư điện tử trong vòng 15 ngày kể từ ngày nhận được thông báo mà không sửa chữa, khắc phục được sẽ được xem là vi phạm hợp đồng. Bên gửi thông báo được quyền đơn phương chấm dứt hợp đồng. Bên cạnh đó, bên vi phạm sẽ bị xử lý theo quy định tại Điều 8;
- Một trong hai bên buộc phải giải thể, phá sản theo quyết định của Cơ quan Nhà nước có thẩm quyền.

Đơn phương chấm dứt trước thời hạn: Trong trường hợp một trong hai bên đơn phương chấm dứt Hợp Đồng này trước thời hạn mà không có lý do chính đáng, không thuộc các yếu tố bất khả kháng thì bên đơn phương chấm dứt hợp đồng sẽ phải thanh toán 100% phí Dịch vụ của hợp đồng cũng như bồi thường toàn bộ thiệt hại (nếu có) cho bên bị vi phạm.`,
    },
    {
      key: 'article-6',
      heading: 'ĐIỀU 6. BẢO HIỂM VÀ TRÁCH NHIỆM NGHỀ NGHIỆP',
      body: `Bên B cam kết duy trì đầy đủ các loại bảo hiểm sau trong suốt thời gian thực hiện hợp đồng:
- "Bảo hiểm thiết bị": cho toàn bộ hệ thống đo thời gian bằng chip, bao gồm nhưng không giới hạn ở: chip đo, máy chủ, hệ thống ăng-ten, máy tính, thiết bị mạng…
- "Bảo hiểm trách nhiệm nghề nghiệp", nhằm đảm bảo năng lực tài chính của Bên B trong trường hợp xảy ra thiệt hại do lỗi kỹ thuật, sai sót trong quá trình cung cấp dịch vụ, gây ảnh hưởng đến kết quả sự kiện hoặc dẫn đến khiếu kiện từ Bên A hoặc bên thứ ba.

Trong vòng 05 (năm) ngày kể từ ngày ký hợp đồng, Bên B có trách nhiệm cung cấp bản sao chứng nhận bảo hiểm còn hiệu lực cho Bên A. Trường hợp hết hạn trong thời gian hợp đồng còn hiệu lực, Bên B phải gia hạn và cung cấp bản sao chứng nhận mới.

Trường hợp Bên B không có hoặc không duy trì hiệu lực các bảo hiểm nêu trên, Bên A có quyền đơn phương chấm dứt hợp đồng và yêu cầu bồi thường thiệt hại (nếu có).`,
    },
    {
      key: 'article-7',
      heading: 'ĐIỀU 7. BẤT KHẢ KHÁNG',
      body: `Sự kiện bất khả kháng được quy định bao gồm nhưng không giới hạn ở: luật pháp hiện tại hoặc tương lai thay đổi tác động đến các điều khoản hợp đồng, quy định hoặc mệnh lệnh từ các cấp có thẩm quyền can thiệp vào sự kiện hoặc hợp đồng, thiên tai, động đất, sóng thần, lũ lụt, mưa lớn, hỏa hoạn, dịch bệnh, tai nạn, vụ nổ, thương vong, tranh chấp lao động (bao gồm nhưng không giới hạn ở việc đe dọa hoặc đình công tại xưởng làm việc, tẩy chay hoặc đình công ở khu vực gần xưởng), bạo loạn, xáo trộn dân sự, xung đột chiến tranh hoặc vũ trang, chậm trễ của hãng chuyên chở công cộng hoặc hãng chuyên chở quốc tế.

Sự kiện bất khả kháng tác động lên một trong hai Bên hoặc cả hai Bên thì các nghĩa vụ của Bên bị tác động sẽ bị tạm ngừng thực hiện mà không bị coi là vi phạm Hợp đồng này.

Nếu Sự kiện bị hủy toàn bộ hoặc một phần do sự kiện bất khả kháng, cả hai Bên sẽ được giải phóng khỏi nghĩa vụ tương ứng của mình. Trong trường hợp này, hai Bên sẽ thỏa thuận trách nhiệm đối với Bên B về tất cả các chi phí thực sự phát sinh mà Bên B đã phải gánh chịu đối với các nghĩa vụ đã thực hiện theo thỏa thuận này cho đến ngày thông báo hủy toàn bộ hoặc phần còn lại của Sự kiện.

Trong mọi trường hợp liên quan đến bất khả kháng, hai Bên thống nhất sẽ phối hợp chặt chẽ để đảm bảo kết quả Dịch vụ, khắc phục thiệt hại của nhau và đảm bảo giữ gìn uy tín của nhau trước cộng đồng.`,
    },
    {
      key: 'article-8',
      heading: 'ĐIỀU 8. BỒI THƯỜNG VÀ PHẠT VI PHẠM HỢP ĐỒNG',
      body: `Một trong Hai bên không thực hiện đúng các nghĩa vụ của mình được thỏa thuận tại Hợp Đồng này đều bị xem là vi phạm Hợp Đồng và phải chịu phạt là 8% giá trị phần bị vi phạm. (Trừ trường hợp đơn phương chấm dứt hợp đồng thì chịu phạt giống Điều 5). Bên cạnh đó, Bên vi phạm còn phải chịu trách nhiệm bồi thường toàn bộ thiệt hại thực tế phát sinh mà Bên bị vi phạm phải gánh chịu, trừ trường hợp do Sự kiện bất khả kháng hoặc do lỗi của bên còn lại.

Bên vi phạm có nghĩa vụ nộp tiền phạt vi phạm và/hoặc bồi thường thiệt hại cho Bên kia trong thời hạn 10 (mười) ngày kể từ ngày nhận được Thông báo "Đề nghị thanh toán tiền phạt và/hoặc bồi thường thiệt hại". Trong trường hợp chậm nộp tiền phạt vi phạm và/hoặc bồi thường thiệt hại, Bên có nghĩa vụ thanh toán thêm tiền lãi suất chậm trả tương ứng với thời gian chậm nộp với lãi suất bằng quy định tại Điều 2.

Trong mọi trường hợp, nếu có bất kỳ việc khiếu nại, tranh chấp phát sinh liên quan đến Hợp Đồng này, thì Các Bên đồng ý, thống nhất và đảm bảo rằng một phần và/hoặc toàn bộ trách nhiệm của Bên B sẽ không vượt quá mức Phí dịch vụ mà Bên B nhận được theo Hợp Đồng này.`,
    },
    {
      key: 'article-9',
      heading: 'ĐIỀU 9. BẢO MẬT THÔNG TIN',
      body: `Các Bên thoả thuận và đảm bảo rằng mỗi Bên phải có trách nhiệm bảo mật và giữ kín tất cả các thông tin được cung cấp bởi một Bên (Bên cung cấp thông tin) đến Bên còn lại (Bên tiếp nhận) và theo đó các thông tin này sẽ không được tiết lộ cho bất kỳ bên thứ ba nào khác mà không có sự chấp thuận trước bằng văn bản của Bên cung cấp thông tin ngoại trừ việc cung cấp thông tin là nhằm mục đích thực hiện Hợp Đồng này hoặc theo lệnh, quyết định của cơ quan Nhà nước có thẩm quyền.

Mọi dữ liệu hình ảnh, video, kết quả vận động viên được tạo ra trong quá trình cung cấp dịch vụ cho sự kiện của Bên A là tài sản của Bên A. Bên B không được sử dụng cho mục đích thương mại hoặc công khai mà không có sự chấp thuận bằng văn bản của Bên A.

Hiệu lực và giới hạn của điều khoản bảo mật:
- Hiệu lực kéo dài: Nghĩa vụ bảo mật theo quy định này sẽ tiếp tục có hiệu lực vô thời hạn sau khi Hợp đồng kết thúc hoặc chấm dứt vì bất kỳ lý do gì.
- Ngoại lệ của nghĩa vụ bảo mật: Các Bên không phải bảo mật đối với các thông tin thuộc một trong các trường hợp sau:
  + Thông tin đã được công bố công khai hoặc đã phổ biến rộng rãi không phải do lỗi của Bên tiếp nhận thông tin; hoặc
  + Thông tin phải cung cấp theo yêu cầu của cơ quan nhà nước có thẩm quyền theo quy định pháp luật.
- Nghĩa vụ thông báo: Trong trường hợp Bên tiếp nhận thông tin phải tiết lộ thông tin bảo mật theo yêu cầu của cơ quan nhà nước có thẩm quyền, Bên đó phải thông báo bằng văn bản cho Bên cung cấp thông tin trước khi tiết lộ, nêu rõ lý do, phạm vi thông tin cần tiết lộ và cơ quan yêu cầu tiết lộ.

Các Bên cam kết sẽ tuân thủ các quy định pháp luật về bảo vệ dữ liệu cá nhân được quy định tại Nghị định 13/2023/NĐ-CP ngày 17/04/2023 (và các văn bản hướng dẫn, sửa đổi, bổ sung, thay thế khác (nếu có)) cùng các văn bản pháp luật có liên quan. Đồng thời, các Bên cam kết sẽ trao đổi, thương lượng và/hoặc đồng ý ký kết (các) văn bản, Phụ lục Hợp đồng để điều chỉnh các nội dung liên quan đến việc bảo vệ Dữ liệu cá nhân theo (các) đề xuất, yêu cầu từ Bên còn lại vào mọi thời điểm trong quá trình thực hiện Hợp đồng để đảm bảo tuân thủ quy định pháp luật. Trường hợp Bên nào không tuân thủ các cam kết này, được xem là Bên đó đã vi phạm Hợp đồng và phải chịu hoàn toàn trách nhiệm theo quy định cho các vi phạm do mình gây ra. Bên còn lại có quyền đơn phương chấm dứt Hợp Đồng và các Phụ lục Hợp Đồng ngay lập tức.

Để làm rõ, việc Hai Bên không hoàn thành việc giao kết các văn bản, Phụ lục trong thời hạn đã cam kết mà xuất phát từ lỗi của Một Bên thì được xem là hành vi vi phạm Hợp đồng của Bên đó. Khi đó, Bên còn lại có quyền được miễn trừ trách nhiệm.`,
    },
    {
      key: 'article-10',
      heading: 'ĐIỀU 10. GIẢI QUYẾT TRANH CHẤP HỢP ĐỒNG',
      body: `Trong quá trình thực hiện Hợp Đồng hai Bên cần chủ động thông báo cho nhau biết tiến độ thực hiện Hợp Đồng, nếu có vấn đề bất lợi phát sinh hoặc xảy ra tranh chấp, các Bên phải kịp thời thông báo bằng văn bản cho nhau biết và phải chủ động bàn bạc giải quyết trên cơ sở thương lượng, tôn trọng quyền và lợi ích hợp pháp của các Bên.

Trong quá trình thực hiện Hợp đồng này, nếu có bất kỳ tranh chấp, mâu thuẫn nào phát sinh từ hoặc liên quan đến Hợp đồng, Các Bên trước hết sẽ nỗ lực cùng nhau thương lượng, thảo luận giải quyết trên tinh thần đôi bên đều có lợi. Trường hợp Các Bên không thể giải quyết được các tranh chấp, mâu thuẫn đó trên tinh thần thiện chí trong vòng 30 (ba mươi) ngày kể từ khi một Bên đề cập vấn đề cho Bên kia bằng văn bản, Các Bên đồng ý rằng vụ việc, tranh chấp sẽ được giải quyết tại Tòa án nhân dân có thẩm quyền theo quy định của pháp luật.`,
    },
    {
      key: 'article-11',
      heading: 'ĐIỀU 11. ĐIỀU KHOẢN CHUNG',
      body: `Hợp Đồng này và những phụ lục kèm theo tạo thành một chỉnh thể thống nhất, không tách rời và thay thế tất cả thỏa thuận trước đây bằng miệng hoặc bằng văn bản giữa các Bên.

Mọi sửa đổi, bổ sung hoặc hiệu chỉnh đối với Hợp Đồng này chỉ có giá trị khi được Các Bên lập thành văn bản.

Các Bên cam kết thực hiện đúng và đầy đủ các quyền và nghĩa vụ của mình quy định tại Hợp đồng này và các Phụ lục kèm theo (nếu có).

Mỗi Bên chịu trách nhiệm thanh toán nghĩa vụ thuế của mỗi bên phát sinh từ giao dịch theo Hợp đồng này. Nếu có bất kỳ khoản thuế nào thuộc nghĩa vụ của Bên A mà Bên B có trách nhiệm khấu trừ và nộp hộ theo pháp luật Việt Nam thì Bên B phải tính và khấu trừ, nộp hộ cho Bên A theo đúng quy định của pháp luật. Và khoản tiền này được khấu trừ vào khoản tiền Bên B thanh toán cho Bên A.

Bất kỳ tranh chấp nào phát sinh từ hoặc liên quan đến Hợp Đồng này trước tiên sẽ giải quyết thông qua thương lượng và hòa giải giữa Các Bên. Trong trường hợp giữa Các Bên có tranh chấp mà không thể giải quyết bằng thương lượng và hòa giải thì mọi tranh chấp phát sinh từ hoặc liên quan đến Hợp Đồng này sẽ được giải quyết tại Tòa án Nhân dân có thẩm quyền của Việt Nam.

Hợp Đồng này được điều chỉnh và giải thích phù hợp với pháp luật Việt Nam.

Các Bên thống nhất rằng trong vòng 07 ngày kể từ ngày Các Bên hoàn thành các nghĩa vụ và/hoặc kết thúc thời hạn theo quy định tại Hợp Đồng này mà không có bất kỳ khiếu nại, tranh chấp của một trong Các Bên hoặc Hai Bên thì Hợp Đồng này được làm thành 02 (hai) bản gốc bằng tiếng Việt và có giá trị pháp lý như nhau. Mỗi Bên giữ 01 (một) bản để thực hiện.

ĐỂ LÀM BẰNG CHỨNG, Các Bên dưới đây đã đồng ý ký tên vào ngày được nêu trên phần đầu của Hợp Đồng này.`,
    },
  ],

  /* --------------------------------------------------------------------------
   * RACEKIT — Hợp đồng vận hành racekit (5BIB ↔ đối tác)
   * File gốc: [RACEKIT] - 5BIB - Hợp đồng vận hành racekit ... .docx
   * 11 Điều: ĐỐI TƯỢNG / PHÍ DỊCH VỤ / THANH TOÁN / QUYỀN+TN BÊN A /
   *          QUYỀN+TN BÊN B / CHẤM DỨT / BẤT KHẢ KHÁNG / BỒI THƯỜNG+PHẠT /
   *          BẢO MẬT / TRANH CHẤP / ĐIỀU KHOẢN CHUNG
   * Điều 5-11 share với OPERATIONS.
   * ------------------------------------------------------------------------ */
  RACEKIT: [
    {
      key: 'article-1',
      heading: 'ĐIỀU 1. ĐỐI TƯỢNG VÀ PHẠM VI HỢP ĐỒNG',
      body: `Định nghĩa/Từ viết tắt:
- "Vận động viên" hay "VĐV": là người tham gia Sự kiện đủ tiêu chuẩn, điều kiện theo quy định tại Hợp đồng này.
- "BIB" hay "Bib": Là mã số định danh cho từng người chạy. Vận động viên phải đeo số Bib khi tham gia giải chạy Bên A.
- "Racekit": là bộ vật phẩm và tài liệu mà người tham gia giải chạy nhận được khi đăng ký tham dự, bao gồm 01 bib, 01 áo, 01 túi.

Nội dung Hợp đồng:

Bên A chỉ định và Bên B đồng ý thực hiện vận hành dịch vụ Racekit tại giải chạy {raceName} do Bên A tổ chức (sau đây gọi là "Sự kiện/Dịch vụ") với nội dung như sau:
- Thời gian: {raceDate}
- Địa điểm: {raceLocation}
- Số lượng VĐV: {athleteCount}

Chi tiết nội dung công việc và tiến độ thực hiện được quy định trong Phụ lục 01 đính kèm, không tách rời Hợp đồng này.

Phụ lục được lập kèm theo Hợp đồng và là một bộ phận không thể tách rời của Hợp đồng chính. Mọi nội dung quy định trong Phụ lục có giá trị pháp lý tương đương như các điều khoản trong Hợp đồng và được áp dụng cùng với Hợp đồng chính. Trong trường hợp có sự khác biệt giữa nội dung của Phụ lục và Hợp đồng chính, các bên sẽ ưu tiên áp dụng quy định được hai bên thống nhất ghi tại Phụ lục, trừ khi có thỏa thuận khác bằng văn bản.`,
    },
    {
      key: 'article-2',
      heading: 'ĐIỀU 2. PHÍ DỊCH VỤ, GIÁ TRỊ HỢP ĐỒNG',
      body: `Tổng giá trị Hợp đồng (đã bao gồm {vatRate}% VAT): {totalAmount} VND

(Bằng chữ: {totalAmountInWords}). Chi tiết cụ thể theo Phụ lục 01 đính kèm Hợp đồng.

Tổng giá trị Hợp đồng này đã bao gồm thuế VAT và các chi phí phát sinh liên quan đến việc cung cấp Dịch vụ, bao gồm cả chi phí vận chuyển, lắp đặt và tháo gỡ thiết bị, thu dọn hiện trường và bàn giao hiện trạng ban đầu sau khi kết thúc Sự kiện. Giá trị Hợp đồng có thể thay đổi căn cứ vào các chi phí phát sinh thực tế từ việc thực hiện Dịch vụ. Tuy nhiên, bất cứ chi phí phát sinh mà có thể làm thay đổi Tổng giá trị Hợp đồng nêu trên phải được Hai Bên thống nhất phê duyệt bằng văn bản trước khi thực hiện công việc phát sinh đó.`,
    },
    {
      key: 'article-3',
      heading: 'ĐIỀU 3. ĐIỀU KHOẢN THANH TOÁN',
      body: `Thanh toán: Tổng giá trị Hợp đồng sẽ được Bên A thanh toán cho Bên B thành 2 đợt như sau:

Thanh toán đợt 1: Bên A sẽ thanh toán cho Bên B {advancePercentage}% Tổng giá trị Hợp đồng nêu tại Điều 2 của Hợp đồng này ({advanceAmount} VND) trong vòng mười (10) ngày làm việc sau khi hai Bên ký kết Hợp đồng và Bên A nhận được đủ hồ sơ thanh toán gồm:
- Đề nghị thanh toán của Bên B;
- Hóa đơn tài chính hợp pháp, hợp lệ tương ứng {advancePercentage}% Tổng Giá trị Hợp đồng.

Thanh toán đợt 2: Bên A sẽ thanh toán cho Bên B giá trị còn lại của Hợp đồng và các chi phí phát sinh (nếu có) theo xác nhận của hai Bên trong Biên bản nghiệm thu, trong vòng ba mươi (30) ngày làm việc sau khi Bên B hoàn thành việc cung cấp Dịch vụ và Bên A nhận được hồ sơ thanh toán đợt 2 gồm:
- Giấy đề nghị thanh toán;
- Hóa đơn tài chính hợp pháp, hợp lệ tương ứng với số tiền Bên A thanh toán thực tế đợt 2;
- Biên bản nghiệm thu, thanh lý Hợp đồng được Hai Bên xác nhận.

Báo cáo chi phí thực tế (nếu có thay đổi trong hạng mục công việc và/hoặc giá trị Hạng mục so với thời điểm ký Hợp đồng) sẽ được xuất trình ngay sau khi Bên B hoàn tất toàn bộ Dịch vụ theo Hợp đồng và chỉnh sửa số liệu thanh toán dựa trên thực tế thực hiện Hợp đồng. Báo cáo chi phí thực tế phải được Hai Bên xác nhận đính kèm Biên bản nghiệm thu, thanh lý Hợp đồng.

Phương thức thanh toán: Chuyển khoản
Tài khoản: {provider.bankAccount} - tại {provider.bankName}
Đồng tiền thanh toán: Việt Nam Đồng.`,
    },
    {
      key: 'article-4',
      heading: 'ĐIỀU 4. QUYỀN LỢI VÀ TRÁCH NHIỆM CỦA BÊN A',
      body: `Quyền của Bên A
- Kiểm tra, giám sát việc thực hiện Dịch vụ trong suốt thời gian thực hiện Hợp đồng này.
- Yêu cầu Bên B chỉnh sửa làm cơ sở để Bên A phê duyệt tất cả nội dung chi tiết liên quan đến Dịch vụ bao gồm nhưng không giới hạn ở các hạng mục quy định chi tiết trong Phụ lục 01 của Hợp đồng này trước khi thực hiện.
- Được quyền dừng thanh toán Dịch vụ trong trường hợp Bên B vi phạm nghĩa vụ được quy định tại Hợp đồng này.
- Được yêu cầu bồi thường các thiệt hại do lỗi vi phạm Hợp đồng của Bên B (nếu có).

Trách nhiệm của Bên A
- Thanh toán đầy đủ và đúng hạn cho Bên B theo Điều 3 của Hợp đồng.
- Cung cấp tất cả các thông tin cần thiết cho Bên B cho mục đích cung cấp Dịch vụ.
- Chỉ định đại diện giám sát, liên lạc, hướng dẫn hỗ trợ giải quyết công việc cùng với Bên B trong suốt quá trình thực hiện Hợp đồng.
- Sắp xếp, bố trí và hỗ trợ Bên B trong việc liên hệ làm việc với các phòng, ban của Bên A và các đơn vị, tổ chức tham gia thực hiện Dịch vụ theo Hợp đồng này.
- Bồi thường thiệt hại đối với những vi phạm tác quyền (nếu có) trực tiếp phát sinh do lỗi của Bên A.
- Chịu trách nhiệm bồi thường những thiệt hại trực tiếp gây ra cho Bên B do Bên A vi phạm các điều khoản Hợp đồng này (nếu có).
- Bên A cam kết sẽ giữ cho Bên B tránh khỏi và sẽ có trách nhiệm đối với các tổn thất, thiệt hại hoặc chi phí phát sinh (nếu có) nếu để xảy ra bất kỳ khiếu nại, khiếu kiện hoặc tranh chấp nào từ Bên thứ ba liên quan đến việc Bên B sử dụng các thông tin và tài liệu do Bên A cung cấp trong quá trình cung cấp Dịch vụ.
- Chịu trách nhiệm tôn trọng và bảo mật đối với kịch bản do Bên B dàn dựng chưa được Bên A nghiệm thu.`,
    },
    ...SHARED_RACEKIT_OPERATIONS,
  ],

  /* --------------------------------------------------------------------------
   * OPERATIONS — Hợp đồng vận hành giải chạy (5Sport ↔ đối tác)
   * File gốc: 14.4.26 [Hành Trình ...] - 5Sport - Hợp đồng vận hành (1).docx
   * 11 Điều: ĐỐI TƯỢNG / PHÍ DỊCH VỤ / THANH TOÁN / QUYỀN+TN BÊN A /
   *          QUYỀN+TN BÊN B / CHẤM DỨT / BẤT KHẢ KHÁNG / BỒI THƯỜNG+PHẠT /
   *          BẢO MẬT / TRANH CHẤP / ĐIỀU KHOẢN CHUNG
   * Điều 5-11 share với RACEKIT.
   * ------------------------------------------------------------------------ */
  OPERATIONS: [
    {
      key: 'article-1',
      heading: 'ĐIỀU 1. ĐỐI TƯỢNG VÀ PHẠM VI HỢP ĐỒNG',
      body: `1.1. Bên B sẽ cung cấp dịch vụ vận hành giải chạy "{raceName}" cho Bên A tại sự kiện do Bên A tổ chức.

Thời gian diễn ra sự kiện: {raceDate}
Thời gian setup: theo lịch thống nhất giữa hai Bên trước Raceday
Expoday: theo lịch thống nhất giữa hai Bên
Raceday: ngày tổ chức giải chạy chính

Địa điểm: {raceLocation}`,
    },
    {
      key: 'article-2',
      heading: 'ĐIỀU 2. PHÍ DỊCH VỤ, GIÁ TRỊ HỢP ĐỒNG',
      body: `Tổng giá trị Hợp đồng (đã bao gồm {vatRate}% VAT): {totalAmount} VND

(Bằng chữ: {totalAmountInWords}).

Đơn giá chi tiết từng hạng mục Dịch vụ được quy định tại Phụ lục 01 đính kèm Hợp đồng này.

Tổng giá trị Hợp đồng này đã bao gồm thuế VAT và các chi phí phát sinh liên quan đến việc cung cấp Dịch vụ, bao gồm cả chi phí vận chuyển, lắp đặt và tháo gỡ thiết bị, thu dọn hiện trường và bàn giao hiện trạng ban đầu sau khi kết thúc Sự kiện. Giá trị Hợp đồng có thể thay đổi căn cứ vào các chi phí phát sinh thực tế từ việc thực hiện Dịch vụ. Tuy nhiên, bất cứ chi phí phát sinh mà có thể làm thay đổi Tổng giá trị Hợp đồng nêu trên phải được Hai Bên thống nhất phê duyệt bằng văn bản trước khi thực hiện công việc phát sinh đó.`,
    },
    {
      key: 'article-3',
      heading: 'ĐIỀU 3. ĐIỀU KHOẢN THANH TOÁN',
      body: `Thanh toán: Tổng giá trị Hợp đồng sẽ được Bên A thanh toán cho Bên B thành 2 đợt như sau:

Thanh toán đợt 1: Bên A sẽ tạm ứng cho Bên B {advancePercentage}% Tổng giá trị Hợp đồng nêu tại Điều 2 của Hợp đồng này ({advanceAmount} VND) trong vòng 10 (mười) ngày làm việc sau khi hai Bên ký kết Hợp đồng và Bên A nhận được đề nghị thanh toán.

Thanh toán đợt 2: Bên A sẽ thanh toán cho Bên B giá trị còn lại của Hợp đồng và các chi phí phát sinh (nếu có) theo xác nhận của hai Bên trong Biên bản nghiệm thu, trong vòng 30 (ba mươi) ngày làm việc sau khi Bên B hoàn thành việc cung cấp Dịch vụ và Bên A nhận được hồ sơ thanh toán đợt 2 gồm:
- Giấy đề nghị thanh toán;
- Hóa đơn tài chính hợp pháp, hợp lệ;
- Biên bản nghiệm thu, thanh lý Hợp đồng được Hai Bên xác nhận.

Báo cáo chi phí thực tế (nếu có thay đổi trong hạng mục công việc và/hoặc giá trị Hạng mục so với thời điểm ký Hợp đồng) sẽ được xuất trình ngay sau khi Bên B hoàn tất toàn bộ Dịch vụ theo Hợp đồng và chỉnh sửa số liệu thanh toán dựa trên thực tế thực hiện Hợp đồng. Báo cáo chi phí thực tế phải được Hai Bên xác nhận đính kèm Biên bản nghiệm thu, thanh lý Hợp đồng.

Phương thức thanh toán: Chuyển khoản
Chủ tài khoản: {provider.entityName}
Ngân hàng: {provider.bankName}
Tài khoản: {provider.bankAccount}
Đồng tiền thanh toán: Việt Nam Đồng.`,
    },
    {
      key: 'article-4',
      heading: 'ĐIỀU 4. QUYỀN LỢI VÀ TRÁCH NHIỆM CỦA BÊN A',
      body: `Quyền của Bên A
- Kiểm tra, giám sát việc thực hiện Dịch vụ trong suốt thời gian thực hiện Hợp đồng này.
- Yêu cầu Bên B chỉnh sửa làm cơ sở để Bên A phê duyệt tất cả nội dung chi tiết liên quan đến Dịch vụ bao gồm nhưng không giới hạn ở các hạng mục quy định chi tiết trong Phụ lục 01 của Hợp đồng này trước khi thực hiện.
- Được quyền dừng thanh toán Dịch vụ trong trường hợp Bên B vi phạm nghĩa vụ được quy định tại Hợp đồng này.
- Được yêu cầu bồi thường các thiệt hại do lỗi vi phạm Hợp đồng của Bên B (nếu có).

Trách nhiệm của Bên A
- Thanh toán đầy đủ và đúng hạn cho Bên B theo Điều 3 của Hợp đồng.
- Cung cấp tất cả các thông tin cần thiết cho Bên B cho mục đích cung cấp Dịch vụ.
- Chỉ định đại diện giám sát, liên lạc, hướng dẫn hỗ trợ giải quyết công việc cùng với Bên B trong suốt quá trình thực hiện Hợp đồng.
- Sắp xếp, bố trí và hỗ trợ Bên B trong việc liên hệ làm việc với các phòng, ban của Bên A và các đơn vị, tổ chức tham gia thực hiện Dịch vụ theo Hợp đồng này.
- Bồi thường thiệt hại đối với những vi phạm tác quyền (nếu có) trực tiếp phát sinh do lỗi của Bên A.
- Chịu trách nhiệm bồi thường những thiệt hại trực tiếp gây ra cho Bên B do Bên A vi phạm các điều khoản Hợp đồng này (nếu có).
- Bên A cam kết sẽ giữ cho Bên B tránh khỏi và sẽ có trách nhiệm đối với các tổn thất, thiệt hại hoặc chi phí phát sinh (nếu có) nếu để xảy ra bất kỳ khiếu nại, khiếu kiện hoặc tranh chấp nào từ Bên thứ ba liên quan đến việc Bên B sử dụng các thông tin và tài liệu do Bên A cung cấp trong quá trình cung cấp Dịch vụ.
- Chịu trách nhiệm tôn trọng và bảo mật đối với kịch bản do Bên B dàn dựng chưa được Bên A nghiệm thu.`,
    },
    ...SHARED_RACEKIT_OPERATIONS,
  ],

  /* --------------------------------------------------------------------------
   * TICKET_SALES — Hợp đồng cung cấp dịch vụ bán vé (5BIB ↔ đối tác)
   * File gốc: [5BIB] Hợp đồng bán vé Giải chạy ... 2026.docx
   * 11 Điều: ĐỐI TƯỢNG / SỞ HỮU TRÍ TUỆ / HOÃN HỦY / HOÀN TIỀN / ĐỐI SOÁT /
   *          THANH TOÁN / HÓA ĐƠN / NGHĨA VỤ HAI BÊN / CHẤM DỨT /
   *          BẢO MẬT / TRANH CHẤP
   * Khác hoàn toàn 3 loại HĐ trên — KHÔNG dùng SHARED_RACEKIT_OPERATIONS.
   * ------------------------------------------------------------------------ */
  TICKET_SALES: [
    {
      key: 'article-1',
      heading: 'ĐIỀU 1. ĐỐI TƯỢNG VÀ PHẠM VI HỢP ĐỒNG',
      body: `Bên A: là Đơn vị được Ban Tổ chức sự kiện ủy quyền làm việc;

Bên B: là đơn vị cung cấp dịch vụ lập trình, nền tảng công nghệ, cơ sở dữ liệu để tổ chức và thực hiện việc phân phối vé cho Bên A;

Bên A đồng ý cho Bên B bằng nền tảng công nghệ của mình, mở cổng đăng ký dưới dạng phân phối vé điện tử cho người dùng tham gia sự kiện;

Loại hình hợp tác: ☐ Độc Quyền
Loại dịch vụ bán: ☒ Thường

Tiền bán vé: là khoản tiền được người dùng thanh toán khi mua vé qua website của Bên B.

Giá vé:
- Thông tin chi tiết giá vé sẽ được công bố trên website 5bib.com;
- Giá vé khuyến mãi là giá được giảm trên giá gốc tại thời điểm đăng ký đối với các vé mua theo nhóm hoặc có mã giảm giá và theo quy định của Bên A.

Phí dịch vụ:
- Phí lập trình mở cổng bán vé (gọi là "Phí bán vé"): {ticketFeePercent}% trên tổng doanh thu mà người dùng thanh toán qua website của Bên B (nếu có). Doanh thu này được gọi là "Khoản Bán Vé".
- Phí quản lý vận động viên (gọi là "Phí quản lý"): {athleteManagementFee} VND trên lượt vận động viên mà ban tổ chức tạo ra trên hệ thống không phát sinh giao dịch qua website. Doanh thu này được gọi là "Khoản quản lý".

Bên B hỗ trợ vé có mã giảm giá 100%.

Các loại phí dịch vụ trên sẽ được Bên A thanh toán cho Bên B bằng cách cấn trừ vào Khoản Bán Vé (bao gồm tiền từ thiện nếu có) hoặc chuyển khoản vào tài khoản của Bên B nếu Khoản Bán Vé không đủ thanh toán.

(*) Thuế GTGT: Phí dịch vụ trên đã bao gồm thuế VAT và đã bao gồm các loại thuế khác (nếu có) theo pháp luật Việt Nam.

Thời hạn hợp đồng: từ ngày ký đến khi sự kiện kết thúc và các bên đã hoàn thành xong tất cả nghĩa vụ của mình.

THÔNG TIN SỰ KIỆN:

Bên A đồng ý cho Bên B mở cổng đăng ký tham gia sự kiện dưới dạng vé điện tử với chi tiết cụ thể như bên dưới:
- Tên sự kiện: {raceName}
- Thời gian diễn ra sự kiện: {raceDate}
- Thời gian đăng ký: theo lịch thống nhất giữa hai Bên
- Loại vé: Vé điện tử
- Bên B cung ứng Vé điện tử đến Khách Hàng
- Bên A chấp nhận vé này có giá trị tham gia, tham dự Sự Kiện
- Hạn sử dụng: Vé có giá trị sử dụng trong thời gian diễn ra sự kiện.`,
    },
    {
      key: 'article-2',
      heading: 'ĐIỀU 2. GIẤY PHÉP VÀ SỞ HỮU TRÍ TUỆ',
      body: `Bên A cam kết và đảm bảo rằng:
- Sự Kiện được tổ chức và các tổ chức, cá nhân tham gia, tham dự Sự Kiện sẽ tuân thủ đầy đủ các quy định của pháp luật Việt Nam, không bao gồm bất kỳ nội dung, hành động nào có khuynh hướng tôn giáo, chính trị, kỳ thị dân tộc, phỉ báng, bôi nhọ, phản động bất kể là trực tiếp hay gián tiếp.
- Sự Kiện đã hoặc sẽ có đầy đủ tất cả các Giấy phép, cho phép và/hoặc phê duyệt cần thiết từ Cơ quan Nhà nước có thẩm quyền đối với việc tổ chức và mọi hoạt động sẽ diễn ra trong Sự Kiện theo đúng quy định pháp luật.
- Mọi hoạt động được tổ chức trong Sự Kiện sẽ tuân thủ theo đúng nội dung của Giấy phép đã được cấp và/hoặc nội dung được Cơ quan Nhà nước có thẩm quyền phê duyệt.
- Đối với các tư liệu quảng cáo và/hoặc các tài liệu được Bên A cung cấp cho Bên B nhằm hỗ trợ việc phân phối Vé, Bên A cam kết và đảm bảo rằng, Bên A có đầy đủ Quyền Sở Hữu Trí Tuệ hoặc được cấp phép đầy đủ và hợp pháp từ chủ sở hữu đối với các tư liệu, tài liệu này và Bên A đồng ý cấp cho Bên B quyền lưu trữ, sử dụng, phân phối, sửa đổi (chỉ nhằm mục đích kỹ thuật sao cho các tư liệu, tài liệu này đáp ứng các tiêu chuẩn của Bên B) các tư liệu, tài liệu này để phục vụ việc phân phối Vé.
- Bên A đã có thỏa thuận và chi trả mọi chi phí liên quan đến quyền tác giả và quyền liên quan đối với các ca khúc, nhạc phẩm, bản ghi âm, ghi hình được sử dụng trong Sự Kiện (nếu có).

Trường hợp có bất kỳ khiếu nại, khiếu kiện nào liên quan đến Quyền Sở Hữu Trí Tuệ của bất kỳ tư liệu, tài liệu nào do Bên A cung cấp, Bên A cam kết và đảm bảo rằng, Bên A sẽ tự mình và bằng chi phí của chính mình để tiếp nhận, giải quyết và đảm bảo Bên B sẽ không phải chịu bất kỳ trách nhiệm hay thiệt hại nào có liên quan. Trong trường hợp này, Bên B có quyền ngay lập tức tạm ngưng sử dụng các tư liệu, tài liệu bị khiếu nại về Quyền Sở Hữu Trí Tuệ, tháo gỡ khỏi website của Bên B và Bên B sẽ không phải chịu trách nhiệm về bất kỳ sự sụt giảm doanh số phân phối Vé nào của Bên A.

Trường hợp Bên A không đảm bảo được hoặc vi phạm bất kỳ hay toàn bộ các yêu cầu nêu trên, Bên B có quyền:
- Tạm ngưng việc phân phối Vé của Bên A mà không phải chịu bất kỳ khoản phạt nào hay bồi thường bất kỳ khoản tiền nào cho Bên A;
- Tạm giữ Khoản doanh thu bán vé chưa hoàn trả mà không phải trả lãi cho đến khi các yêu cầu nêu trên được đáp ứng hoặc Bên A tuyên bố hủy Sự Kiện và thực hiện đầy đủ các nghĩa vụ của Bên A khi hủy Sự Kiện theo quy định tại Hợp đồng này đến Khách Hàng. Trừ trường hợp các Bên có thoả thuận khác.

Ngoài ra, các Bên đồng ý và công nhận rằng, các Quyền Sở Hữu Trí Tuệ được tạo lập, phát triển bởi và/hoặc bằng chi phí của Bên nào sẽ thuộc Quyền Sở Hữu Trí Tuệ của Bên đó. Việc hợp tác theo quy định của Hợp đồng này sẽ không mặc nhiên tạo ra hoặc mang tới cho Bên còn lại bất kỳ các quyền nào đối với Quyền Sở Hữu Trí Tuệ của Bên sở hữu.

Trong khi Hợp đồng được thực hiện và sau khi Hợp đồng kết thúc, mỗi Bên không được chiếm hữu bất kỳ tài sản trí tuệ nào hoặc các quyền khác đối với bất kỳ nhãn hiệu thương mại, tên thương mại, logo, biểu tượng hoặc vật phẩm nào của mỗi bên.`,
    },
    {
      key: 'article-3',
      heading: 'ĐIỀU 3. HOÃN, HỦY SỰ KIỆN',
      body: `Chính sách hoàn hủy vé/thay đổi cự ly/chuyển nhượng:
- Hủy đăng ký;
- Chuyển nhượng;
- Hạ cự ly;
- Tăng cự ly;
- Thời hạn đổi size áo;
- Thời hạn chuyển nhượng/Đổi cự ly.

Trường hợp Sự Kiện bị hoãn hoặc hủy vì bất kỳ lý do nào, Bên A cam kết sẽ ngay lập tức thông báo đến Bên B và Khách Hàng đã mua Vé về quyết định hoãn, hủy Sự Kiện này và kế hoạch hoàn tiền cũng như những biện pháp cần thiết khác nhằm đảm bảo quyền lợi của Khách Hàng đã mua Vé và/hoặc thanh toán tiền theo đúng quy định của pháp luật.

Bên A hiểu rõ và đồng ý rằng, Bên B chỉ là đơn vị hỗ trợ việc phân phối Vé cho (các) Sự Kiện của Bên A; vì vậy, trong mọi trường hợp Sự Kiện bị hoãn, hủy vì bất kỳ lý do nào, Bên A sẽ tự mình và bằng chi phí của chính mình để tiếp nhận, xử lý, giải quyết cho Khách Hàng và đảm bảo Bên B sẽ không phải chịu bất kỳ trách nhiệm hay thiệt hại nào xuất phát từ việc Sự Kiện bị hoãn, hủy. Mặc dù vậy, trong khả năng và tùy điều kiện cho phép, Bên B sẽ hỗ trợ Bên A các thông tin liên quan đến các giao dịch, Vé đã được bán cho Khách Hàng.

Trong vòng hai mươi bốn giờ (24) làm việc kể từ thời điểm Bên B nhận được thông báo hoãn, hủy Sự Kiện từ Bên A, Bên B sẽ thực hiện (i) thông báo trên website 5bib.com (trong trường hợp hoãn tổ chức Sự Kiện) hoặc (ii) ngừng phân phối Vé (trong trường hợp hủy Sự Kiện) kèm theo kế hoạch hoàn tiền và các biện pháp khác (nếu cần) nhằm đảm bảo quyền lợi cho Khách Hàng đã mua vé, (iii) hỗ trợ Bên A tiếp nhận và chuyển các thông tin, yêu cầu của khách hàng kịp thời liên quan đến việc sự kiện bị hoãn huỷ, (iv) Thông báo và hướng dẫn Khách hàng liên hệ đầu mối giải quyết các yêu cầu, đề nghị và các khiếu nại liên quan đến sự kiện bị hoãn/huỷ, (v) phối hợp với Bên A trong việc giải quyết và chịu trách nhiệm về các vấn đề liên quan đến yêu cầu hoàn tiền của khách hàng.

Bên A đồng ý và cam kết rằng, Bên B vẫn được hưởng phí dịch vụ đối với những Vé được phân phối thông qua 5BIB (đã hoàn thành thanh toán), ngoại trừ những Vé được phân phối sau hai mươi bốn (24) giờ kể từ thời điểm Bên B nhận được thông báo về việc hủy Sự Kiện từ Bên A.`,
    },
    {
      key: 'article-4',
      heading: 'ĐIỀU 4. HOÀN TIỀN CHO KHÁCH',
      body: `Việc hoàn tiền cho Khách Hàng sẽ được thực hiện khi Bên A có quyết định hoãn, hủy Sự Kiện như đã nêu tại mục Hoãn, Hủy Sự Kiện nêu trên.

Việc hoàn tiền cho Khách Hàng phải được thực hiện (i) đúng theo thông báo của Bên A đã gửi cho Khách Hàng và/hoặc 5BIB, (ii) trong một thời hạn hợp lý và (iii) phù hợp với quy định pháp luật hiện hành.

Để đảm bảo quyền lợi của Khách Hàng, Bên B được quyền thay mặt Bên A thực hiện nghĩa vụ hoàn tiền đối với Khách Hàng khi Bên A đồng ý xác nhận và Bên A cam kết ngoài Phí bán vé, Bên A sẽ thanh toán lại cho Bên B toàn bộ số tiền mà Bên B đã chi trả thực tế cho Khách Hàng (nếu có) khi Bên A cung cấp các hồ sơ chứng từ chứng minh các khoản chi đó là hợp pháp và được Bên A thống nhất trước khi thực hiện. Lưu ý rằng với các trường hợp hoàn tiền này, Bên B vẫn được thu Khoản phí bán vé tương đương 6.5% trên tổng số tiền mà khách hàng đã thanh toán mua vé của Bên A.

Ngoài ra, Bên A phải bồi thường cho Bên B toàn bộ thiệt hại mà Bên B phải gánh chịu (nếu có).

Bên A sẽ phải thanh toán toàn bộ số tiền nêu trên (gọi là "Khoản thanh toán") cho Bên B bằng cách cấn trừ vào khoản tiền bán vé mà Bên B phải thanh toán cho Bên A (gọi là "Khoản đã thu"), nếu Khoản thanh toán nhiều hơn Khoản đã thu thì phần chênh lệch phải được Bên A thanh toán cho Bên B trong vòng bảy (07) Ngày Làm Việc kể từ ngày Bên B gửi thông tin cho Bên A; trường hợp Bên A thanh toán chậm trễ thì Bên A sẽ phải chịu phạt thêm tiền lãi suất cộng dồn bằng {paymentTerms.latePenaltyRate}{paymentTerms.latePenaltyUnit} trên số tiền chậm thanh toán cho mỗi ngày chậm thanh toán nhưng không quá 8% trên tổng số tiền chậm thanh toán tại thời điểm thanh toán hoặc Bên A sẽ tự chịu trách nhiệm thanh toán cho khách hàng.

Bên B sẽ được miễn trừ tất cả trách nhiệm liên quan đến việc Hoãn/Hủy sự kiện do lỗi của Bên A.`,
    },
    {
      key: 'article-5',
      heading: 'ĐIỀU 5. ĐỐI SOÁT VÀ BÀN GIAO THÔNG TIN',
      body: `Đối soát

Các đợt đối soát số liệu giữa các Bên:
- Việc đối soát sẽ được Bên B và Bên A thực hiện theo từng đợt hoặc sau khi kết thúc sự kiện với thời hạn của từng đợt tùy theo thỏa thuận giữa hai bên ("Đợt Đối Soát").
- 1 Tháng/lần cố định vào ngày đầu tiên của tháng hiện tại, số liệu lấy từ ngày 01 đến hết ngày cuối cùng của tháng trước đó. Chốt số liệu vào ngày tiếp theo, các khoản thu tiền và trừ phí của lần đối soát sẽ được cấn trừ trực tiếp vào khoản thu và chuyển về cho ban tổ chức tối đa sau 02 (hai) ngày kể từ ngày xác nhận đối soát.

Bên B sẽ gửi cho Bên A toàn bộ số liệu liên quan đến việc phân phối Vé của từng Đợt Đối Soát đến thư điện tử (email) do Bên A chỉ định. Bên A sẽ xem xét và phản hồi cho Bên B trong vòng hai (02) Ngày Làm Việc kể từ thời điểm nhận được email của Bên B (hoặc hệ thống email của Bên B thông báo là đã gửi thành công và phải có đại diện của Bên A xác nhận đã nhận được email); trường hợp quá thời hạn nêu trên mà Bên B không nhận được bất kỳ thông tin phản hồi nào từ Bên A về số liệu đối soát thì xem như là Bên A đã đồng ý với toàn bộ số liệu mà Bên B đã gửi và số liệu này sẽ được dùng làm cơ sở để Quyết toán và Thanh toán.

Trong trường hợp Bên A không đồng ý với số liệu của Bên B thì hai Bên phải cùng nhau kiểm tra lại hệ thống. Nếu lỗi xác nhận từ phía Bên B thì các Bên sẽ xác nhận số liệu đối soát của phía Bên A hoặc ngược lại.

Thời điểm gửi Báo cáo Doanh thu và Báo cáo đối soát:
- Bên B gửi Báo cáo đối soát bán vé chậm nhất trong vòng 02 (hai) ngày đầu tiên của kỳ đối soát tiếp theo cho Bên A theo thông tin trao đổi, gửi và nhận dữ liệu đối soát của hai Bên được quy định tại Hợp Đồng này.
- Bên A hiểu và đồng ý rằng, việc đối soát, xác nhận số liệu đối soát thông qua email do Bên A chỉ định sẽ có giá trị pháp lý làm cơ sở để các Bên cùng ký biên bản đối soát được thực hiện bằng bản giấy có chữ ký xác nhận của đại diện hai bên và đóng dấu Công ty; theo đó, Bên A không được phủ nhận giá trị pháp lý của các email đối soát số liệu này chỉ vì việc đối soát được thực hiện thông qua phương tiện điện tử.

Trường hợp số liệu của Bên B và số liệu của Bên A có xảy ra chênh lệch thì hai bên sẽ cùng thực hiện đối soát chi tiết để có số liệu đối soát chính xác.

Trong các kỳ đối soát, nếu Bên A phát hiện có nhầm lẫn/sai sót trong quá trình đối soát số lượng vé và giá trị tiền thu về, Bên B có trách nhiệm đối soát bổ sung ngay sau khi có phản hồi của Bên A. Trường hợp nếu không thể khắc phục được nhầm lẫn, sai sót đó (phát sinh do lỗi của Bên B) thì Bên B chịu trách nhiệm đền bù thiệt hại trên thực tế cho Bên A.

Bàn giao thông tin

Bên B sẽ cung cấp cho Bên A danh sách thông tin người tham gia qua email do Bên A chỉ định.

Mọi rủi ro và quyền sở hữu, sử dụng đối với thông tin người tham gia được chuyển cho Bên A kể từ thời điểm danh sách đã được gửi thành công tới email của Bên A, Bên A có đại diện xác nhận đã nhận được email (hoặc hệ thống email của Bên B thông báo là đã gửi thành công, và phải có xác nhận của đại diện Bên A).

Bên A sẽ xác nhận số lượng người tham gia theo danh sách thông tin mà Bên B đã bàn giao cho Bên A để tiến hành Đối soát và ký kết Quyết toán.`,
    },
    {
      key: 'article-6',
      heading: 'ĐIỀU 6. THANH TOÁN',
      body: `PHÍ BÁN VÉ:
- Được tính sau khi đóng cổng đăng ký giải chạy hoặc theo từng đợt đối soát (tùy vào thỏa thuận của hai Bên).
- Bên A có trách nhiệm trả khoản Phí bán vé theo Điều 1 bằng cách cấn trừ trực tiếp vào Khoản bán vé sau khi kết thúc giải chạy hoặc theo từng đợt đối soát.

KHOẢN BÁN VÉ:

Bên B sẽ thực hiện thanh toán cho Bên A toàn bộ tiền thu được dựa theo báo cáo doanh thu trong Biên bản bàn giao/Quyết toán sau khi trừ đi phần phí dịch vụ mà Bên B được hưởng và/hoặc bất kỳ khoản tiền nào mà Bên A có nghĩa vụ phải thanh toán cho Bên B theo Thỏa Thuận này trong vòng 03 (ba) ngày kể từ ngày các Bên ký xác nhận báo cáo Doanh thu cho mỗi kỳ đối soát. Thông tin tài khoản thanh toán của Bên A được quy định tại phần đầu của Hợp đồng.

Bên A cam kết và đảm bảo rằng, Bên A sẽ thực hiện nộp bất kỳ và toàn bộ các khoản tiền thuế, phí, lệ phí có liên quan đến số tiền bán Vé nhận được từ Bên B theo đúng quy định của pháp luật Việt Nam.

Mỗi Bên sẽ phải chịu phạt nếu thanh toán trễ với mức lãi suất {paymentTerms.latePenaltyRate}{paymentTerms.latePenaltyUnit} cho mỗi ngày trên tổng số ngày thanh toán chậm tính trên tổng số tiền thanh toán chậm tại thời điểm thanh toán. Nếu quá thời hạn thanh toán 30 (ba mươi) ngày, thì Bên nhận thanh toán có quyền đơn phương chấm dứt Hợp đồng mà không cần thực hiện bất kỳ nghĩa vụ nào đối với Bên thanh toán. Ngoài ra, Bên nhận thanh toán có quyền phạt Bên thanh toán 8% trên tổng số tiền chậm thanh toán tại thời điểm thanh toán và yêu cầu Bên thanh toán phải thanh toán toàn bộ số tiền theo nghĩa vụ cũng như những thiệt hại phát sinh nếu có. Trừ trường hợp có thỏa thuận khác bằng văn bản được hai bên xác nhận.`,
    },
    {
      key: 'article-7',
      heading: 'ĐIỀU 7. HÓA ĐƠN',
      body: `Bên B sẽ thực hiện xuất hóa đơn tài chính hợp lệ cho Bên A đối với khoản tiền phí dịch vụ như đã nêu ở Điều 1 (Phí bán vé và Phí quản lý vận động viên).`,
    },
    {
      key: 'article-8',
      heading: 'ĐIỀU 8. NGHĨA VỤ VÀ TRÁCH NHIỆM CỦA MỖI BÊN',
      body: `Nghĩa vụ và Trách nhiệm của Bên A
- Bên A đảm bảo khách hàng đã mua vé của Bên B được hưởng đầy đủ các quyền lợi của người tham gia sự kiện và không phân biệt đối xử đối với các Khách Hàng khác của Bên A (trừ trường hợp Bên A dành cho các Khách Hàng mua Vé từ Bên B những tiện ích tốt hơn so với Vé thông thường khác) và/hoặc không yêu cầu Khách Hàng sử dụng Vé mua từ Bên B phải thanh toán thêm bất kỳ khoản chi phí nào khác. Trường hợp có bất kỳ Khách Hàng nào khiếu nại đến Bên B và có bằng chứng về việc vi phạm trên thì Bên B có quyền sử dụng khoản tiền sẽ chuyển cho Bên A để bồi thường cho Khách Hàng mà không cần sự đồng ý trước của Bên A;
- Được quyền yêu cầu Bên B thực hiện công việc đúng như quy định tại Điều 1 của Hợp đồng này;
- Cung cấp cho Bên B thông tin và lịch trình chi tiết về sự kiện do Bên A tổ chức;
- Chịu trách nhiệm thực hiện đúng với nội dung thông tin về sự kiện mà Bên A đã cung cấp đối với người tham gia và giải quyết các khiếu nại phát sinh liên quan đến các nội dung này;
- Thanh toán cho Bên B theo đúng như Điều 6;
- Thực hiện các quyền lợi của Bên B theo quy định tại Phụ lục 02 của Hợp đồng này (nếu có);
- Chỉ định người có thẩm quyền làm việc với Bên B theo Hợp Đồng này;
- Tiếp nhận Dữ liệu Cá Nhân được chuyển giao từ Bên B.

Nghĩa vụ và Trách nhiệm của Bên B
- Được quyền yêu cầu Bên A thực hiện công việc đúng như quy định của Hợp đồng này;
- Đăng thông tin về sự kiện do Bên A tổ chức lên website của Bên B theo đúng nội dung mà Bên A cung cấp;
- Cung cấp cho Bên A danh sách thông tin và số lượng người tham gia theo định kỳ (hai bên tự thỏa thuận thời gian bàn giao thông tin);
- Cung cấp cho Bên A dịch vụ kiểm soát vé tại Sự kiện yêu cầu; và được yêu cầu Bên A cung cấp các điều kiện cần thiết cho Bên B ở địa điểm sự kiện để thực hiện đổi vé, kiểm tra vé (ví dụ như bàn, ghế,…);
- Không chịu bất kỳ trách nhiệm nào đối với người tham gia (ngoại trừ liên quan đến việc thanh toán tiền vé do Bên B phân phối);
- Không có nghĩa vụ và trách nhiệm xuất hóa đơn tài chính cho toàn bộ vé bán ra theo yêu cầu của khách hàng;
- Thanh toán cho Bên A theo đúng như Điều 6;
- Thực hiện các quyền lợi của Bên A quy định tại Phụ lục 01 của Hợp đồng này (nếu có);
- Chỉ định người có thẩm quyền làm việc với Bên A theo Hợp Đồng này;
- Không được quyền chuyển giao việc thực hiện Hợp Đồng này cho một bên thứ ba bất kỳ trừ khi có sự đồng ý bằng văn bản của Bên A. Bên nhận chuyển giao phải là pháp nhân có đăng ký kinh doanh và đủ điều kiện để tiếp tục thực hiện Hợp Đồng này;
- Chịu trách nhiệm giải quyết các tranh chấp, bồi thường thiệt hại với bên khác ngoài Hợp đồng với Bên A nếu vi phạm các quy định tại Hợp đồng, hoặc phát sinh do lỗi của Bên B;
- Bảo đảm về tư cách pháp lý đủ điều kiện được cấp phép hoạt động bán vé trên cổng 5bib.com và cung cấp dịch vụ hợp pháp theo quy định của pháp luật cho Bên A. Chịu trách nhiệm giải quyết và đền bù thiệt hại do toàn bộ các nhầm lẫn hoặc sai sót về các thông tin liên quan đến việc bán vé (vé bán ra, người mua vé…) do lỗi của Bên B hoặc do lỗi của hệ thống bán vé;
- Chuyển giao Dữ Liệu Cá Nhân của người đăng ký cho Bên A.`,
    },
    {
      key: 'article-9',
      heading: 'ĐIỀU 9. CHẤM DỨT HỢP ĐỒNG',
      body: `Hợp đồng này có giá trị từ ngày ký và chỉ được chấm dứt theo một trong các trường hợp sau:
- Tất cả Vé hết hạn sử dụng được quy định tại Điều 1 của Hợp đồng này hoặc sau khi sự kiện kết thúc và hai bên hoàn tất Quyết toán và Thanh toán;
- Hai bên thỏa thuận chấm dứt Hợp đồng trước thời hạn;
- Một trong hai bên buộc phải giải thể, phá sản theo quyết định của Cơ quan Nhà nước có thẩm quyền;
- Một Bên vi phạm Thỏa Thuận này mà không khắc phục trong vòng năm (05) Ngày Làm Việc kể từ ngày nhận được thông báo/yêu cầu của Bên còn lại;
- Đến khi hai Bên làm Biên bản thanh lý để chấm dứt hợp đồng.`,
    },
    {
      key: 'article-10',
      heading: 'ĐIỀU 10. BẢO MẬT THÔNG TIN',
      body: `Bên B cam kết giữ bảo mật tuyệt đối tất cả các thông tin của Bên A mà Bên B có được trong quá trình thực hiện Hợp đồng này, bao gồm nhưng không giới hạn các thông tin chưa được công bố (gọi chung là "Thông tin bảo mật"). Bên B đồng thời cam kết và bảo đảm rằng, trừ trường hợp được sự đồng ý bằng văn bản của Bên A, Bên B các nhân viên/người lao động, cộng tác viên, đại diện khác của mình sẽ không sử dụng hoặc cung cấp cho bên thứ ba bất kỳ Thông tin bảo mật nào trong bất kỳ trường hợp nào và cho bất kỳ mục đích nào ngoài mục đích thực hiện Hợp đồng này. Nếu Bên B vi phạm các quy định nói trên, Bên A có quyền ngay lập tức chấm dứt Hợp đồng này và Bên B phải bồi thường cho Bên A mọi thiệt hại do việc vi phạm của mình gây ra, nếu có.

Điều khoản bảo mật này vẫn tiếp tục giữ nguyên hiệu lực sau khi Hợp đồng chấm dứt mà không có thời điểm giới hạn nào. Tuy nhiên, điều khoản bảo mật sẽ không được áp dụng cho những thông tin mà (i) đã được phổ biến và công khai, hoặc (ii) phải tiết lộ cho các cơ quan thẩm quyền theo quy định của pháp luật. Trong trường hợp (ii), Bên B phải thông báo trước cho Bên A bằng văn bản.

Các Bên cam kết sẽ tuân thủ các quy định pháp luật về bảo vệ dữ liệu cá nhân được quy định tại Nghị định 13/2023/NĐ-CP ngày 17/04/2023 (và các văn bản hướng dẫn, sửa đổi, bổ sung, thay thế khác (nếu có)) cùng các văn bản pháp luật có liên quan. Đồng thời, các Bên cam kết sẽ trao đổi, thương lượng và/hoặc đồng ý ký kết (các) văn bản, Phụ lục Hợp đồng để điều chỉnh các nội dung liên quan đến việc bảo vệ Dữ liệu cá nhân theo (các) đề xuất, yêu cầu từ Bên còn lại vào mọi thời điểm trong quá trình thực hiện Hợp đồng để đảm bảo tuân thủ quy định pháp luật. Trường hợp Bên nào không tuân thủ các cam kết này, được xem là Bên đó đã vi phạm Hợp đồng và phải chịu hoàn toàn trách nhiệm theo quy định cho các vi phạm do mình gây ra. Bên còn lại có quyền đơn phương chấm dứt Hợp Đồng và các Phụ lục Hợp Đồng ngay lập tức.

Để làm rõ, việc Hai Bên không hoàn thành việc giao kết các văn bản, Phụ lục trong thời hạn đã cam kết mà xuất phát từ lỗi của Một Bên thì được xem là hành vi vi phạm Hợp đồng của Bên đó. Khi đó, Bên còn lại có quyền được miễn trừ trách nhiệm.`,
    },
    {
      key: 'article-11',
      heading: 'ĐIỀU 11. GIẢI QUYẾT TRANH CHẤP HỢP ĐỒNG VÀ ĐIỀU KHOẢN CHUNG',
      body: `Giải quyết tranh chấp:

Trong quá trình thực hiện Hợp Đồng hai Bên cần chủ động thông báo cho nhau biết tiến độ thực hiện Hợp Đồng, nếu có vấn đề bất lợi phát sinh hoặc xảy ra tranh chấp, các Bên phải kịp thời thông báo bằng văn bản cho nhau biết và phải chủ động bàn bạc giải quyết trên cơ sở thương lượng, tôn trọng quyền và lợi ích hợp pháp của các Bên.

Trong quá trình thực hiện Hợp đồng này, nếu có bất kỳ tranh chấp, mâu thuẫn nào phát sinh từ hoặc liên quan đến Hợp đồng, Các Bên trước hết sẽ nỗ lực cùng nhau thương lượng, thảo luận giải quyết trên tinh thần đôi bên đều có lợi. Trường hợp Các Bên không thể giải quyết được các tranh chấp, mâu thuẫn đó trên tinh thần thiện chí trong vòng 30 (ba mươi) ngày kể từ khi một Bên đề cập vấn đề cho Bên kia bằng văn bản, Các Bên đồng ý rằng vụ việc, tranh chấp sẽ được giải quyết tại Tòa án nhân dân có thẩm quyền theo quy định của pháp luật.

Sự kiện bất khả kháng:

Sự Kiện Bất Khả Kháng là sự kiện vượt ra ngoài khả năng kiểm soát của các Bên, và không liên quan tới lỗi hoặc sự bất cẩn của bất kỳ Bên nào cũng như không thể thấy trước, không thể tránh được và không thể khắc phục được mặc dù đã áp dụng mọi biện pháp cần thiết và khả năng cho phép và làm cho Bên bị ảnh hưởng không thể thực hiện được bất kỳ nghĩa vụ hay trách nhiệm nào quy định tại Hợp đồng này. Các Sự Kiện Bất Khả Kháng bao gồm nhưng không giới hạn các sự kiện như: dịch bệnh, lũ lụt, hỏa hoạn, hạn hán, bão, động đất, các sự kiện xã hội như: biểu tình, bạo động, bạo loạn và chiến tranh (tuyên bố hoặc không tuyên bố); các hoạt động của Chính phủ, các trục trặc hệ thống mạng.

Một hoặc hai Bên gặp phải trường hợp Bất khả kháng không thể thực hiện được nghĩa vụ Hợp đồng thì được tạm ngưng thực hiện Hợp đồng mà không bị xem là vi phạm nghĩa vụ theo Hợp đồng khi đã thực hiện trách nhiệm thông báo bằng văn bản cho Bên còn lại biết trong vòng 03 (ba) ngày kể từ ngày xảy ra Sự Kiện Bất Khả Kháng. Nếu các tình huống do Sự Kiện Bất Khả Kháng gây ra kéo dài hơn 01 (một) tháng, Bên không bị ảnh hưởng có thể đơn phương chấm dứt Hợp đồng bằng cách gửi thông báo cho Bên bị ảnh hưởng và không yêu cầu các khoản phạt, bồi thường thiệt hại phát sinh.

Trường hợp có tổn thất vật chất thực tế phát sinh vì nguyên nhân Bất khả kháng, các Bên có thể thương lượng về việc chia sẻ tổn thất, nếu không thương lượng được thì giải quyết theo qui định của pháp luật.

Điều khoản chung:

Những vấn đề chưa được quy định trong Hợp Đồng này sẽ được hai Bên thống nhất áp dụng quy định của Pháp luật của Nước CHXHCN Việt Nam.

Trường hợp nếu có sự thay đổi, bổ sung thêm các điều khoản hay chi tiết nào đó thì hai Bên sẽ bàn bạc và được thể hiện vào biên bản ghi nhớ hoặc ký kết các phụ lục hợp đồng trước khi thực hiện.

Hợp đồng có hiệu lực kể từ ngày ký. Sau khi 02 Bên hoàn thành nghĩa vụ trong hợp đồng và sau 10 (mười) ngày nếu không có vướng mắc gì thì coi như hợp đồng đã tự động được thanh lý.

Hợp Đồng được lập thành hai (02) bản gốc, mỗi Bên giữ một (01) bản và có giá trị pháp lý như nhau.`,
    },
  ],
};

export function getDefaultArticles(type: ContractType): ArticleSection[] {
  return DEFAULT_TEMPLATES[type] || [];
}
