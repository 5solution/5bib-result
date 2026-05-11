"use client";

/**
 * F-024 Templates page — UX-39 v2 REWRITE.
 *
 * Rich text editor giống Team Management contract editor:
 *   - TipTap toolbar (B/I/U, H1/H2, align, font, size, list, table, insert variable, HTML view)
 *   - 2-column layout: editor (left) + live preview (right)
 *   - Toggle "Xem với dữ liệu mẫu" cho preview
 *   - 4 tab contract type × 11 article per tab (accordion expandable)
 *   - Per-article "Hoàn tác Điều này" + global "Reset toàn bộ"
 *   - Save flow: diff vs default → omit identical, PATCH overrides only
 *
 * Replaces v1 (commit adbc507 textarea version).
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
  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Mẫu hợp đồng</h1>
        <p className="text-sm text-[var(--text-muted,#78716C)]">
          Soạn thảo điều khoản với rich editor — chèn placeholder dạng{" "}
          <code className="rounded bg-[#F3F0EB] px-1">{"{varName}"}</code> để
          render động khi xuất DOCX. Preview bên phải xem trước với dữ liệu mẫu.
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
            <TemplateEditor type={t.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function TemplateEditor({ type }: { type: ContractType }): React.ReactElement {
  const confirm = useConfirm();
  const [defaults, setDefaults] = useState<DefaultArticleSection[]>([]);
  const [loading, setLoading] = useState(true);
  /** Per-article current content (plain text — DB format). */
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  /** Trigger forced reload of editor content (revert button). Increment to fire. */
  const [resetSignals, setResetSignals] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [withSampleData, setWithSampleData] = useState(true);
  /** Which article is currently being edited. Default: first one expanded. */
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // ────────────────────────────────────────────────────────────────────────
  // Load defaults + DB override on tab mount.
  // ────────────────────────────────────────────────────────────────────────
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
        // Auto-expand first article so admin sees editor immediately.
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

  // ────────────────────────────────────────────────────────────────────────
  // Save: diff vs default → only PATCH non-identical (BR-CM-11 storage rule).
  // ────────────────────────────────────────────────────────────────────────
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
      title: "Reset toàn bộ?",
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
      // Bump ALL reset signals so every editor reloads default content.
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

  // ────────────────────────────────────────────────────────────────────────
  // Build preview articles using current editor values.
  // ────────────────────────────────────────────────────────────────────────
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
      {/* Sticky action bar */}
      <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-lg border border-[var(--border,#E7E2D9)] bg-white/95 px-4 py-2 shadow-sm backdrop-blur">
        <div>
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
        {/* ─────────── Left: editor list (accordion) ─────────── */}
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

        {/* ─────────── Right: live preview pane ─────────── */}
        <aside className="space-y-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)]">
          <div className="flex items-center justify-between rounded-lg border border-[var(--border,#E7E2D9)] bg-white px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="size-4 text-muted-foreground" />
              Xem trước (toàn bộ {defaults.length} điều khoản)
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
