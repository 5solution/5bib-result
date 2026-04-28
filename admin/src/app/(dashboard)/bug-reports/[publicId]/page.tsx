"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import "@/lib/api";
import {
  bugReportsAdminControllerDetail,
  bugReportsAdminControllerUpdateStatus,
  bugReportsAdminControllerUpdateTriage,
  bugReportsAdminControllerSoftDelete,
} from "@/lib/api-generated";
import type { BugReportAdminDto } from "@/lib/api-generated";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/confirm-dialog";
import {
  ArrowLeft,
  Bug,
  Clock,
  ExternalLink,
  Mail,
  Phone,
  Globe,
  Monitor,
  Trash2,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  new: "Mới",
  triaged: "Đã triage",
  in_progress: "Đang xử lý",
  resolved: "Đã giải quyết",
  wont_fix: "Không fix",
  duplicate: "Trùng lặp",
  reopened: "Reopen",
};

const ALLOWED_NEXT: Record<string, string[]> = {
  new: ["triaged", "duplicate", "wont_fix"],
  triaged: ["in_progress", "duplicate", "wont_fix"],
  in_progress: ["resolved", "wont_fix", "duplicate"],
  resolved: ["reopened"],
  reopened: ["in_progress", "wont_fix"],
  wont_fix: ["reopened"],
  duplicate: [],
};

const SEVERITY_OPTIONS = [
  { value: "critical", label: "🔴 Khẩn cấp" },
  { value: "high", label: "🟠 Cao" },
  { value: "medium", label: "🟡 Trung bình" },
  { value: "low", label: "🟢 Thấp" },
  { value: "unknown", label: "❔ Không rõ" },
];

const CATEGORY_OPTIONS = [
  { value: "payment", label: "Thanh toán" },
  { value: "race_result", label: "Kết quả & xếp hạng" },
  { value: "bib_avatar", label: "BIB & Avatar" },
  { value: "account_login", label: "Tài khoản" },
  { value: "ui_display", label: "UI/Hiển thị" },
  { value: "mobile_app", label: "App di động" },
  { value: "other", label: "Khác" },
];

