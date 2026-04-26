"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import {
  createContractTemplate,
  importDocxToHtml,
  validateContractTemplate,
  type PartyAConfig,
} from "@/lib/team-api";
import ContractPreview from "@/components/ContractPreview";

const ContractEditor = dynamic(() => import("@/components/ContractEditor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border bg-muted/20 p-8 text-sm text-muted-foreground">
      Đang tải trình soạn thảo...
    </div>
  ),
});

const BLANK_TEMPLATE = `<div style="font-family: Times New Roman, serif; font-size: 13pt; line-height: 1.5;">
<p style="text-align: center; font-weight: bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
<p style="text-align: center; font-weight: bold;">Độc lập - Tự do - Hạnh phúc</p>
<p style="text-align: center;">-----****-----</p>
<h2 style="text-align: center; margin-top: 24px;">HỢP ĐỒNG DỊCH VỤ</h2>
<p style="text-align: center;">(Số: {{contract_number}})</p>
<p>- Căn cứ vào Bộ luật dân sự số 91/2015/QH13 được Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam khóa XIII, kỳ họp thứ 10 thông qua ngày 24 tháng 11 năm 2015;</p>
<p>- Căn cứ vào khả năng nhu cầu của hai bên.</p>
<p>Hà Nội, ngày {{sign_date}} chúng tôi gồm:</p>

<p><strong>Bên A: {{party_a_company_name}}</strong></p>
<ul style="list-style: none; padding-left: 0;">
<li>- Địa chỉ: {{party_a_address}}</li>
<li>- Mã số thuế: {{party_a_tax_code}}</li>
<li>- Người đại diện: {{party_a_representative}} &nbsp;&nbsp;&nbsp; Chức vụ: {{party_a_position}}</li>
</ul>
<p><em>(Sau đây gọi là "Công ty")</em></p>

<p><strong>Bên B: Ông/Bà {{full_name}}</strong></p>
<ul style="list-style: none; padding-left: 0;">
<li>- Ngày sinh: {{birth_date}}</li>
<li>- Số CCCD: {{cccd_number}} &nbsp;&nbsp; Ngày cấp: {{cccd_issue_date}} &nbsp;&nbsp; Nơi cấp: {{cccd_issue_place}}</li>
<li>- Điện thoại: {{phone}}</li>
<li>- Email: {{email}}</li>
<li>- Địa chỉ: {{address}}</li>
<li>- Số tài khoản: {{bank_account_number}} - {{bank_name}}</li>
<li>- Mã số thuế: {{tax_code}}</li>
</ul>
<p><em>(Sau đây gọi là "Bên cung cấp")</em></p>

<p>Sau khi thỏa thuận hai bên thống nhất ký kết Hợp đồng cộng tác viên với những điều khoản như sau:</p>

<p><strong>Điều 1. Nội dung công việc của Bên B</strong></p>
<p>Bên B làm cộng tác viên cho Bên A để thực hiện các công việc: {{work_content}}</p>

<p><strong>Điều 2. Địa điểm và thời giờ làm việc</strong></p>
<p>1. Địa điểm: {{work_location}}</p>
<p>2. Thời giờ làm việc: {{work_period}}</p>

<p><strong>Điều 3. Trang bị dụng cụ làm việc, phương tiện đi lại, chỗ ngủ</strong></p>
<p>Bên A sẽ trang bị cho Bên B các dụng cụ và phương tiện cần thiết đi lại để phục vụ cho công việc theo nội dung hợp đồng này.</p>

<p><strong>Điều 4. Thù lao và quyền lợi của cộng tác viên</strong></p>
<p>- Bên B được hưởng thù lao khi hoàn thành công việc theo thỏa thuận tại Điều 1 với đơn giá {{unit_price}} VND ({{unit_price_words}}) (đã bao gồm thuế TNCN)</p>

<p><strong>Điều 5. Quyền và nghĩa vụ của Bên A</strong></p>
<p><em>1. Quyền của Bên A</em></p>
<p>- Bên A có quyền đơn phương chấm dứt hợp đồng cộng tác viên với Bên B khi Bên B vi phạm nghĩa vụ bảo mật thông tin của Bên A hoặc Bên B không đáp ứng được yêu cầu công việc.</p>
<p>- Bên A không chịu trách nhiệm về các khoản chi phí khác cho Bên B trong quá trình thực hiện công việc trong hợp đồng.</p>
<p><em>2. Nghĩa vụ của Bên A:</em></p>
<p>- Thanh toán đầy đủ, đúng hạn các chế độ và quyền lợi cho bên B theo nội dung của hợp đồng và theo từng phụ lục hợp đồng cụ thể (nếu có)</p>
<p>- Tạo điều kiện để Bên B thực hiện công việc được thuận lợi nhất.</p>
<p>- Bên A cấp thẻ CTV cho Bên B để phục vụ hoạt động giao tiếp với đối tác, khách hàng trong quá trình giao dịch (nếu có)</p>

<p><strong>Điều 6. Quyền và nghĩa vụ của Bên B</strong></p>
<p><em>1. Quyền của Bên B</em></p>
<p>- Bên B được sử dụng thẻ CTV và tư cách pháp nhân trong từng vụ việc cụ thể khi được sự đồng ý bằng văn bản của Bên A để thực hiện các nội dung công việc tại Điều 1 Hợp đồng này.</p>
<p>- Yêu cầu Bên A thanh toán đầy đủ và đúng hạn các chế độ thù lao và các quyền, lợi ích vật chất khác theo Hợp đồng này.</p>
<p>- Được yêu cầu Bên A cung cấp các thông tin liên quan đến việc để phục vụ cho công việc của Bên B nhưng phải sử dụng các thông tin theo quy định, đảm bảo uy tín và thương hiệu của Bên A.</p>
<p><em>2. Nghĩa vụ của Bên B</em></p>
<p>- Hoàn thành công việc như đã thỏa thuận tại Điều 1</p>
<p>- Tự chịu các khoản chi phí đi lại, điện thoại,... và các chi phí khác không ghi trong hợp đồng này liên quan đến công việc hợp tác với Bên A</p>
<p>- Tuân thủ triệt để các quy định về bảo mật thông tin liên quan đến vụ việc thực hiện</p>

<p><strong>Điều 7. Bảo mật thông tin</strong></p>
<p>- Trong thời gian thực hiện và khi chấm dứt hợp đồng này, Bên B cam kết giữ bí mật và không tiết lộ bất kỳ các thông tin, tài liệu nào cho bên thứ ba liên quan đến vụ việc nếu không được Bên A chấp nhận.</p>
<p>- Trường hợp Bên B vi phạm quy định về bảo mật thông tin, Bên A có quyền chấm dứt hợp đồng và yêu cầu Bên B bồi thường thiệt hại theo quy định của pháp luật.</p>

<p><strong>Điều 8. Điều khoản chung</strong></p>
<p>1. Trong quá trình thực hiện, nếu một trong hai bên đơn phương chấm dứt hợp đồng này thì phải thông báo cho bên kia bằng văn bản trước 15 ngày làm việc để hai bên cùng thống nhất giải quyết.</p>
<p>2. Trường hợp phát sinh tranh chấp trong quá trình thực hiện hợp đồng hai bên sẽ thương lượng và đàm phán trên tinh thần hợp tác và đảm bảo quyền lợi của cả hai bên. Nếu tranh chấp không giải quyết được bằng thương lượng, các bên sẽ yêu cầu tòa án có thẩm quyền giải quyết. Phán quyết của Tòa án có tính chất bắt buộc đối với các bên.</p>

<p><strong>Điều 9. Hiệu lực và thời hạn hợp đồng</strong></p>
<p>Thời hạn hợp đồng: {{work_period}}</p>
<p>Hai bên có thể gia hạn hợp đồng theo nhu cầu thực tế công việc phát sinh.</p>

<p><strong>Điều 10. Điều khoản thi hành</strong></p>
<p>- Hai bên cam kết thực hiện đúng các điều khoản đã thỏa thuận trong Hợp đồng này;</p>
<p>- Mọi sửa đổi, bổ sung liên quan đến nội dung hợp đồng này phải được hai bên thống nhất và thể hiện bằng văn bản;</p>
<p>- Hợp đồng này gồm 2 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ một bản và sẽ tự động thanh lý sau khi hai bên ký Biên bản nghiệm thu và không còn bất cứ mâu thuẫn nào.</p>

<table style="width: 100%; margin-top: 32px;">
<tr>
<td style="width: 50%; text-align: center; vertical-align: top;">
<p><strong>Đại diện Bên A</strong></p>
<p><em>(ký và ghi rõ họ tên)</em></p>
<p style="margin-top: 80px;"><strong>{{party_a_representative}}</strong></p>
</td>
<td style="width: 50%; text-align: center; vertical-align: top;">
<p><strong>Đại diện Bên B</strong></p>
<p><em>(ký và ghi rõ họ tên)</em></p>
<p style="margin-top: 80px;"><strong>{{full_name}}</strong></p>
</td>
</tr>
</table>
</div>`;

