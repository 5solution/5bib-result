"use client";

/**
 * F-024 Template management page (BR-CM-11).
 *
 * Card per contract type. Click card → expand inline rich editor (Textarea cho
 * mỗi article — KHÔNG tiptap để giữ Phase 2B scope nhỏ + match docxtemplater
 * paragraph rendering). Variable list (read-only) hiển thị các placeholder
 * available.
 *
 * Phase 2B simplification: dùng `<Textarea>` thay vì rich editor. Editor xịn
 * (TipTap) là Phase 3 nếu cần.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  getContractTemplate,
  updateContractTemplate,
  type ContractTemplateView,
  type ContractType,
} from "@/lib/contracts-api";

const TYPES: { id: ContractType; label: string }[] = [
  { id: "TIMING", label: "Tính giờ" },
  { id: "RACEKIT", label: "Racekit" },
  { id: "OPERATIONS", label: "Vận hành" },
  { id: "TICKET_SALES", label: "Bán vé" },
];

const COMMON_VARIABLES: { key: string; desc: string }[] = [
  { key: "{client.entityName}", desc: "Tên đối tác" },
  { key: "{client.taxId}", desc: "MST đối tác" },
  { key: "{client.representative}", desc: "Đại diện đối tác" },
  { key: "{provider.entityName}", desc: "Tên đơn vị cung cấp dịch vụ" },
  { key: "{provider.bankAccount}", desc: "Số TK provider" },
  { key: "{provider.bankName}", desc: "Tên ngân hàng provider" },
  { key: "{contractNumber}", desc: "Số hợp đồng" },
  { key: "{signDay}/{signMonth}/{signYear}", desc: "Ngày ký" },
  { key: "{raceName}", desc: "Tên giải" },
  { key: "{raceDate}", desc: "Ngày tổ chức" },
  { key: "{subtotal}", desc: "Cộng (chưa VAT)" },
  { key: "{vatRate}", desc: "% VAT (default 8)" },
  { key: "{vatAmount}", desc: "Tiền VAT" },
  { key: "{totalAmount}", desc: "Tổng (đã VAT)" },
  { key: "{totalAmountInWords}", desc: "Số tiền bằng chữ" },
  { key: "{paymentTerms.advanceAmount}", desc: "Tạm ứng (VND)" },
  { key: "{paymentTerms.latePenaltyRate}", desc: "% phạt chậm" },
];

export default function TemplatesPage() {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mẫu hợp đồng</h1>
        <p className="text-sm text-[var(--text-muted,#78716C)]">
          Chỉnh sửa nội dung các điều khoản cho từng loại hợp đồng. Placeholder
          dạng <code className="rounded bg-[#F3F0EB] px-1">{`{varName}`}</code>{" "}
          sẽ được thay thế khi render DOCX.
        </p>
      </div>
      <Tabs defaultValue="TIMING">
        <TabsList>
          {TYPES.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TYPES.map((t) => (
          <TabsContent key={t.id} value={t.id}>
            <TemplateEditor type={t.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function TemplateEditor({ type }: { type: ContractType }) {
  const [tpl, setTpl] = useState<ContractTemplateView | null>(null);
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getContractTemplate(type)
      .then((t) => {
        setTpl(t);
        setArticles(t.articles ?? {});
      })
      .catch((err) => toast.error(`Lỗi: ${err.message}`))
      .finally(() => setLoading(false));
  }, [type]);

  async function save() {
    setSaving(true);
    try {
      await updateContractTemplate(type, articles);
      toast.success("Đã lưu mẫu");
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (!confirm("Khôi phục về mẫu mặc định? Tất cả thay đổi sẽ mất.")) return;
    setArticles({});
    toast.success("Đã reset. Bấm Lưu để áp dụng.");
  }

  if (loading) return <div className="p-4">Đang tải...</div>;

  const articleKeys = Array.from(
    new Set([
      ...Object.keys(articles),
      ...(tpl?.variables?.map((v) => v.key) ?? []),
      ...Array.from({ length: 11 }, (_, i) => `article-${i + 1}`),
    ]),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4 rounded-lg border border-[var(--border,#E7E2D9)] bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Override các Điều (để trống = dùng mặc định trong code)
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              Reset
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
        {articleKeys.map((k) => (
          <div key={k}>
            <label
              htmlFor={`tpl-${k}`}
              className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted,#78716C)]"
            >
              {k}
            </label>
            <Textarea
              id={`tpl-${k}`}
              value={articles[k] ?? ""}
              onChange={(e) =>
                setArticles((a) => ({ ...a, [k]: e.target.value }))
              }
              placeholder="(dùng nội dung mặc định)"
              rows={6}
              className="font-mono text-xs"
            />
          </div>
        ))}
      </div>
      <aside className="rounded-lg border border-[var(--border,#E7E2D9)] bg-[#FAF8F5] p-4">
        <h3 className="mb-3 text-sm font-semibold">Placeholder hỗ trợ</h3>
        <ul className="space-y-1.5 font-mono text-xs">
          {COMMON_VARIABLES.map((v) => (
            <li key={v.key}>
              <code className="rounded bg-white px-1 py-0.5">{v.key}</code>
              <span className="ml-2 text-[var(--text-muted,#78716C)]">
                {v.desc}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--text-muted,#78716C)]">
          Xem đầy đủ tại{" "}
          <code className="rounded bg-white px-1">
            docs/F-024-placeholder-spec.md
          </code>
        </p>
      </aside>
    </div>
  );
}
