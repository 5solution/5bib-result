"use client";

/**
 * F-024 Templates page — UX-39 v3 REWRITE (Phương án 3).
 *
 * Layout 2 tầng:
 *   Tier 1: 4 tab contract type (Tính giờ / Racekit / Vận hành / Bán vé)
 *   Tier 2: 2 tab content
 *     - "Xem mẫu"  → Audit Viewer mammoth (Task 1) + Upload DOCX btn (Task 2)
 *     - "Sửa nội dung" → Rich Editor articles (UX-39 v2 KEEP) + Phụ lục table
 *                        editor (Task 3)
 *
 * Phương án B (mammoth roundtrip) chỉ đạt 88% fidelity, KHÔNG đạt 95%+ yêu
 * cầu → switch sang viewer mode (fidelity 100% vì KHÔNG roundtrip).
 */

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useConfirm } from "@/components/confirm-dialog";
import {
  getContractTemplate,
  getContractTemplateDefaults,
  resetContractTemplate,
  updateContractTemplate,
  type ContractType,
  type DefaultArticleSection,
} from "@/lib/contracts-api";
import ContractTemplatePreview, {
  type PreviewArticle,
} from "../_components/contract-template-preview";
import TemplatePreviewViewer from "../_components/template-preview-viewer";
import TemplateUploadBtn from "../_components/template-upload-btn";
import TemplateLineItemsEditor from "../_components/template-line-items-editor";

// Editor is TipTap — must be client-only.
const ContractTemplateRichEditor = dynamic(
  () => import("../_components/contract-template-rich-editor"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-md border bg-muted/20 p-6 text-sm text-muted-foreground">
        Đang tải trình soạn thảo...
      </div>
    ),
  },
);

const TYPES: { id: ContractType; label: string }[] = [
  { id: "TIMING", label: "Tính giờ" },
  { id: "RACEKIT", label: "Racekit" },
  { id: "OPERATIONS", label: "Vận hành" },
  { id: "TICKET_SALES", label: "Bán vé" },
];

