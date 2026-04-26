"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import {
  createAcceptanceTemplate,
  type PartyAConfig,
} from "@/lib/team-api";
import ContractPreview from "@/components/ContractPreview";
import { type VariableGroup } from "@/components/ContractEditor";

const ContractEditor = dynamic(() => import("@/components/ContractEditor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border bg-muted/20 p-8 text-sm text-muted-foreground">
      Đang tải trình soạn thảo...
    </div>
  ),
});

/** Variable groups for Biên bản nghiệm thu templates. */
export const ACCEPTANCE_VARIABLE_GROUPS: VariableGroup[] = [
  {
    label: "Nghiệm thu",
    items: [
      { key: "contract_number",        hint: "Số hợp đồng (từ HĐ đã ký)" },
      { key: "sign_date",              hint: "Ngày ký hợp đồng" },
      { key: "acceptance_date",        hint: "Ngày nghiệm thu" },
      { key: "acceptance_value",       hint: "Giá trị nghiệm thu (số, VND)" },
      { key: "acceptance_value_words", hint: "Giá trị bằng chữ tiếng Việt" },
      { key: "signature_image",        hint: "Chữ ký Bên B (data URL PNG)" },
    ],
  },
  {
    label: "Bên A (pháp nhân ký)",
    items: [
      { key: "party_a_company_name",   hint: "Tên công ty Bên A" },
      { key: "party_a_address",        hint: "Địa chỉ Bên A" },
      { key: "party_a_tax_code",       hint: "Mã số thuế Bên A" },
      { key: "party_a_representative", hint: "Người đại diện Bên A" },
      { key: "party_a_position",       hint: "Chức vụ người đại diện" },
    ],
  },
  {
    label: "Thông tin cá nhân (Bên B)",
    items: [
      { key: "full_name",           hint: "Họ tên đầy đủ" },
      { key: "birth_date",          hint: "Ngày sinh (DD/MM/YYYY)" },
      { key: "cccd_number",         hint: "Số CCCD" },
      { key: "cccd_issue_date",     hint: "Ngày cấp CCCD" },
      { key: "cccd_issue_place",    hint: "Nơi cấp CCCD" },
      { key: "phone",               hint: "Số điện thoại" },
      { key: "email",               hint: "Email" },
      { key: "address",             hint: "Địa chỉ thường trú" },
      { key: "bank_account_number", hint: "Số tài khoản ngân hàng" },
      { key: "bank_name",           hint: "Tên ngân hàng" },
      { key: "tax_code",            hint: "Mã số thuế (= số CCCD cá nhân)" },
    ],
  },
  {
    label: "Sự kiện & vai trò",
    items: [
      { key: "event_name",         hint: "Tên sự kiện" },
      { key: "work_content",       hint: "Nội dung công việc" },
      { key: "work_location",      hint: "Địa điểm làm việc" },
      { key: "work_period",        hint: "Thời gian làm việc (ngày bắt đầu – kết thúc)" },
      { key: "unit_price",         hint: "Đơn giá / ngày (số)" },
      { key: "unit_price_words",   hint: "Đơn giá bằng chữ" },
    ],
  },
];

const BLANK_ACCEPTANCE_TEMPLATE = `<div style="font-family: Times New Roman, serif; font-size: 13pt; line-height: 1.5;">
<p style="text-align: center; font-weight: bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
<p style="text-align: center; font-weight: bold;">Độc lập - Tự do - Hạnh phúc</p>
<p style="text-align: center;">-----****-----</p>
<h2 style="text-align: center; margin-top: 24px;">BIÊN BẢN NGHIỆM THU HỢP ĐỒNG CỘNG TÁC VIÊN</h2>
<p style="text-align: center;">(Số: {{contract_number}})</p>
<p>- Căn cứ vào Hợp đồng cộng tác viên số {{contract_number}}</p>
<p>Hà Nội, ngày {{acceptance_date}} chúng tôi gồm:</p>

<p><strong>Bên A: {{party_a_company_name}}</strong></p>
<ul style="list-style: none; padding-left: 0;">
<li>- Địa chỉ: {{party_a_address}}</li>
<li>- Mã số thuế: {{party_a_tax_code}}</li>
<li>- Người đại diện: Ông {{party_a_representative}} &nbsp;&nbsp;&nbsp; Chức vụ: {{party_a_position}}</li>
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

<p>Hai bên thống nhất nghiệm thu hợp đồng số {{contract_number}} với nội dung sau:</p>

<p><strong>ĐIỀU 1: NỘI DUNG NGHIỆM THU</strong></p>
<p>Bên Cung cấp dịch vụ đã thực hiện đúng và đầy đủ các hạng mục công việc: {{work_content}}</p>

<p><strong>ĐIỀU 2: GIÁ TRỊ NGHIỆM THU</strong></p>
<p>Tổng giá trị nghiệm thu: {{acceptance_value}} VND (đã bao gồm thuế TNCN)</p>
<p>Bằng chữ: {{acceptance_value_words}}</p>

<p><strong>ĐIỀU 3: KẾT LUẬN</strong></p>
<p>Hai bên thống nhất ký kết Biên bản nghiệm thu số {{contract_number}} ngày {{acceptance_date}}.</p>
<p>Biên bản này được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>

<table style="width:100%; margin-top: 32px;">
<tr>
  <td style="width:50%; text-align:center; vertical-align:top;">
    <p><strong>ĐẠI DIỆN BÊN A</strong></p>
    <p><em>(ký và ghi rõ họ tên)</em></p>
    <p style="margin-top: 80px;"><strong>{{party_a_representative}}</strong></p>
  </td>
  <td style="width:50%; text-align:center; vertical-align:top;">
    <p><strong>ĐẠI DIỆN BÊN B</strong></p>
    <p><em>(ký và ghi rõ họ tên)</em></p>
    <img src="{{signature_image}}" alt="Chữ ký" style="display:block;margin:16px auto 0;max-width:220px;max-height:90px"/>
    <p><strong>{{full_name}}</strong></p>
  </td>
</tr>
</table>
</div>`;

