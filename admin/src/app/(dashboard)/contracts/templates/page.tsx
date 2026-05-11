"use client";

/**
 * F-024 Template management page (BR-CM-11).
 *
 * UX-39 (Danny request 2026-05-11):
 *   - Editor populate textarea với DEFAULT content (KHÔNG dùng placeholder).
 *   - Track dirty per article: textarea === default → save empty override
 *     (backend dùng default); textarea !== default → save override.
 *   - "Hoàn tác Điều" button per textarea → revert default.
 *   - "Reset toàn bộ" button → clear all 11 overrides.
 *
 * UX-37: bỏ font-mono trên editor textarea (giữ font-mono CHỈ cho placeholder
 * list aside để code-block readability).
 *
 * Phase 2B simplification: dùng `<Textarea>` thay vì rich editor.
 */
import { useEffect, useMemo, useState } from "react";
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
  getContractTemplateDefaults,
  updateContractTemplate,
  type ContractTemplateView,
  type ContractType,
  type DefaultArticleSection,
} from "@/lib/contracts-api";
import { RotateCcw } from "lucide-react";

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
          Sửa trực tiếp nội dung điều khoản trên textarea — để nguyên = giữ mặc
          định. Placeholder dạng{" "}
          <code className="rounded bg-[#F3F0EB] px-1">{`{varName}`}</code> sẽ
          được thay thế khi render DOCX.
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
  const [defaults, setDefaults] = useState<DefaultArticleSection[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Editor state: per-article textarea value, populated initially với
   * (override DB ?? default body). Dirty detection: value !== defaultBody[key].
   */
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getContractTemplate(type),
      getContractTemplateDefaults(type),
    ])
      .then(([t, def]) => {
        setTpl(t);
        setDefaults(def.articles);
        // Populate editor values:
        // - If override exists → use override value
        // - Else → use default body (so user thấy text mặc định ngay, không cần placeholder).
        const overrides = t.articles ?? {};
        const initial: Record<string, string> = {};
        for (const art of def.articles) {
          initial[art.key] = overrides[art.key] ?? art.body;
        }
        setEditorValues(initial);
      })
      .catch((err) => toast.error(`Lỗi: ${err.message}`))
      .finally(() => setLoading(false));
  }, [type]);

  const defaultBodyByKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const art of defaults) map[art.key] = art.body;
    return map;
  }, [defaults]);

  function isDirty(key: string): boolean {
    const def = defaultBodyByKey[key] ?? "";
    return (editorValues[key] ?? "") !== def;
  }

  async function save() {
    setSaving(true);
    try {
      // Build payload: chỉ gửi override cho article có dirty (khác default).
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(editorValues)) {
        const def = defaultBodyByKey[k] ?? "";
        if (v !== def) payload[k] = v;
      }
      await updateContractTemplate(type, payload);
      // Refresh tpl reference to reflect new override snapshot.
      setTpl((prev) =>
        prev ? { ...prev, articles: payload } : prev,
      );
      toast.success("Đã lưu thay đổi");
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  function resetArticle(key: string) {
    const def = defaultBodyByKey[key] ?? "";
    setEditorValues((v) => ({ ...v, [key]: def }));
    toast.success("Đã hoàn tác về mặc định — bấm Lưu để áp dụng");
  }

  function resetAll() {
    const fresh: Record<string, string> = {};
    for (const art of defaults) fresh[art.key] = art.body;
    setEditorValues(fresh);
    toast.success("Đã reset toàn bộ — bấm Lưu để áp dụng");
  }

  if (loading) return <div className="p-4">Đang tải...</div>;

  const dirtyCount = Object.keys(editorValues).filter((k) => isDirty(k)).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4 rounded-lg border border-[var(--border,#E7E2D9)] bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              Chỉnh sửa nội dung điều khoản
            </h2>
            <p className="text-xs text-[var(--text-muted,#78716C)]">
              Sửa trực tiếp text — để nguyên = giữ mặc định.{" "}
              {dirtyCount > 0 && (
                <span className="font-semibold text-amber-700">
                  {dirtyCount} điều đã sửa
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetAll}>
              Reset toàn bộ
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
        {defaults.map((art) => {
          const dirty = isDirty(art.key);
          return (
            <div key={art.key}>
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor={`tpl-${art.key}`}
                  className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted,#78716C)]"
                >
                  {art.heading || art.key}
                </label>
                {dirty && (
                  <button
                    type="button"
                    onClick={() => resetArticle(art.key)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:underline"
                    title="Hoàn tác về nội dung mặc định"
                  >
                    <RotateCcw className="size-3" /> Hoàn tác Điều này
                  </button>
                )}
              </div>
              <Textarea
                id={`tpl-${art.key}`}
                value={editorValues[art.key] ?? ""}
                onChange={(e) =>
                  setEditorValues((v) => ({ ...v, [art.key]: e.target.value }))
                }
                rows={8}
                className="text-sm leading-relaxed"
              />
            </div>
          );
        })}
      </div>
      <aside className="rounded-lg border border-[var(--border,#E7E2D9)] bg-[#FAF8F5] p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
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
          Sửa trực tiếp text trên — để nguyên = giữ mặc định.
        </p>
        <p className="mt-2 text-xs text-[var(--text-muted,#78716C)]">
          Tham khảo đầy đủ tại{" "}
          <code className="rounded bg-white px-1">
            docs/F-024-placeholder-spec.md
          </code>
        </p>
        {/* Note: UX-20 sticky scroll preview — Phase batch 3 mở rộng */}
      </aside>
    </div>
  );
}