export default function TemplatesPage(): React.ReactElement {
  // F-029 BR-HD-30 — page-level RBAC gate `isStaff || isFinance` (F-078 widen).
  const { isStaff, isFinance, isLoading } = useAuth();
  if (isLoading) return <></>;
  if (!isStaff && !isFinance) return <RestrictedAccess />;
  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Mẫu hợp đồng</h1>
        <p className="text-sm text-[var(--text-muted,#78716C)]">
          Audit Viewer hiển thị nguyên bản DOCX (fidelity 100%) — upload mẫu
          mới qua Word desktop. Editor articles + Phụ lục để override khi
          tạo HĐ.
        </p>
      </header>
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
            <TypeTabContent type={t.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function TypeTabContent({ type }: { type: ContractType }): React.ReactElement {
  // refreshKey bumps after a successful upload → audit viewer reload.
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

  return (
    <Tabs defaultValue="preview" className="mt-3">
      <TabsList>
        <TabsTrigger value="preview">Xem mẫu (DOCX nguyên bản)</TabsTrigger>
        <TabsTrigger value="edit">Sửa nội dung (override)</TabsTrigger>
      </TabsList>
      <TabsContent value="preview" className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border,#E7E2D9)] bg-white px-4 py-2.5">
          <div>
            <p className="text-sm font-semibold">
              Audit Viewer — fidelity 100% so DOCX gốc
            </p>
            <p className="text-xs text-[var(--text-muted,#78716C)]">
              Tải lên file .docx (max 10MB) sau khi sửa header/footer/Bên
              A/B/signature ở Word desktop. Mẫu cũ tự động backup.
            </p>
          </div>
          <TemplateUploadBtn
            type={type}
            onUploaded={() => setPreviewRefreshKey((k) => k + 1)}
          />
        </div>
        <div className="overflow-hidden rounded-lg border border-[var(--border,#E7E2D9)] bg-white shadow-sm">
          <TemplatePreviewViewer type={type} refreshKey={previewRefreshKey} />
        </div>
      </TabsContent>
      <TabsContent value="edit" className="space-y-4">
        <ArticlesEditor type={type} />
        <TemplateLineItemsEditor type={type} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * UX-39 v2 — rich editor articles section (kept). Renamed from TemplateEditor
 * → ArticlesEditor để rõ scope chỉ articles, không phải toàn template page.
 */
function ArticlesEditor({ type }: { type: ContractType }): React.ReactElement {
  const confirm = useConfirm();
  const [defaults, setDefaults] = useState<DefaultArticleSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [resetSignals, setResetSignals] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [withSampleData, setWithSampleData] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getContractTemplate(type),
      getContractTemplateDefaults(type),
    ])
      .then(([tpl, def]) => {
        setDefaults(def.articles);
        const overrides = tpl.articles ?? {};
        const initial: Record<string, string> = {};
        for (const art of def.articles) {
          initial[art.key] = overrides[art.key] ?? art.body;
        }
        setEditorValues(initial);
        if (def.articles.length > 0) setActiveKey(def.articles[0].key);
      })
      .catch((err) => toast.error(`Lỗi tải: ${(err as Error).message}`))
      .finally(() => setLoading(false));
  }, [type]);

  const defaultBodyByKey = useMemo(() => {
    const m: Record<string, string> = {};
    for (const art of defaults) m[art.key] = art.body;
    return m;
  }, [defaults]);

  function isDirty(key: string): boolean {
    return (editorValues[key] ?? "") !== (defaultBodyByKey[key] ?? "");
  }

  const dirtyCount = Object.keys(editorValues).filter((k) => isDirty(k)).length;

  async function save(): Promise<void> {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(editorValues)) {
        const def = defaultBodyByKey[k] ?? "";
        if (v !== def) payload[k] = v;
      }
      await updateContractTemplate(type, payload);
      toast.success(
        `Đã lưu — ${Object.keys(payload).length} điều khoản tùy chỉnh`,
      );
    } catch (err) {
      toast.error(`Lỗi lưu: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  function resetArticle(key: string): void {
    const def = defaultBodyByKey[key] ?? "";
    setEditorValues((v) => ({ ...v, [key]: def }));
    setResetSignals((s) => ({ ...s, [key]: (s[key] ?? 0) + 1 }));
    toast.success("Đã hoàn tác về mặc định — bấm Lưu để áp dụng");
  }

  async function resetAll(): Promise<void> {
    const ok = await confirm({
      title: "Reset toàn bộ điều khoản?",
      description:
        "Tất cả tùy chỉnh trên 11 điều khoản của loại hợp đồng này sẽ bị xóa khỏi DB và quay về mặc định. Không thể hoàn tác.",
      confirmText: "Xác nhận reset",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await resetContractTemplate(type);
      const fresh: Record<string, string> = {};
      for (const art of defaults) fresh[art.key] = art.body;
      setEditorValues(fresh);
      const sigs: Record<string, number> = {};
      for (const art of defaults) {
        sigs[art.key] = (resetSignals[art.key] ?? 0) + 1;
      }
      setResetSignals(sigs);
      toast.success("Đã reset toàn bộ về mặc định");
    } catch (err) {
      toast.error(`Lỗi reset: ${(err as Error).message}`);
    }
  }

  const previewArticles: PreviewArticle[] = useMemo(
    () =>
      defaults.map((art) => ({
        key: art.key,
        heading: art.heading,
        body: editorValues[art.key] ?? art.body,
      })),
    [defaults, editorValues],
  );

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-lg border border-[var(--border,#E7E2D9)] bg-white/95 px-4 py-2 shadow-sm backdrop-blur">
        <div>
          <p className="text-sm font-semibold">11 điều khoản hợp đồng</p>
          <p className="text-xs text-[var(--text-muted,#78716C)]">
            Sửa rich editor — để trống = giữ mặc định.{" "}
            {dirtyCount > 0 ? (
              <span className="font-semibold text-amber-700">
                {dirtyCount} điều đã sửa
              </span>
            ) : (
              <span>Chưa có thay đổi</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void resetAll()}>
            <RotateCcw className="mr-1.5 size-3.5" />
            Reset toàn bộ
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            <Save className="mr-1.5 size-3.5" />
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {defaults.map((art) => {
            const dirty = isDirty(art.key);
            const open = activeKey === art.key;
            return (
              <div
                key={art.key}
                className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white"
              >
                <button
                  type="button"
                  onClick={() => setActiveKey(open ? null : art.key)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--surface-2,#F5F1EA)]"
                  aria-expanded={open}
                >
                  {open ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1 text-sm font-semibold">
                    {art.heading || art.key}
                  </span>
                  {dirty ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Đã sửa
                    </span>
                  ) : null}
                </button>
                {open ? (
                  <div className="border-t p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <code className="rounded bg-[#F3F0EB] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted,#78716C)]">
                        {art.key}
                      </code>
                      {dirty ? (
                        <button
                          type="button"
                          onClick={() => resetArticle(art.key)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
                          title="Hoàn tác về nội dung mặc định"
                        >
                          <RotateCcw className="size-3" /> Hoàn tác Điều này
                        </button>
                      ) : null}
                    </div>
                    <ContractTemplateRichEditor
                      initialContent={editorValues[art.key] ?? ""}
                      onChange={(plainText) =>
                        setEditorValues((v) => ({
                          ...v,
                          [art.key]: plainText,
                        }))
                      }
                      placeholder="Nhập nội dung điều khoản..."
                      resetSignal={resetSignals[art.key]}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <aside className="space-y-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)]">
          <div className="flex items-center justify-between rounded-lg border border-[var(--border,#E7E2D9)] bg-white px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="size-4 text-muted-foreground" />
              Xem trước override (toàn bộ {defaults.length} điều khoản)
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Switch
                checked={withSampleData}
                onCheckedChange={setWithSampleData}
              />
              <span>Xem với dữ liệu mẫu</span>
            </label>
          </div>
          <div className="overflow-hidden rounded-lg border border-[var(--border,#E7E2D9)] bg-white">
            <ContractTemplatePreview
              articles={previewArticles}
              withSampleData={withSampleData}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
