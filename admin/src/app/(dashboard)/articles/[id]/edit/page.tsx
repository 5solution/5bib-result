"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import "@/lib/api";
import {
  articlesAdminControllerFindOne,
  articlesAdminControllerUpdate,
  articlesAdminControllerPublish,
  articlesAdminControllerUnpublish,
  articleCategoriesAdminControllerList,
  uploadControllerUploadFile,
} from "@/lib/api-generated";
import type {
  ArticleAdminDto,
  ArticleCategoryResponseDto,
  UpdateArticleDto,
} from "@/lib/api-generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  RefreshCw,
  Upload,
  X,
  CheckCircle2,
  CircleDashed,
  AlertTriangle,
  Settings2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ArticleEditor } from "@/components/ArticleEditor";

const PRODUCT_OPTIONS = [
  { value: "5bib", label: "5BIB" },
  { value: "5sport", label: "5Sport" },
  { value: "5ticket", label: "5Ticket" },
  { value: "5pix", label: "5Pix" },
] as const;

type SaveStatus = "idle" | "saving" | "saved" | "error";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Returns null if file passes; error message string otherwise. */
function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `Chỉ hỗ trợ JPG / PNG / WebP (file của bạn: ${file.type || "unknown"})`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `File ${mb}MB vượt quá giới hạn 2MB`;
  }
  return null;
}