export default function BugReportDetailPage() {
  const router = useRouter();
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId;

  const [bug, setBug] = useState<BugReportAdminDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [statusReason, setStatusReason] = useState("");
  const [duplicateOf, setDuplicateOf] = useState("");
  const confirm = useConfirm();

  const refresh = () => {
    bugReportsAdminControllerDetail({ path: { publicId } })
      .then((res) => {
        if (res.data) setBug(res.data);
      })
      .catch((err) => toast.error(`Tải lỗi: ${(err as Error).message}`));
  };

  useEffect(() => {
    setLoading(true);
    bugReportsAdminControllerDetail({ path: { publicId } })
      .then((res) => {
        if (res.data) setBug(res.data);
        else toast.error("Không tìm thấy báo cáo");
      })
      .catch((err) => toast.error(`Tải lỗi: ${(err as Error).message}`))
      .finally(() => setLoading(false));
  }, [publicId]);

  if (loading) return <DetailSkeleton />;
  if (!bug) return <div className="p-6 text-muted-foreground">Không tìm thấy báo cáo.</div>;

  const allowedNext = ALLOWED_NEXT[bug.status] ?? [];

  const updateStatus = (toStatus: string) => {
    if (toStatus === "duplicate" && !duplicateOf.trim()) {
      toast.error("Cần nhập publicId của bug gốc khi đánh dấu duplicate");
      return;
    }
    startTransition(async () => {
      try {
        const res = await bugReportsAdminControllerUpdateStatus({
          path: { publicId },
          body: {
            toStatus: toStatus as "triaged",
            reason: statusReason.trim() || undefined,
            ...(toStatus === "duplicate" ? { duplicateOfPublicId: duplicateOf.trim() } : {}),
          },
        });
        if (res.data) {
          setBug(res.data);
          setStatusReason("");
          setDuplicateOf("");
          toast.success(`Đã chuyển trạng thái → ${STATUS_LABEL[toStatus] ?? toStatus}`);
        }
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  };

  const updateTriage = (field: "severity" | "category", value: string) => {
    startTransition(async () => {
      try {
        const res = await bugReportsAdminControllerUpdateTriage({
          path: { publicId },
          body: { [field]: value } as Parameters<typeof bugReportsAdminControllerUpdateTriage>[0]["body"],
        });
        if (res.data) {
          setBug(res.data);
          toast.success(`Đã cập nhật ${field}`);
        }
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Xóa báo cáo lỗi?",
      description: `Báo cáo ${bug.publicId} sẽ bị soft-delete và ẩn khỏi danh sách.`,
      confirmText: "Xóa",
      destructive: true,
    });
    if (!ok) return;
    try {
      await bugReportsAdminControllerSoftDelete({ path: { publicId } });
      toast.success("Đã xóa");
      router.push("/bug-reports");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/bug-reports")}>
          <ArrowLeft className="mr-1 size-4" />
          Danh sách
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Header */}
          <div className="rounded-lg border bg-white p-5">
            <div className="mb-2 flex items-center gap-3">
              <Bug className="size-5 text-rose-600" />
              <span className="font-mono text-sm font-bold text-blue-700">{bug.publicId}</span>
              <Badge>{STATUS_LABEL[bug.status] ?? bug.status}</Badge>
              {bug.isDeleted && <Badge variant="destructive">Đã xóa</Badge>}
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">{bug.title}</h1>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {new Date(bug.createdAt).toLocaleString("vi-VN")}
            </div>
          </div>

          {/* Description */}
          <Section title="Mô tả">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{bug.description}</p>
          </Section>

          {/* Steps */}
          {bug.stepsToReproduce && (
            <Section title="Bước tái tạo">
              <pre className="whitespace-pre-wrap rounded bg-stone-50 p-3 text-sm leading-relaxed">
                {bug.stepsToReproduce}
              </pre>
            </Section>
          )}

          {/* URL affected — only render as link if it's http(s); otherwise show
              as plain text. Prevents javascript:/data: URI XSS where an
              attacker submits a malicious URL hoping admin will click. */}
          {bug.urlAffected && (
            <Section title="URL gặp lỗi">
              {/^https?:\/\//i.test(bug.urlAffected) ? (
                <a
                  href={bug.urlAffected}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 break-all text-sm text-blue-700 hover:underline"
                >
                  {bug.urlAffected}
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
              ) : (
                <div className="break-all text-sm text-amber-800">
                  <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                    Không phải http(s)
                  </span>
                  {bug.urlAffected}
                </div>
              )}
            </Section>
          )}

          {/* Status history */}
          <Section title="Lịch sử trạng thái">
            <ol className="space-y-2.5">
              {bug.statusHistory.slice().reverse().map((h, i) => (
                <li key={i} className="flex items-start gap-3 border-b pb-2.5 last:border-b-0">
                  <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 text-xs">
                    <div>
                      <span className="font-semibold">
                        {h.fromStatus ? `${STATUS_LABEL[h.fromStatus]} → ` : ""}
                        {STATUS_LABEL[h.toStatus] ?? h.toStatus}
                      </span>
                      {h.changedByName && (
                        <span className="text-muted-foreground"> · bởi {h.changedByName}</span>
                      )}
                    </div>
                    {h.reason && <div className="mt-0.5 text-muted-foreground italic">"{h.reason}"</div>}
                    <div className="mt-0.5 text-muted-foreground">
                      {new Date(h.changedAt).toLocaleString("vi-VN")}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Reporter */}
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Reporter
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 text-muted-foreground" />
                <a href={`mailto:${bug.email}`} className="break-all text-blue-700 hover:underline">
                  {bug.email}
                </a>
              </div>
              {bug.phoneNumber && (
                <div className="flex items-center gap-2">
                  <Phone className="size-3.5 text-muted-foreground" />
                  <a href={`tel:${bug.phoneNumber}`} className="hover:underline">{bug.phoneNumber}</a>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Đăng ký nhận update: {bug.wantsUpdates ? "Có" : "Không"}
              </div>
            </div>
          </div>

          {/* Triage */}
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Triage
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold">Severity</label>
                <Select value={bug.severity} onValueChange={(v) => updateTriage("severity", v)} disabled={pending}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Category</label>
                <Select value={bug.category} onValueChange={(v) => updateTriage("category", v)} disabled={pending}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Status change */}
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Chuyển trạng thái
            </div>
            {allowedNext.length === 0 ? (
              <div className="text-xs text-muted-foreground">Trạng thái terminal — không thể chuyển.</div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  placeholder="Lý do (optional)"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
                {allowedNext.includes("duplicate") && (
                  <Input
                    placeholder="Nếu duplicate: BUG-YYYYMMDD-NNNN"
                    value={duplicateOf}
                    onChange={(e) => setDuplicateOf(e.target.value)}
                  />
                )}
                <div className="flex flex-col gap-1.5">
                  {allowedNext.map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => updateStatus(s)}
                      className="justify-start"
                    >
                      → {STATUS_LABEL[s] ?? s}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Debug metadata
            </div>
            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              {bug.viewport && (
                <div className="flex items-start gap-2">
                  <Monitor className="mt-0.5 size-3 shrink-0" />
                  <span>{bug.viewport}</span>
                </div>
              )}
              {bug.referrer && (
                <div className="flex items-start gap-2">
                  <Globe className="mt-0.5 size-3 shrink-0" />
                  <span className="break-all">{bug.referrer}</span>
                </div>
              )}
              {bug.userAgent && (
                <div className="break-all opacity-70">UA: {bug.userAgent}</div>
              )}
              <div className="opacity-70">IP: {bug.ipAddress}</div>
            </div>
          </div>

          {/* Danger zone */}
          {!bug.isDeleted && (
            <Button variant="destructive" size="sm" onClick={handleDelete} className="w-full">
              <Trash2 className="mr-1.5 size-4" />
              Xóa báo cáo
            </Button>
          )}

          {bug.duplicateOfPublicId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Bug này được đánh dấu duplicate của:{" "}
              <Link
                href={`/bug-reports/${bug.duplicateOfPublicId}`}
                className="font-mono font-bold underline"
              >
                {bug.duplicateOfPublicId}
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-32" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