function partyAToOverrides(cfg: PartyAConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (v != null && v !== "") out[k] = v;
  }
  return out;
}

export default function NewAcceptanceTemplatePage(): React.ReactElement {
  const router = useRouter();
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [html, setHtml] = useState(BLANK_ACCEPTANCE_TEMPLATE);
  const [isDefault, setIsDefault] = useState(false);
  const [withSample, setWithSample] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const handleSave = useCallback(async () => {
    if (!token) return;
    if (!name.trim()) {
      toast.error("Tên template bắt buộc");
      return;
    }
    if (html.trim().length < 20) {
      toast.error("Nội dung quá ngắn");
      return;
    }
    setSaving(true);
    try {
      await createAcceptanceTemplate(token, {
        template_name: name.trim(),
        content_html: html,
        variables: ACCEPTANCE_VARIABLE_GROUPS.flatMap((g) =>
          g.items.map((i) => i.key),
        ),
        is_default: isDefault,
        ...partyA,
      });
      toast.success("Đã tạo mẫu biên bản nghiệm thu");
      router.push("/team-management/contract-templates?tab=acceptance");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [token, name, html, isDefault, router]);

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-0">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-3">
        <Link href="/team-management/contract-templates?tab=acceptance">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Quay lại
          </Button>
        </Link>
        <h1 className="font-display text-xl font-bold">
          Mẫu biên bản nghiệm thu mới
        </h1>
        <div className="flex-1" />

        {/* Template name */}
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên template (bắt buộc)"
          className="w-64"
        />

        {/* is_default toggle */}
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Label className="text-sm">Mặc định</Label>
          <Switch
            checked={isDefault}
            onCheckedChange={setIsDefault}
            title="Đặt làm template mặc định cho tất cả sự kiện chưa có template riêng"
          />
        </div>

        {/* Preview toggle */}
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Label className="text-sm">Dữ liệu mẫu</Label>
          <Switch checked={withSample} onCheckedChange={setWithSample} />
        </div>

        <Button onClick={() => void handleSave()} disabled={saving}>
          <Save className="mr-2 size-4" />
          {saving ? "Đang lưu..." : "Lưu template"}
        </Button>
      </div>

      {/* Editor + Preview split */}
      <div className="flex min-h-0 flex-1">
        <div className="w-1/2 overflow-y-auto border-r">
          {/* Party A config — collapsible section above editor */}
          <div className="border-b bg-card/50 px-4 py-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Thông tin Bên A (pháp nhân ký)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Tên công ty</Label>
                <Input
                  placeholder="VD: CÔNG TY CỔ PHẦN 5BIB"
                  value={partyA.party_a_company_name ?? ""}
                  onChange={(e) => setPartyA({ ...partyA, party_a_company_name: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Địa chỉ</Label>
                <Input
                  placeholder="Địa chỉ công ty"
                  value={partyA.party_a_address ?? ""}
                  onChange={(e) => setPartyA({ ...partyA, party_a_address: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Mã số thuế</Label>
                <Input
                  placeholder="VD: 0110398986"
                  value={partyA.party_a_tax_code ?? ""}
                  onChange={(e) => setPartyA({ ...partyA, party_a_tax_code: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Người đại diện</Label>
                <Input
                  placeholder="VD: Nguyễn Bình Minh"
                  value={partyA.party_a_representative ?? ""}
                  onChange={(e) => setPartyA({ ...partyA, party_a_representative: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Chức vụ</Label>
                <Input
                  placeholder="VD: Giám đốc"
                  value={partyA.party_a_position ?? ""}
                  onChange={(e) => setPartyA({ ...partyA, party_a_position: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
          <ContractEditor
            initialContent={html}
            onChange={setHtml}
            placeholder="Nhập nội dung biên bản nghiệm thu..."
            variableGroups={ACCEPTANCE_VARIABLE_GROUPS}
          />
        </div>
        <div className="w-1/2 overflow-y-auto p-4">
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
