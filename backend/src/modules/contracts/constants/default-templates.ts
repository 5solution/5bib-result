/**
 * F-024 Contract Management — Default Boilerplate Templates
 *
 * 🛑 PAUSE-CODE-NEW-B (legal-sensitive content):
 * Nội dung Điều 1-11 dưới đây EXTRACTED + SANITIZED từ 4 file mẫu DOCX
 * trong `.5bib-workflow/features/FEATURE-024-contract-management/templates-input/`:
 *   - [Timing] - 5BIB - Hợp đồng dịch vụ tính giờ ... .docx
 *   - [RACEKIT] - 5BIB - Hợp đồng vận hành racekit ... .docx
 *   - 14.4.26 [Hành Trình ...] - 5Sport - Hợp đồng vận hành (1).docx
 *   - [5BIB] Hợp đồng bán vé Giải chạy ... 2026.docx
 *
 * Coder KHÔNG tự bịa nội dung — tất cả article text trong file này ĐÃ extract
 * từ file mẫu Danny gửi 2026-05-11. Placeholder (vd: {partnerName}, {raceName})
 * thay thế cho hardcoded values trong file mẫu gốc.
 *
 * Danny phải REVIEW file này TRƯỚC khi áp vào generator (PAUSE-CODE-NEW-B).
 * Nếu cần sửa câu chữ, sửa trực tiếp trong file này (admin UI sẽ override
 * per-contract qua `templateOverrides.articles`).
 *
 * BR-CM-11 dual-mode: text trong file này = default boilerplate. Admin có thể
 * override từng article cho từng contract qua `templateOverrides.articles[key]`.
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

/** Boilerplate Điều 5-11 dùng chung cho TIMING / RACEKIT / OPERATIONS */
const SHARED_BOILERPLATE: ArticleSection[] = [
  {
    key: 'article-5',
    heading: 'ĐIỀU 5. CHẤM DỨT HỢP ĐỒNG',
    body: `Hợp Đồng có thể chấm dứt theo một trong các trường hợp sau:
- Hai Bên thỏa thuận chấm dứt Hợp Đồng này bằng văn bản.
- Các Bên đã hoàn thành đầy đủ các nghĩa vụ của mình theo Hợp Đồng này và Hợp Đồng được tự động thanh lý.
- Một Bên vi phạm nghĩa vụ theo thỏa thuận tại Hợp đồng này, đã được bên kia thông báo bằng văn bản/thư điện tử trong vòng 15 ngày kể từ ngày nhận được thông báo mà không sửa chữa, khắc phục được sẽ được xem là vi phạm hợp đồng. Bên gửi thông báo được quyền đơn phương chấm dứt hợp đồng.
- Một trong hai bên buộc phải giải thể, phá sản theo quyết định của Cơ quan Nhà nước có thẩm quyền.
Đơn phương chấm dứt trước thời hạn: Trong trường hợp một trong hai bên đơn phương chấm dứt Hợp Đồng này trước thời hạn mà không có lý do chính đáng, không thuộc các yếu tố bất khả kháng thì bên đơn phương chấm dứt hợp đồng sẽ phải thanh toán 100% phí Dịch vụ của hợp đồng cũng như bồi thường toàn bộ thiệt hại (nếu có) cho bên bị vi phạm.`,
  },
  {
    key: 'article-6',
    heading: 'ĐIỀU 6. BẤT KHẢ KHÁNG',
    body: `Sự kiện bất khả kháng được quy định bao gồm nhưng không giới hạn ở: luật pháp hiện tại hoặc tương lai thay đổi tác động đến các điều khoản hợp đồng, quy định hoặc mệnh lệnh từ các cấp có thẩm quyền can thiệp vào sự kiện hoặc hợp đồng, thiên tai, động đất, sóng thần, lũ lụt, mưa lớn, hỏa hoạn, dịch bệnh, tai nạn, vụ nổ, thương vong, tranh chấp lao động, bạo loạn, xáo trộn dân sự, xung đột chiến tranh hoặc vũ trang, chậm trễ của hãng chuyên chở công cộng hoặc hãng chuyên chở quốc tế.
Sự kiện bất khả kháng tác động lên một trong hai Bên hoặc cả hai Bên thì các nghĩa vụ của Bên bị tác động sẽ bị tạm ngừng thực hiện mà không bị coi là vi phạm Hợp đồng này.
Nếu Sự kiện bị hủy toàn bộ hoặc một phần do sự kiện bất khả kháng, cả hai Bên sẽ được giải phóng khỏi nghĩa vụ tương ứng của mình. Trong trường hợp này, hai Bên sẽ thỏa thuận trách nhiệm về tất cả các chi phí thực sự phát sinh đã gánh chịu cho đến ngày thông báo hủy.
Trong mọi trường hợp liên quan đến bất khả kháng, hai Bên thống nhất sẽ phối hợp chặt chẽ để đảm bảo kết quả Dịch vụ, khắc phục thiệt hại của nhau và đảm bảo giữ gìn uy tín của nhau trước cộng đồng.`,
  },
  {
    key: 'article-7',
    heading: 'ĐIỀU 7. BỒI THƯỜNG VÀ PHẠT VI PHẠM HỢP ĐỒNG',
    body: `Một trong Hai bên không thực hiện đúng các nghĩa vụ của mình được thỏa thuận tại Hợp Đồng này đều bị xem là vi phạm Hợp Đồng và phải chịu phạt là 8% giá trị phần bị vi phạm. Bên cạnh đó, Bên vi phạm còn phải chịu trách nhiệm bồi thường toàn bộ thiệt hại thực tế phát sinh mà Bên bị vi phạm phải gánh chịu, trừ trường hợp do Sự kiện bất khả kháng hoặc do lỗi của bên còn lại.
Bên vi phạm có nghĩa vụ nộp tiền phạt vi phạm và/hoặc bồi thường thiệt hại cho Bên kia trong thời hạn 10 (mười) ngày kể từ ngày nhận được Thông báo "Đề nghị thanh toán tiền phạt và/hoặc bồi thường thiệt hại". Trong trường hợp chậm nộp tiền phạt vi phạm và/hoặc bồi thường thiệt hại, Bên có nghĩa vụ thanh toán thêm tiền lãi suất chậm trả với mức {latePenaltyRate}{latePenaltyUnit}.
Trong mọi trường hợp, nếu có bất kỳ việc khiếu nại, tranh chấp phát sinh liên quan đến Hợp Đồng này, thì Các Bên đồng ý rằng một phần và/hoặc toàn bộ trách nhiệm của Bên B sẽ không vượt quá mức Phí dịch vụ mà Bên B nhận được theo Hợp Đồng này.`,
  },
  {
    key: 'article-8',
    heading: 'ĐIỀU 8. BẢO MẬT THÔNG TIN',
    body: `Các Bên thoả thuận và đảm bảo rằng mỗi Bên phải có trách nhiệm bảo mật và giữ kín tất cả các thông tin được cung cấp bởi một Bên đến Bên còn lại và theo đó các thông tin này sẽ không được tiết lộ cho bất kỳ bên thứ ba nào khác mà không có sự chấp thuận trước bằng văn bản của Bên cung cấp thông tin, ngoại trừ việc cung cấp thông tin nhằm mục đích thực hiện Hợp Đồng này hoặc theo lệnh, quyết định của cơ quan Nhà nước có thẩm quyền.
Mọi dữ liệu hình ảnh, video, kết quả vận động viên được tạo ra trong quá trình cung cấp dịch vụ cho sự kiện của Bên A là tài sản của Bên A. Bên B không được sử dụng cho mục đích thương mại hoặc công khai mà không có sự chấp thuận bằng văn bản của Bên A.
Nghĩa vụ bảo mật theo quy định này sẽ tiếp tục có hiệu lực vô thời hạn sau khi Hợp đồng kết thúc hoặc chấm dứt vì bất kỳ lý do gì.
Các Bên cam kết tuân thủ Nghị định 13/2023/NĐ-CP ngày 17/04/2023 về bảo vệ dữ liệu cá nhân và các văn bản pháp luật có liên quan.`,
  },
  {
    key: 'article-9',
    heading: 'ĐIỀU 9. GIẢI QUYẾT TRANH CHẤP HỢP ĐỒNG',
    body: `Trong quá trình thực hiện Hợp Đồng hai Bên cần chủ động thông báo cho nhau biết tiến độ thực hiện, nếu có vấn đề bất lợi phát sinh hoặc xảy ra tranh chấp, các Bên phải kịp thời thông báo bằng văn bản cho nhau biết và phải chủ động bàn bạc giải quyết trên cơ sở thương lượng, tôn trọng quyền và lợi ích hợp pháp của các Bên.
Trường hợp Các Bên không thể giải quyết được các tranh chấp trên tinh thần thiện chí trong vòng 30 (ba mươi) ngày kể từ khi một Bên đề cập vấn đề bằng văn bản, Các Bên đồng ý rằng vụ việc, tranh chấp sẽ được giải quyết tại Tòa án nhân dân có thẩm quyền theo quy định của pháp luật Việt Nam.`,
  },
  {
    key: 'article-10',
    heading: 'ĐIỀU 10. ĐIỀU KHOẢN CHUNG',
    body: `Hợp Đồng này và những phụ lục kèm theo tạo thành một chỉnh thể thống nhất, không tách rời và thay thế tất cả thỏa thuận trước đây bằng miệng hoặc bằng văn bản giữa các Bên.
Mọi sửa đổi, bổ sung hoặc hiệu chỉnh đối với Hợp Đồng này chỉ có giá trị khi được Các Bên lập thành văn bản.
Các Bên cam kết thực hiện đúng và đầy đủ các quyền và nghĩa vụ của mình quy định tại Hợp đồng này và các Phụ lục kèm theo (nếu có).
Mỗi Bên chịu trách nhiệm thanh toán nghĩa vụ thuế của mỗi bên phát sinh từ giao dịch theo Hợp đồng này.
Hợp Đồng này được điều chỉnh và giải thích phù hợp với pháp luật Việt Nam.`,
  },
  {
    key: 'article-11',
    heading: 'ĐIỀU 11. HIỆU LỰC HỢP ĐỒNG',
    body: `Hợp Đồng này có hiệu lực kể từ ngày ký và được làm thành 02 (hai) bản gốc bằng tiếng Việt có giá trị pháp lý như nhau. Mỗi Bên giữ 01 (một) bản để thực hiện.
Các Bên thống nhất rằng trong vòng 07 ngày kể từ ngày Các Bên hoàn thành các nghĩa vụ và/hoặc kết thúc thời hạn theo quy định tại Hợp Đồng này mà không có bất kỳ khiếu nại, tranh chấp của một trong Các Bên hoặc Hai Bên thì Hợp Đồng này được tự động thanh lý.`,
  },
];

