"use client";

/**
 * FEATURE-027 — Promo Hub edit page.
 *
 * Single-page editor (combine list + new + edit per Plan):
 *   - Tab "Nội dung" — slug/title/status meta + PromoHubEditor sections
 *   - Tab "Thiết kế" — ThemeConfigurator
 *   - Tab "SEO" — SeoConfigurator
 *   - Tab "Analytics" — link sang summary endpoint (lightweight in Phase A2)
 *
 * Save: builds UpdatePromoHubDto từ state → promoHubControllerUpdate.
 *
 * RBAC: Tier 2 admin-only (F-029 pattern at top of component).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import "@/lib/api";
import {
  promoHubControllerFindById,
  promoHubControllerUpdate,
  promoHubAnalyticsControllerGetSummary,
} from "@/lib/api-generated";
import type {
  PromoHubResponseDto,
  UpdatePromoHubDto,
  PromoHubThemeInputDto,
  PromoHubSeoInputDto,
  AnalyticsSummaryDto,
} from "@/lib/api-generated";
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Save,
  Eye,
  ChevronRight,
  BarChart3,
  Loader2,
} from "lucide-react";
import { PromoHubEditor } from "@/components/promo-hub/PromoHubEditor";
import { PromoHubPreview } from "@/components/promo-hub/PromoHubPreview";
import {
  ThemeConfigurator,
  SeoConfigurator,
} from "@/components/promo-hub/ThemeConfigurator";
import type { EditorSection } from "@/components/promo-hub/SectionCard";
import type { SectionType } from "@/components/promo-hub/section-types";

type HubStatus = "draft" | "published" | "archived";

export default function PromoHubEditPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hubId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hub, setHub] = useState<PromoHubResponseDto | null>(null);

  // Local form state
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<HubStatus>("draft");
  const [sections, setSections] = useState<EditorSection[]>([]);
  const [theme, setTheme] = useState<PromoHubThemeInputDto>({});
  const [seo, setSeo] = useState<PromoHubSeoInputDto>({});

  // Analytics summary
  const [analytics, setAnalytics] = useState<AnalyticsSummaryDto | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadHub = useCallback(async () => {
    try {
      setLoading(true);
      const res = await promoHubControllerFindById({ path: { id: hubId } });
      const data = res.data as PromoHubResponseDto;
      setHub(data);
      setSlug(data.slug);
      setTitle(data.title);
      setDescription(data.description ?? "");
      setStatus(data.status);
      setSections(
        data.sections.map((s, i) => ({
          _id: s._id ?? `tmp-${i}`,
          type: s.type as SectionType,
          order: s.order,
          visible: s.visible,
          config: (s.config ?? {}) as Record<string, unknown>,
          schedule: s.schedule
            ? {
                enabled: s.schedule.enabled,
                startDate: s.schedule.startDate,
                endDate: s.schedule.endDate,
              }
            : undefined,
        })),
      );
      setTheme({
        primaryColor: data.theme.primaryColor,
        secondaryColor: data.theme.secondaryColor,
        fontFamily: data.theme.fontFamily,
        layout: data.theme.layout,
        customCss: data.theme.customCss,
      });
      setSeo({
        metaTitle: data.seo.metaTitle,
        metaDescription: data.seo.metaDescription,
        ogImage: data.seo.ogImage,
        canonicalUrl: data.seo.canonicalUrl,
        structuredData: data.seo.structuredData,
      });
    } catch (err) {
      const e = err as { body?: { message?: string }; message?: string };
      toast.error("Không tải được hub: " + (e.body?.message ?? e.message));
      router.push("/promo-hub");
    } finally {
      setLoading(false);
    }
  }, [hubId, router]);

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      const res = await promoHubAnalyticsControllerGetSummary({
        path: { hubId },
      });
      setAnalytics(res.data as AnalyticsSummaryDto);
    } catch {
      /* silent — analytics optional */
    } finally {
      setAnalyticsLoading(false);
    }
  }, [hubId]);

  useEffect(() => {
    if (isAdmin) loadHub();
  }, [loadHub, isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Re-index order trước khi gửi (defensive)
      const sectionsPayload = sections.map((s, i) => ({
        _id: s._id.startsWith("tmp-") ? undefined : s._id,
        type: s.type,
        order: i,
        visible: s.visible,
        config: s.config,
        schedule: s.schedule,
      }));

      const body: UpdatePromoHubDto = {
        slug,
        title,
        description: description || undefined,
        status,
        sections: sectionsPayload,
        theme,
        seo,
      };

      await promoHubControllerUpdate({
        path: { id: hubId },
        body,
      });
      toast.success("Đã lưu");
      await loadHub();
    } catch (err) {
      const e = err as { body?: { message?: string }; message?: string };
      toast.error("Lưu thất bại: " + (e.body?.message ?? e.message));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!isAdmin) {
    return <RestrictedAccess />;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!hub) return null;

  const publicUrl = `https://5bib.com/hub/${slug}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => router.push("/promo-hub")}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <ArrowLeft className="size-3" /> Trang quảng bá
            </button>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-foreground truncate">{title || "(chưa có tiêu đề)"}</span>
          </div>
          <h1 className="font-[var(--font-heading)] text-2xl font-black tracking-tight">
            {title || "(chưa có tiêu đề)"}
          </h1>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{publicUrl}</code>
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="flex gap-2">
          {status === "published" && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent"
            >
              <Eye className="size-4" /> Xem trang public
            </a>
          )}
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Nội dung</TabsTrigger>
          <TabsTrigger value="design">Thiết kế</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="analytics" onClick={() => !analytics && loadAnalytics()}>
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* TAB: Nội dung */}
        <TabsContent value="content" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
            <div className="space-y-4">
              {/* Meta fields */}
              <div className="rounded-xl border bg-card p-4 shadow-xs">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Thông tin chung
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Tiêu đề</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="UTMB Việt Nam 2026"
                    />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="utmb-2026"
                      className="font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Mô tả ngắn (cho admin nội bộ)</Label>
                    <Textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Trạng thái</Label>
                    <Select value={status} onValueChange={(v) => v && setStatus(v as HubStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Nháp</SelectItem>
                        <SelectItem value="published">Đã đăng</SelectItem>
                        <SelectItem value="archived">Lưu trữ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Section editor */}
              <div className="rounded-xl border bg-card p-4 shadow-xs">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Các section
                </h2>
                <PromoHubEditor sections={sections} onChange={setSections} />
              </div>
            </div>

            {/* Preview pane */}
            <div className="lg:sticky lg:top-4 lg:h-fit">
              <PromoHubPreview
                title={title}
                sections={sections}
                primaryColor={theme.primaryColor}
              />
            </div>
          </div>
        </TabsContent>

        {/* TAB: Thiết kế */}
        <TabsContent value="design" className="mt-4">
          <div className="max-w-2xl rounded-xl border bg-card p-4 shadow-xs">
            <ThemeConfigurator
              theme={theme}
              onChange={(patch) => setTheme((prev) => ({ ...prev, ...patch }))}
            />
          </div>
        </TabsContent>

        {/* TAB: SEO */}
        <TabsContent value="seo" className="mt-4">
          <div className="max-w-2xl rounded-xl border bg-card p-4 shadow-xs">
            <SeoConfigurator
              seo={seo}
              onChange={(patch) => setSeo((prev) => ({ ...prev, ...patch }))}
            />
          </div>
        </TabsContent>

        {/* TAB: Analytics */}
        <TabsContent value="analytics" className="mt-4">
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="size-5 text-[var(--admin-blue)]" />
              <h2 className="font-bold">Tổng quan analytics (30 ngày)</h2>
            </div>
            {analyticsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : analytics ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <AnalyticsCard
                  label="Tổng lượt xem"
                  value={analytics.totalViews.toLocaleString("vi-VN")}
                />
                <AnalyticsCard
                  label="Tổng lượt click"
                  value={analytics.totalClicks.toLocaleString("vi-VN")}
                />
                <AnalyticsCard
                  label="CTR"
                  value={`${(analytics.ctr * 100).toFixed(2)}%`}
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Bấm tab Analytics để tải dữ liệu.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: HubStatus }) {
  const map: Record<HubStatus, { label: string; cls: string }> = {
    draft: { label: "Nháp", cls: "border-muted-foreground/30 bg-muted text-muted-foreground" },
    published: { label: "🟢 Đã đăng", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
    archived: { label: "📦 Lưu trữ", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  };
  return (
    <Badge variant="outline" className={map[status].cls}>
      {map[status].label}
    </Badge>
  );
}

function AnalyticsCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-bold">{value}</div>
    </div>
  );
}
