"use client";

/**
 * RaceCertificateConfigPanel
 *
 * Embedded tab panel inside the Race Detail page.
 * Lets admin:
 *  - Enable / disable certificate generation for this race
 *  - Pick a default certificate template + default share-card template
 *  - Override templates per distance (course-level overrides)
 *
 * Does NOT touch any other race fields — isolated concern.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getRaceCertificateConfig,
  upsertRaceCertificateConfig,
  listCertificateTemplates,
  type CertificateTemplate,
  type RaceCertificateConfig,
  type CourseTemplateOverride,
  type TemplateType,
} from "@/lib/certificate-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Save, Plus, ExternalLink, Award, Share2 } from "lucide-react";

interface Course {
  courseId: string;
  name?: string;
  distance?: string;
}

interface Props {
  raceId: string;
  courses: Course[];
}

const NONE = "__none__";

// Template select — "Không dùng" + list of templates filtered by type
function TemplateSelect({
  value,
  onChange,
  templates,
  type,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  templates: CertificateTemplate[];
  type: TemplateType;
  placeholder?: string;
}) {
  const filtered = templates.filter((t) => t.type === type && !t.is_archived);
  const current = value ?? NONE;

  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(!v || v === NONE ? null : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder ?? "Không dùng"}>
          {(val: string) => {
            if (!val || val === NONE) return placeholder ?? "Không dùng";
            return filtered.find((t) => t.id === val)?.name ?? "Đang tải...";
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder ?? "Không dùng"}</SelectItem>
        {filtered.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
            {t.course_id && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({t.course_id})
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function RaceCertificateConfigPanel({ raceId, courses }: Props) {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);

  // Editable config state
  const [enabled, setEnabled] = useState(false);
  const [defaultCert, setDefaultCert] = useState<string | null>(null);
  const [defaultShare, setDefaultShare] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<CourseTemplateOverride[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [cfg, tmpl] = await Promise.all([
        getRaceCertificateConfig(token, raceId),
        listCertificateTemplates(token, { raceId, pageSize: 200 }),
      ]);

      setTemplates(tmpl.data);

      if (cfg) {
        setEnabled(cfg.enabled ?? false);
        setDefaultCert(cfg.default_template_certificate ?? null);
        setDefaultShare(cfg.default_template_share_card ?? null);
        setOverrides(
          (cfg.course_overrides ?? []).map((o) => ({
            course_id: o.course_id,
            template_certificate: o.template_certificate ?? null,
            template_share_card: o.template_share_card ?? null,
          })),
        );
      } else {
        // No config yet — init overrides from race courses, all null
        setOverrides(
          courses.map((c) => ({
            course_id: c.courseId,
            template_certificate: null,
            template_share_card: null,
          })),
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi tải config");
    } finally {
      setLoading(false);
    }
  }, [token, raceId, courses]);

  useEffect(() => {
    load();
  }, [load]);

  const setOverrideCert = (courseId: string, val: string | null) => {
    setOverrides((prev) =>
      prev.map((o) =>
        o.course_id === courseId ? { ...o, template_certificate: val } : o,
      ),
    );
  };

  const setOverrideShare = (courseId: string, val: string | null) => {
    setOverrides((prev) =>
      prev.map((o) =>
        o.course_id === courseId ? { ...o, template_share_card: val } : o,
      ),
    );
  };

  // Ensure every course from race.courses has an entry in overrides
  const mergedOverrides = courses.map((c) => {
    const existing = overrides.find((o) => o.course_id === c.courseId);
    return (
      existing ?? {
        course_id: c.courseId,
        template_certificate: null,
        template_share_card: null,
      }
    );
  });

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      // Only include course overrides that have at least one template set
      const cleanOverrides = mergedOverrides
        .filter(
          (o) =>
            o.template_certificate !== null || o.template_share_card !== null,
        )
        .map((o) => ({
          course_id: o.course_id,
          template_certificate: o.template_certificate ?? null,
          template_share_card: o.template_share_card ?? null,
        }));

      await upsertRaceCertificateConfig(token, raceId, {
        enabled,
        default_template_certificate: defaultCert ?? null,
        default_template_share_card: defaultShare ?? null,
        course_overrides: cleanOverrides,
      });
      toast.success("Đã lưu cấu hình certificate");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const certTemplates = templates.filter((t) => t.type === "certificate");
  const shareTemplates = templates.filter((t) => t.type === "share_card");

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm text-muted-foreground">
          {certTemplates.length} certificate template
          {certTemplates.length !== 1 && "s"}, {shareTemplates.length} share
          card template{shareTemplates.length !== 1 && "s"} cho giải này.
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/certificates/new?raceId=${raceId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Plus className="size-3.5" />
            Thêm template
          </Link>
          <Link
            href={`/certificates?raceId=${raceId}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ExternalLink className="size-3.5" />
            Xem tất cả
          </Link>
        </div>
      </div>

      {/* Enable toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">
                Bật Certificate v1.1
              </Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Khi bật, VĐV sẽ thấy nút &quot;Tải chứng nhận kèm ảnh&quot;
                nếu có template được cấu hình. Chạy song song với hệ thống cũ.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* Default templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template mặc định</CardTitle>
          <CardDescription>
            Áp dụng cho tất cả cự ly khi không có override riêng
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <Award className="size-3.5 text-blue-600" />
                Certificate mặc định
              </Label>
              <TemplateSelect
                value={defaultCert}
                onChange={setDefaultCert}
                templates={templates}
                type="certificate"
                placeholder="Không dùng"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <Share2 className="size-3.5 text-purple-600" />
                Share Card mặc định
              </Label>
              <TemplateSelect
                value={defaultShare}
                onChange={setDefaultShare}
                templates={templates}
                type="share_card"
                placeholder="Không dùng"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Course overrides */}
      {courses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Override theo cự ly</CardTitle>
            <CardDescription>
              Chọn template riêng cho từng cự ly. Để trống = dùng template mặc
              định ở trên.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Cự ly</TableHead>
                  <TableHead>Certificate</TableHead>
                  <TableHead>Share Card</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mergedOverrides.map((o) => {
                  const course = courses.find((c) => c.courseId === o.course_id);
                  const label =
                    course?.name ?? course?.distance ?? o.course_id;
                  return (
                    <TableRow key={o.course_id}>
                      <TableCell className="font-medium text-sm">
                        {label}
                      </TableCell>
                      <TableCell>
                        <TemplateSelect
                          value={o.template_certificate}
                          onChange={(v) => setOverrideCert(o.course_id, v)}
                          templates={templates}
                          type="certificate"
                          placeholder="← Dùng mặc định"
                        />
                      </TableCell>
                      <TableCell>
                        <TemplateSelect
                          value={o.template_share_card}
                          onChange={(v) => setOverrideShare(o.course_id, v)}
                          templates={templates}
                          type="share_card"
                          placeholder="← Dùng mặc định"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* No templates yet */}
      {templates.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm mb-3">
            Giải này chưa có template nào. Tạo template trước rồi quay lại cấu
            hình.
          </p>
          <Link
            href={`/certificates/new?raceId=${raceId}`}
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="size-3.5" />
            Tạo template đầu tiên
          </Link>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4 mr-2" />
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </Button>
      </div>
    </div>
  );
}