/** Default articles cho từng contract type (Điều 1-4 type-specific + 5-11 shared) */
export const DEFAULT_TEMPLATES: Record<ContractType, ArticleSection[]> = {
  TIMING: [
    {
      key: 'article-1',
      heading: 'ĐIỀU 1. ĐỐI TƯỢNG VÀ PHẠM VI HỢP ĐỒNG',
      body: `Bên B sẽ cung cấp dịch vụ ghi nhận thành tích thi đấu, còn được gọi là "Dịch vụ tính giờ" (sau đây gọi tắt là "Dịch vụ") cho Bên A tại sự kiện {raceName} do Bên A tổ chức. Thành tích được tính dựa trên chip tính giờ gắn đằng sau số đeo trên mỗi vận động viên tham gia sự kiện của Bên A, tính chính xác đến phần trăm giây.
Bên B công bố kết quả chung của toàn bộ người tham gia trên website của Bên B (trang web: https://5bib.com).
Bên B cam kết đảm bảo việc ghi nhận kết quả chính xác tối thiểu cho 98% tổng số vận động viên tham gia sự kiện, trừ trường hợp bất khả kháng được quy định tại Hợp đồng.
Chi tiết dịch vụ và chi phí hạng mục từng phần cấu thành dịch vụ được đính kèm Phụ lục của Hợp đồng như một phần không thể tách rời.`,
    },
    {
      key: 'article-2',
      heading: 'ĐIỀU 2. GIÁ TRỊ HỢP ĐỒNG, PHƯƠNG THỨC THANH TOÁN',
      body: `Hợp đồng này là một gói dịch vụ có giá trị: {totalAmount} VND, đã bao gồm VAT ({vatRate}%). (Bằng chữ: {totalAmountInWords}).
Chi tiết các hạng mục đính kèm phụ lục của hợp đồng này, được thanh toán theo nghiệm thu phát sinh thực tế.
Hợp đồng được thanh toán chia làm 02 (hai) lần:
- Lần 1 thanh toán trước {advancePercentage}% (tương đương {advanceAmount} VND) theo giá trị hợp đồng, trong vòng 05 (năm) ngày sau khi hai Bên ký kết Hợp đồng.
- Lần 2 thanh toán toàn bộ phần còn lại theo nghiệm thu cộng với giá trị VAT theo quy định tại thời điểm thanh toán, thời điểm thanh toán không muộn quá 30 ngày làm việc kể từ khi ký nghiệm thu hợp đồng.
Việc chậm trễ thanh toán sẽ được tính lãi suất {latePenaltyRate}{latePenaltyUnit} trên khoản nợ phải trả.`,
    },
    {
      key: 'article-3',
      heading: 'ĐIỀU 3. HỆ THỐNG LIÊN HỆ VÀ TRAO ĐỔI THÔNG TIN',
      body: `Trừ khi có thỏa thuận khác bằng văn bản, mọi thông báo, tài liệu, yêu cầu hoặc trao đổi liên quan đến Hợp đồng phải được thực hiện bằng văn bản và gửi qua: thư chuyển phát bảo đảm, email từ địa chỉ người đại diện, hoặc văn bản trực tiếp có chữ ký xác nhận.
Mỗi Bên có trách nhiệm thông báo kịp thời và chính thức bằng văn bản hoặc email về bất kỳ thay đổi nào liên quan đến thông tin liên hệ.
Mỗi Bên sẽ chỉ định ít nhất một đầu mối liên hệ chính thức để phối hợp triển khai công việc liên quan đến hợp đồng.`,
    },
    {
      key: 'article-4',
      heading: 'ĐIỀU 4. QUYỀN LỢI VÀ TRÁCH NHIỆM CỦA CÁC BÊN',
      body: `Bên A có trách nhiệm: cung cấp tài liệu mô tả sự kiện, sơ đồ đường chạy, vị trí thảm tính giờ; cung cấp danh sách vận động viên đúng mẫu; cung cấp mẫu chứng nhận kết quả; cung cấp mẫu thiết kế bib trước ít nhất 21 ngày; đảm bảo điều kiện triển khai cho Bên B (cọc tiêu, hàng rào, lều có mái che, quạt, ổ điện tại khu vực đích).
Bên B có trách nhiệm: cung cấp đầy đủ, đúng hạn thiết bị, chip, vật tư, nhân sự có chuyên môn phù hợp; chủ động kiểm tra và nghiệm thu hệ thống thiết bị ít nhất 12 giờ trước khi sự kiện diễn ra; cung cấp báo cáo tổng hợp kết quả trong vòng 05 ngày làm việc sau sự kiện; bảo mật toàn bộ dữ liệu cá nhân của vận động viên.`,
    },
    ...SHARED_BOILERPLATE,
  ],
  RACEKIT: [
    {
      key: 'article-1',
      heading: 'ĐIỀU 1. ĐỐI TƯỢNG VÀ PHẠM VI HỢP ĐỒNG',
      body: `Bên B sẽ cung cấp dịch vụ vận hành racekit (phát gói chạy cho vận động viên) cho Bên A tại sự kiện {raceName} do Bên A tổ chức.
Phạm vi dịch vụ bao gồm: thiết bị phát racekit (iPad, laptop), nhân sự vận hành quầy phát racekit, quy trình kiểm tra BIB và phát gói chạy cho vận động viên.
Chi tiết dịch vụ và chi phí hạng mục được đính kèm Phụ lục của Hợp đồng như một phần không thể tách rời.`,
    },
    {
      key: 'article-2',
      heading: 'ĐIỀU 2. GIÁ TRỊ HỢP ĐỒNG, PHƯƠNG THỨC THANH TOÁN',
      body: `Hợp đồng này có giá trị: {totalAmount} VND, đã bao gồm VAT ({vatRate}%). (Bằng chữ: {totalAmountInWords}).
Hợp đồng được thanh toán chia làm 02 (hai) lần:
- Lần 1 thanh toán trước {advancePercentage}% (tương đương {advanceAmount} VND) trong vòng 05 (năm) ngày sau khi ký kết.
- Lần 2 thanh toán phần còn lại trong vòng 30 ngày làm việc kể từ khi ký nghiệm thu.
Việc chậm trễ thanh toán sẽ được tính lãi suất {latePenaltyRate}{latePenaltyUnit} trên khoản nợ phải trả.`,
    },
    {
      key: 'article-3',
      heading: 'ĐIỀU 3. HỆ THỐNG LIÊN HỆ VÀ TRAO ĐỔI THÔNG TIN',
      body: `Trừ khi có thỏa thuận khác bằng văn bản, mọi thông báo phải được thực hiện bằng văn bản qua thư chuyển phát bảo đảm, email từ người đại diện, hoặc văn bản trực tiếp có ký xác nhận.
Mỗi Bên chỉ định ít nhất một đầu mối liên hệ chính thức để phối hợp triển khai công việc.`,
    },
    {
      key: 'article-4',
      heading: 'ĐIỀU 4. QUYỀN LỢI VÀ TRÁCH NHIỆM CỦA CÁC BÊN',
      body: `Bên A: cung cấp danh sách vận động viên + thông tin gói chạy đúng mẫu, đúng hạn; cung cấp địa điểm + điều kiện vận hành quầy racekit (bàn, ghế, điện, mạng); thực hiện đầy đủ nghĩa vụ thanh toán theo tiến độ.
Bên B: cung cấp đầy đủ thiết bị, vật tư, nhân sự có chuyên môn phù hợp; vận hành quầy racekit theo quy trình thống nhất; phối hợp xử lý sự cố phát sinh; bảo mật dữ liệu vận động viên.`,
    },
    ...SHARED_BOILERPLATE,
  ],
  OPERATIONS: [
    {
      key: 'article-1',
      heading: 'ĐIỀU 1. ĐỐI TƯỢNG VÀ PHẠM VI HỢP ĐỒNG',
      body: `Bên B sẽ cung cấp dịch vụ vận hành tổng thể giải chạy {raceName} cho Bên A, bao gồm các hạng mục: vận hành đường chạy, cổng start/finish, trạm y tế, trạm tiếp nước, nhân sự vận hành, an ninh sự kiện, và các dịch vụ liên quan khác.
Chi tiết phạm vi dịch vụ và chi phí từng hạng mục được đính kèm Phụ lục của Hợp đồng như một phần không thể tách rời.`,
    },
    {
      key: 'article-2',
      heading: 'ĐIỀU 2. GIÁ TRỊ HỢP ĐỒNG, PHƯƠNG THỨC THANH TOÁN',
      body: `Hợp đồng này có giá trị: {totalAmount} VND, đã bao gồm VAT ({vatRate}%). (Bằng chữ: {totalAmountInWords}).
Hợp đồng được thanh toán chia làm 02 (hai) lần:
- Lần 1 thanh toán trước {advancePercentage}% (tương đương {advanceAmount} VND) trong vòng 05 (năm) ngày sau khi ký kết.
- Lần 2 thanh toán phần còn lại trong vòng 30 ngày làm việc kể từ khi ký nghiệm thu.
Việc chậm trễ thanh toán sẽ được tính lãi suất {latePenaltyRate}{latePenaltyUnit} trên khoản nợ phải trả.`,
    },
    {
      key: 'article-3',
      heading: 'ĐIỀU 3. HỆ THỐNG LIÊN HỆ VÀ TRAO ĐỔI THÔNG TIN',
      body: `Mọi thông báo phải được thực hiện bằng văn bản qua thư chuyển phát bảo đảm, email từ người đại diện, hoặc văn bản trực tiếp có ký xác nhận.
Mỗi Bên chỉ định ít nhất một đầu mối liên hệ chính thức để phối hợp triển khai công việc.`,
    },
    {
      key: 'article-4',
      heading: 'ĐIỀU 4. QUYỀN LỢI VÀ TRÁCH NHIỆM CỦA CÁC BÊN',
      body: `Bên A: cung cấp đầy đủ thông tin sự kiện + giấy phép pháp lý liên quan; phối hợp với cơ quan chức năng địa phương; thực hiện đầy đủ nghĩa vụ thanh toán theo tiến độ.
Bên B: cung cấp đầy đủ nhân sự, thiết bị, vật tư theo phụ lục; vận hành sự kiện theo quy trình thống nhất; tự trang bị bảo hiểm cho thiết bị và nhân sự; chịu trách nhiệm an toàn cho khu vực do mình vận hành; bảo mật thông tin sự kiện.`,
    },
    ...SHARED_BOILERPLATE,
  ],
  TICKET_SALES: [
    {
      key: 'article-1',
      heading: 'ĐIỀU 1. ĐỐI TƯỢNG VÀ PHẠM VI HỢP ĐỒNG',
      body: `Bên A đồng ý ủy quyền cho Bên B thực hiện dịch vụ bán vé (BIB) cho sự kiện {raceName} do Bên A tổ chức, thông qua nền tảng 5BIB (https://5bib.com).
Phạm vi dịch vụ bao gồm: tạo trang đăng ký sự kiện, xử lý thanh toán, quản lý danh sách vận động viên, gửi xác nhận đăng ký, hỗ trợ kỹ thuật cho vận động viên trong quá trình đăng ký.`,
    },
    {
      key: 'article-2',
      heading: 'ĐIỀU 2. PHÍ DỊCH VỤ VÀ PHƯƠNG THỨC THANH TOÁN',
      body: `Phí dịch vụ Bên A trả cho Bên B được tính theo mô hình chia sẻ doanh thu (revenue-share):
- Phí phần trăm: {feePercentage}% trên tổng doanh thu vé bán được.
- Phí trên đầu vận động viên: {feePerAthlete} VND/vận động viên đăng ký thành công.
Số lượng vận động viên ước tính: {estimatedAthletes} người.
Bên B sẽ giữ lại phần phí dịch vụ và chuyển khoản phần doanh thu còn lại cho Bên A theo lịch quyết toán đã thống nhất.
Việc chậm trễ thanh toán sẽ được tính lãi suất {latePenaltyRate}{latePenaltyUnit} trên khoản nợ phải trả.`,
    },
    {
      key: 'article-3',
      heading: 'ĐIỀU 3. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A',
      body: `Bên A có quyền: yêu cầu Bên B cung cấp báo cáo bán vé định kỳ; yêu cầu hoàn trả doanh thu vé theo lịch quyết toán; truy cập danh sách vận động viên đầy đủ phục vụ tổ chức sự kiện.
Bên A có nghĩa vụ: cung cấp đầy đủ thông tin sự kiện (tên, mô tả, ngày tổ chức, địa điểm, hạng mục, giá vé, điều kiện đăng ký) cho Bên B; thông báo kịp thời mọi thay đổi liên quan đến sự kiện; thực hiện đầy đủ nghĩa vụ tổ chức sự kiện cho vận động viên đã đăng ký.`,
    },
    {
      key: 'article-4',
      heading: 'ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B',
      body: `Bên B có quyền: thu phí dịch vụ theo Điều 2; sử dụng dữ liệu giao dịch (không bao gồm dữ liệu cá nhân nhạy cảm) cho mục đích phân tích và cải thiện dịch vụ.
Bên B có nghĩa vụ: cung cấp nền tảng đăng ký ổn định, bảo mật, đáp ứng SLA 99.9% uptime trong giai đoạn mở bán vé; bảo mật dữ liệu cá nhân vận động viên theo Nghị định 13/2023/NĐ-CP; quyết toán doanh thu cho Bên A đúng lịch; hỗ trợ kỹ thuật cho vận động viên gặp khó khăn khi đăng ký.`,
    },
    ...SHARED_BOILERPLATE,
  ],
};

export function getDefaultArticles(type: ContractType): ArticleSection[] {
  return DEFAULT_TEMPLATES[type] || [];
}
