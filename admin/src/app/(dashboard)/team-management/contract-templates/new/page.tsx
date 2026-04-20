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

const BLANK_TEMPLATE = `<h2>HỢP ĐỒNG CỘNG TÁC</h2>
<p>Họ tên: <strong>{{full_name}}</strong></p>
<p>CCCD: {{cccd}} · SĐT: {{phone}} · Email: {{email}}</p>
<p>Sự kiện: {{event_name}} · {{event_start_date}} → {{event_end_date}} · {{event_location}}</p>
<p>Vai trò: {{role_name}} · Số ngày: {{working_days}} · Đơn giá: {{daily_rate}}đ/ngày</p>
<p>Tổng thù lao: <strong>{{total_compensation}}đ</strong></p>
<p>Ngày ký: {{signed_date}}</p>`;

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
        // Only persist the variables that actually appear in the HTML
        // — keeps the stored list useful for downstream rendering.
        variables: extractVariables(html),
        is_active: isActive,
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
          <ContractPreview contentHtml={html} withSampleData={withSample} />
        </div>
      </div>
    </div>
  );
}

function extractVariables(html: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) set.add(m[1].trim());
  return Array.from(set);
}