export default function EditArticlePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [article, setArticle] = useState<ArticleAdminDto | null>(null);
  const [categories, setCategories] = useState<ArticleCategoryResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<UpdateArticleDto>({});
  // Monotonically incrementing request ID — each scheduled autosave bumps this.
  // When a response returns, if its captured ID < latest, the response is stale
  // (a newer save was already issued) and we discard the merge. Prevents the
  // race where a slow request from older state overwrites fresher local state.
  const latestReqRef = useRef(0);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [art, cats] = await Promise.all([
          articlesAdminControllerFindOne({ path: { id } }),
          articleCategoriesAdminControllerList(),
        ]);
        if (cancelled) return;
        setArticle(art.data as ArticleAdminDto);
        setCategories((cats.data as ArticleCategoryResponseDto[]) ?? []);
        setSavedAt(new Date((art.data as ArticleAdminDto).updatedAt));
      } catch (err) {
        const e = err as { status?: number; body?: { message?: string } };
        if (e.status === 404) {
          toast.error("Không tìm thấy bài viết");
          router.replace("/articles");
        } else {
          toast.error("Không tải được bài viết: " + (e.body?.message ?? "lỗi"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  /** Queue a partial update; flush after 2s of inactivity. */
  const queuePatch = useCallback(
    (patch: UpdateArticleDto) => {
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      setSaveStatus("saving");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const body = pendingPatchRef.current;
        pendingPatchRef.current = {};
        const myReq = ++latestReqRef.current;
        try {
          const res = await articlesAdminControllerUpdate({ path: { id }, body });
          // Stale response — newer save in flight; abandon merge.
          if (myReq !== latestReqRef.current) return;
          const fresh = res.data as ArticleAdminDto;
          setArticle((prev) => (prev ? { ...prev, ...fresh } : fresh));
          setSavedAt(new Date(fresh.updatedAt));
          setSaveStatus("saved");
        } catch (err) {
          // B-11 — restore pending so user's edits aren't silently dropped on retry.
          pendingPatchRef.current = { ...body, ...pendingPatchRef.current };
          if (myReq === latestReqRef.current) {
            setSaveStatus("error");
            const e = err as { body?: { message?: string } };
            toast.error("Autosave lỗi: " + (e.body?.message ?? "không xác định"));
          }
        }
      }, 2000);
    },
    [id],
  );

  // Flush pending patch on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateField = <K extends keyof UpdateArticleDto>(
    key: K,
    value: UpdateArticleDto[K],
  ) => {
    setArticle((prev) => {
      if (!prev) return prev;
      const v = (value ?? "") as ArticleAdminDto[keyof ArticleAdminDto];
      return { ...prev, [key]: v } as ArticleAdminDto;
    });
    queuePatch({ [key]: value } as UpdateArticleDto);
  };

  const toggleProduct = (product: string) => {
    if (!article) return;
    const next = (
      article.products.includes(product)
        ? article.products.filter((p) => p !== product)
        : [...article.products, product]
    ) as Array<"5bib" | "5sport" | "5ticket" | "5pix" | "all">;
    updateField("products", next);
  };

  const uploadCover = async (file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setCoverUploading(true);
    try {
      const res = await uploadControllerUploadFile({ body: { file } });
      const data = res.data as { url?: string; Location?: string } | undefined;
      const url = data?.url ?? data?.Location;
      if (!url) throw new Error("Upload không trả URL");
      updateField("coverImageUrl", url);
      toast.success("Đã upload ảnh bìa");
    } catch (err) {
      toast.error("Upload thất bại: " + (err as Error).message);
    } finally {
      setCoverUploading(false);
    }
  };

  const pickEditorImage = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const validationError = validateImageFile(file);
        if (validationError) {
          toast.error(validationError);
          return resolve(null);
        }
        try {
          const res = await uploadControllerUploadFile({ body: { file } });
          const data = res.data as { url?: string; Location?: string } | undefined;
          const url = data?.url ?? data?.Location;
          if (!url) throw new Error("Upload không trả URL");
          resolve(url);
        } catch (err) {
          toast.error("Upload ảnh thất bại: " + (err as Error).message);
          resolve(null);
        }
      };
      input.click();
    });
  }, []);

  const handlePublish = async () => {
    if (!article) return;
    // Flush pending patch first
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      const pending = pendingPatchRef.current;
      pendingPatchRef.current = {};
      if (Object.keys(pending).length > 0) {
        try {
          await articlesAdminControllerUpdate({ path: { id }, body: pending });
        } catch {
          /* fall through to publish — backend will re-validate */
        }
      }
    }
    setPublishing(true);
    setMissingFields([]);
    try {
      const res = await articlesAdminControllerPublish({ path: { id } });
      const fresh = res.data as ArticleAdminDto;
      setArticle(fresh);
      toast.success("Đã đăng bài 🎉");
    } catch (err) {
      const e = err as {
        status?: number;
        body?: { message?: string; missing?: string[] };
      };
      if (e.status === 422 && e.body?.missing) {
        setMissingFields(e.body.missing);
        toast.error(
          `Thiếu trường bắt buộc: ${e.body.missing.join(", ")}`,
        );
      } else {
        toast.error("Publish thất bại: " + (e.body?.message ?? "không xác định"));
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setPublishing(true);
    try {
      const res = await articlesAdminControllerUnpublish({ path: { id } });
      setArticle(res.data as ArticleAdminDto);
      toast.success("Đã ẩn bài");
    } catch (err) {
      toast.error("Unpublish thất bại: " + (err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  if (loading || !article) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-[600px]" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  const isPublished = article.status === "published";
  const slugIsValid = /^[a-z0-9-]+$/.test(article.slug || "");

  // Sidebar JSX extracted so it can render both inline (desktop) and inside
  // Sheet (mobile) without duplication. Closure captures all state + handlers.
  const sidebarBody = renderSidebarBody({
    article,
    categories,
    isPublished,
    publishing,
    missingFields,
    coverUploading,
    handlePublish,
    handleUnpublish,
    updateField,
    toggleProduct,
    uploadCover,
  });

  return (
    <div className="-m-4 md:-m-6">
      {/* Sub-toolbar */}
      <div className="sticky top-[60px] z-20 flex items-center gap-3 border-b bg-card px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={() => router.push("/articles")}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Quay lại
        </button>
        <span className="h-4 w-px bg-border" aria-hidden />
        <SaveIndicator status={saveStatus} savedAt={savedAt} />
        <span className="ml-auto flex items-center gap-3">
          <span className="text-xs">
            {isPublished ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                <span className="size-2 rounded-full bg-emerald-700" /> Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-bold text-muted-foreground">
                <span className="size-2 rounded-full bg-muted-foreground" /> Draft
              </span>
            )}
          </span>
          {/* U-05 + B-12: Mobile sidebar via Sheet drawer (hidden on lg+) */}
          <Sheet>
            <SheetTrigger className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-bold lg:hidden">
              <Settings2 className="size-3.5" />
              Cài đặt
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-[420px] overflow-y-auto bg-muted/30 p-5 sm:max-w-[420px]">
              <SheetHeader className="mb-3 p-0 text-left">
                <SheetTitle className="text-base">Cài đặt bài viết</SheetTitle>
              </SheetHeader>
              <div className="space-y-4">{sidebarBody}</div>
            </SheetContent>
          </Sheet>
        </span>
      </div>

      <div className="grid min-h-[calc(100vh-120px)] grid-cols-1 gap-0 lg:grid-cols-[1fr_360px]">
        {/* ── Editor column ── */}
        <section className="bg-card">
          <div className="mx-auto w-full max-w-[860px] px-6 py-10 md:px-14">
            <textarea
              value={article.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Nhập tiêu đề bài viết…"
              rows={1}
              // Auto-grow on input — keeps long titles readable on multiple
              // lines instead of horizontally scrolling out of view in a
              // text-5xl single-line input. `field-sizing: content` covers
              // modern browsers; the onInput resize handles legacy fallback.
              onInput={(e) => {
                const ta = e.currentTarget;
                ta.style.height = 'auto';
                ta.style.height = `${ta.scrollHeight}px`;
              }}
              ref={(ta) => {
                // Resize on initial mount + when value changes externally.
                if (ta) {
                  ta.style.height = 'auto';
                  ta.style.height = `${ta.scrollHeight}px`;
                }
              }}
              className="w-full resize-none overflow-hidden border-none bg-transparent p-0 font-[var(--font-heading)] text-4xl font-black leading-tight tracking-tight outline-none [field-sizing:content] placeholder:text-muted-foreground/40 md:text-5xl"
            />

            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-mono font-bold text-[var(--primary)]">
                hotro.5bib.com/
              </span>
              <input
                value={article.slug}
                onChange={(e) => {
                  // B-09: sanitize live to prevent autosave spam from invalid chars.
                  // Replaces any non-allowed char with '-' and collapses runs.
                  const cleaned = e.target.value
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[̀-ͯ]/g, "")
                    .replace(/đ/g, "d")
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-")
                    .replace(/^-|-$/g, "");
                  updateField("slug", cleaned);
                }}
                placeholder="slug-cua-bai-viet"
                className="min-w-0 flex-1 border-none bg-transparent p-0 font-mono text-sm font-semibold text-foreground outline-none"
                pattern="^[a-z0-9-]+$"
              />
              {!slugIsValid && article.slug.length > 0 && (
                <span className="text-xs text-destructive">
                  Slug rỗng / không hợp lệ
                </span>
              )}
            </div>

            <div className="mt-8">
              <ArticleEditor
                initialContent={article.content}
                onChange={(html) => updateField("content", html)}
                onPickImage={pickEditorImage}
              />
            </div>
          </div>
        </section>

        {/* ── Sidebar settings (desktop only — mobile uses Sheet from toolbar) ── */}
        <aside className="hidden bg-muted/30 p-5 lg:sticky lg:top-[60px] lg:flex lg:max-h-[calc(100vh-60px)] lg:flex-col lg:gap-4 lg:overflow-y-auto lg:border-l">
          {sidebarBody}
        </aside>
      </div>
    </div>
  );
}

// ─── Sidebar body — extracted for desktop aside + mobile Sheet ────────────

interface SidebarBodyArgs {
  article: ArticleAdminDto;
  categories: ArticleCategoryResponseDto[];
  isPublished: boolean;
  publishing: boolean;
  missingFields: string[];
  coverUploading: boolean;
  handlePublish: () => void;
  handleUnpublish: () => void;
  updateField: <K extends keyof UpdateArticleDto>(key: K, value: UpdateArticleDto[K]) => void;
  toggleProduct: (product: string) => void;
  uploadCover: (file: File) => void;
}

function renderSidebarBody({
  article,
  categories,
  isPublished,
  publishing,
  missingFields,
  coverUploading,
  handlePublish,
  handleUnpublish,
  updateField,
  toggleProduct,
  uploadCover,
}: SidebarBodyArgs) {
  return (
    <>
      <Card title="📤 Đăng bài">
        <div className="flex gap-2">
          {isPublished ? (
            <Button
              variant="outline"
              onClick={handleUnpublish}
              disabled={publishing}
              className="flex-1"
            >
              Ẩn (unpublish)
            </Button>
          ) : (
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="flex-1"
            >
              {publishing ? "Đang đăng..." : "Publish ↑"}
            </Button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Mọi thay đổi tự động lưu sau 2 giây.
        </p>
        {missingFields.length > 0 && (
          <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/5 p-2.5 text-xs text-destructive">
            <div className="mb-1 inline-flex items-center gap-1.5 font-bold">
              <AlertTriangle className="size-3.5" />
              Thiếu để publish
            </div>
            <ul className="list-disc pl-4">
              {missingFields.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 rounded-md border border-dashed bg-card px-3 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${
                isPublished ? "bg-emerald-700" : "bg-muted-foreground"
              }`}
            />
            Đang là <b className="text-foreground">{isPublished ? "đã đăng" : "bản nháp"}</b>
          </span>
        </div>
      </Card>

      <Card title="📋 Phân loại">
        <Field label="Loại bài *">
          <SegRadio
            value={article.type}
            onChange={(v) => updateField("type", v as "help" | "news")}
            options={[
              { value: "help", label: "📖 Hướng dẫn" },
              { value: "news", label: "📰 Tin tức" },
            ]}
          />
        </Field>
        <Field label="Sản phẩm *">
          <div className="grid grid-cols-2 gap-1.5">
            {PRODUCT_OPTIONS.map((p) => {
              const checked = article.products.includes(p.value);
              return (
                <label
                  key={p.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold transition-colors ${
                    checked
                      ? "border-[var(--primary)] bg-blue-50 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-border"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleProduct(p.value)}
                  />
                  {p.label}
                </label>
              );
            })}
          </div>
        </Field>
        <Field label="Danh mục">
          <Select
            value={article.category || "__none"}
            onValueChange={(v) => updateField("category", v === "__none" ? "" : (v ?? ""))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Chọn danh mục..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— Không có —</SelectItem>
              {categories
                .filter(
                  (c) => c.isActive && (c.type === "both" || c.type === article.type),
                )
                .map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border bg-card px-3 py-2.5 text-sm font-semibold">
          <span>⭐ Đặt làm bài nổi bật (hero)</span>
          <Switch
            checked={article.featured}
            onCheckedChange={(v) => updateField("featured", v)}
          />
        </label>
      </Card>

      <Card title="🖼️ Ảnh bìa *" hint="1200×630px · OG image">
        <CoverUpload
          value={article.coverImageUrl}
          uploading={coverUploading}
          onPick={uploadCover}
          onClear={() => updateField("coverImageUrl", "")}
        />
      </Card>

      <Card title="📝 Mô tả ngắn" hint={`${article.excerpt.length}/160 ký tự`}>
        <Textarea
          value={article.excerpt}
          onChange={(e) => updateField("excerpt", e.target.value.slice(0, 160))}
          rows={3}
          placeholder="Tóm tắt cho listing & social share…"
        />
      </Card>

      <Card title="🔍 SEO & Social">
        <Field label={`Tiêu đề SEO · ${article.seoTitle.length}/60`}>
          <Input
            value={article.seoTitle}
            onChange={(e) => updateField("seoTitle", e.target.value.slice(0, 60))}
            placeholder={article.title}
          />
        </Field>
        <Field label={`Mô tả SEO · ${article.seoDescription.length}/160`}>
          <Textarea
            value={article.seoDescription}
            onChange={(e) => updateField("seoDescription", e.target.value.slice(0, 160))}
            rows={3}
            placeholder={article.excerpt}
          />
        </Field>
        <GooglePreview
          slug={article.slug || "slug-bai-viet"}
          category={article.category}
          title={article.seoTitle || article.title || "Tiêu đề bài viết"}
          description={article.seoDescription || article.excerpt || "Mô tả bài viết…"}
        />
      </Card>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function SaveIndicator({ status, savedAt }: { status: SaveStatus; savedAt: Date | null }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
        <RefreshCw className="size-3 animate-spin" />
        Đang lưu…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-destructive">
        <AlertTriangle className="size-3" />
        Autosave lỗi
      </span>
    );
  }
  if (savedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3 text-emerald-700" />
        Đã lưu lúc {savedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <CircleDashed className="size-3" />
      Chưa thay đổi
    </span>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="font-[var(--font-heading)] text-sm font-bold tracking-tight">
          {title}
        </div>
        {hint && <div className="text-[10.5px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SegRadio({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex gap-1 rounded-lg border bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CoverUpload({
  value,
  uploading,
  onPick,
  onClear,
}: {
  value: string;
  uploading: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div
          className="relative aspect-[1200/630] w-full overflow-hidden rounded-lg border bg-cover bg-center"
          style={{ backgroundImage: `url(${value})` }}
        >
          <div className="absolute inset-x-2 bottom-2 flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => ref.current?.click()}
              disabled={uploading}
              className="flex-1 bg-card/90 backdrop-blur"
            >
              <Upload className="mr-1.5 size-3.5" />
              {uploading ? "Đang tải..." : "Thay ảnh"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onClear}
              disabled={uploading}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="flex aspect-[1200/630] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-background text-sm text-muted-foreground transition-colors hover:border-[var(--primary)] hover:bg-blue-50/40 disabled:opacity-60"
        >
          <Upload className="size-6" />
          {uploading ? "Đang upload..." : "Click để chọn ảnh bìa"}
          <span className="text-xs">1200×630 · max 2MB</span>
        </button>
      )}
    </>
  );
}

function GooglePreview({
  slug,
  category,
  title,
  description,
}: {
  slug: string;
  category: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
        Google preview
      </div>
      <div className="font-[arial,sans-serif] text-xs text-[#5F6368]">
        hotro.5bib.com {category && `› ${category}`}
      </div>
      <div className="my-1 line-clamp-1 font-[arial,sans-serif] text-base leading-tight text-[#1A0DAB]">
        {title}
      </div>
      <div className="line-clamp-2 font-[arial,sans-serif] text-[12.5px] leading-snug text-[#4D5156]">
        {description}
      </div>
    </div>
  );
}