export default function NewContractTemplatePage(): React.ReactElement {
  const router = useRouter();
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [html, setHtml] = useState(BLANK_TEMPLATE);
  const [isActive, setIsActive] = useState(true);
  const [withSample, setWithSample] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [unknownVars, setUnknownVars] = useState<string[]>([]);
  const [partyA, setPartyA] = useState<PartyAConfig>({
    party_a_company_name: null,
    party_a_address: null,
    party_a_tax_code: null,
    party_a_representative: null,
    party_a_position: null,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/sign-in");
  }, [authLoading, isAuthenticated, router]);

  const runValidation = useCallback(
    async (nextHtml: string) => {
      if (!token) return;
      try {
        const { unknownVars } = await validateContractTemplate(
          token,
          nextHtml,
        );
        setUnknownVars(unknownVars);
      } catch {
        // Validation is advisory; network issues shouldn't block typing.
      }
    },
    [token],
  );

  // Run validation on mount + whenever editor HTML changes. Debounce to
  // avoid hammering the API on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => void runValidation(html), 600);
    return () => clearTimeout(handle);
  }, [html, runValidation]);

  async function handleImport(file: File): Promise<void> {
    if (!token) return;
    setImporting(true);
    try {
      const { content_html, warnings } = await importDocxToHtml(token, file);
      setHtml(content_html);
      if (warnings.length > 0) {
        toast.warning(`Import có ${warnings.length} cảnh báo`);
      } else {
        toast.success("Đã import DOCX");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (!token) return;
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên template");
      return;
    }
    if (html.trim().length < 10) {
      toast.error("Nội dung quá ngắn");
      return;
    }
    if (unknownVars.length > 0) {
      const ok = confirm(
        `Có ${unknownVars.length} biến không hợp lệ: ${unknownVars
          .map((v) => `{{${v}}}`)
          .join(", ")}\n\nVẫn lưu?`,
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const created = await createContractTemplate(token, {
        template_name: name,
        content_html: html,
        variables: extractVariables(html),
        is_active: isActive,
        ...partyA,
      });
      toast.success("Đã tạo template");
      router.replace(`/team-management/contract-templates/${created.id}/edit`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-96" />;

  const missingFullName = !html.includes("{{full_name}}");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/team-management/contract-templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Quay lại
          </Button>
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Template mới
        </h1>
        <div className="flex-1" />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          <Upload className="size-4" />
          {importing ? "Đang import..." : "Import DOCX"}
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
            }}
          />
        </label>
        <Button onClick={() => void handleSave()} disabled={saving}>
          <Save className="mr-2 size-4" />
          {saving ? "Đang lưu..." : "Lưu template"}
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label>Tên template *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Hợp đồng Crew HHTT 2026"
          />
        </div>
        <div className="flex items-end justify-between gap-3 rounded-md border px-3 py-2">
          <div>
            <Label className="text-xs">Đang dùng</Label>
            <p className="text-[11px] text-muted-foreground">
              Tắt để lưu trữ
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      {/* Party A — configurable legal entity */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Thông tin Bên A (Pháp nhân ký)</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Điền để dùng biến{" "}
            <code className="text-blue-700">{"{{party_a_company_name}}"}</code>,{" "}
            <code className="text-blue-700">{"{{party_a_representative}}"}</code>
            … trong nội dung hợp đồng. Mỗi template có thể dùng pháp nhân khác nhau.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="pa_company">Tên công ty</Label>
            <Input
              id="pa_company"
              placeholder="VD: CÔNG TY CỔ PHẦN 5BIB"
              value={partyA.party_a_company_name ?? ""}
              onChange={(e) => setPartyA({ ...partyA, party_a_company_name: e.target.value || null })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pa_address">Địa chỉ</Label>
            <Input
              id="pa_address"
              placeholder="VD: Tầng 9, Tòa nhà Hồ Gươm Plaza..."
              value={partyA.party_a_address ?? ""}
              onChange={(e) => setPartyA({ ...partyA, party_a_address: e.target.value || null })}
            />
          </div>
          <div>
            <Label htmlFor="pa_tax">Mã số thuế</Label>
            <Input
              id="pa_tax"
              placeholder="VD: 0110398986"
              value={partyA.party_a_tax_code ?? ""}
              onChange={(e) => setPartyA({ ...partyA, party_a_tax_code: e.target.value || null })}
            />
          </div>
          <div>
            <Label htmlFor="pa_rep">Người đại diện</Label>
            <Input
              id="pa_rep"
              placeholder="VD: Nguyễn Bình Minh"
              value={partyA.party_a_representative ?? ""}
              onChange={(e) => setPartyA({ ...partyA, party_a_representative: e.target.value || null })}
            />
          </div>
          <div>
            <Label htmlFor="pa_pos">Chức vụ</Label>
            <Input
              id="pa_pos"
              placeholder="VD: Giám đốc"
              value={partyA.party_a_position ?? ""}
              onChange={(e) => setPartyA({ ...partyA, party_a_position: e.target.value || null })}
            />
          </div>
        </div>
      </div>

      {unknownVars.length > 0 ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-900">
          <strong>Biến không hợp lệ:</strong>{" "}
          {unknownVars.map((v) => `{{${v}}}`).join(", ")}
          <span className="ml-2 text-xs opacity-70">
            (không nằm trong danh sách biến hỗ trợ — kiểm tra chính tả)
          </span>
        </div>
      ) : null}
      {missingFullName ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Cảnh báo: template thiếu biến <code>{"{{full_name}}"}</code> — hợp
          đồng sẽ không có họ tên người ký.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Nội dung</Label>
          </div>
          <ContractEditor initialContent={html} onChange={setHtml} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Xem trước</Label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Switch
                checked={withSample}
                onCheckedChange={setWithSample}
              />
              <span>Xem với dữ liệu mẫu</span>
            </label>
          </div>
          <ContractPreview
            contentHtml={html}
            withSampleData={withSample}
            sampleOverrides={partyAToOverrides(partyA)}
          />
        </div>
      </div>
    </div>
  );
}

function partyAToOverrides(cfg: PartyAConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (v != null && v !== "") out[k] = v;
  }
  return out;
}

function extractVariables(html: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) set.add(m[1].trim());
  return Array.from(set);
}
