"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import {
  getContractTemplate,
  importDocxToHtml,
  updateContractTemplate,
  validateContractTemplate,
  type ContractTemplate,
  type PartyAConfig,
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

export default function EditContractTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  // Next.js 16: params is async — unwrap via React.use() in client components.
  const { id } = use(params);
  const templateId = Number(id);

  const router = useRouter();
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [template, setTemplate] = useState<ContractTemplate | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [html, setHtml] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [withSample, setWithSample] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [unknownVars, setUnknownVars] = useState<string[]>([]);
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

  useEffect(() => {
    if (!token || !Number.isFinite(templateId)) return;
    (async () => {
      try {
        const t = await getContractTemplate(token, templateId);
        setTemplate(t);
        setName(t.template_name);
        setHtml(t.content_html);
        setIsActive(t.is_active);
        setPartyA({
          party_a_company_name: t.party_a_company_name ?? null,
          party_a_address: t.party_a_address ?? null,
          party_a_tax_code: t.party_a_tax_code ?? null,
          party_a_representative: t.party_a_representative ?? null,
          party_a_position: t.party_a_position ?? null,
        });
      } catch (err) {
        setLoadFailed(true);
        toast.error((err as Error).message);
      }
    })();
  }, [token, templateId]);

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
        // advisory
      }
    },
    [token],
  );

  useEffect(() => {
    if (!html) return;
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
    if (!token || !template) return;
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
      await updateContractTemplate(token, template.id, {
        template_name: name,
        content_html: html,
        variables: extractVariables(html),
        is_active: isActive,
        ...partyA,
      });
      toast.success("Đã cập nhật");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-96" />;
  if (loadFailed) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-6 text-sm text-red-900">
        Không tải được template. Có thể đã bị xóa hoặc ID không hợp lệ.
        <div className="mt-3">
          <Link href="/team-management/contract-templates">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 size-4" /> Quay lại danh sách
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  if (!template) return <Skeleton className="h-96" />;

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
          Sửa template
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
          {saving ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label>Tên template *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
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

      {/* Party A — configurable legal entity */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Thông tin Bên A (Pháp nhân ký)</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Điền để dùng biến{" "}
            <code className="text-blue-700">{"{{party_a_company_name}}"}</code>,{" "}
            <code className="text-blue-700">{"{{party_a_representative}}"}</code>
            … trong nội dung hợp đồng. Mỗi template có thể dùng pháp nhân khác nhau.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="pa_company">Tên công ty</Label>
            <Input
              id="pa_company"
              placeholder="VD: CÔNG TY CỔ PHẦN 5BIB"
              value={partyA.party_a_company_name ?? ""}
              onChange={(e) => setPartyA({ ...partyA, party_a_company_name: e.target.value || null })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pa_address">Địa chỉ</Label>
            <Input
              id="pa_address"
              placeholder="VD: Tầng 9, Tòa nhà Hồ Gươm Plaza..."
              value={partyA.party_a_address ?? ""}
              onChange={(e) => setPartyA({ ...partyA, party_a_address: e.target.value || null })}
            />
          </div>
          <div>
            <Label htmlFor="pa_tax">Mã số thuế</Label>
            <Input
              id="pa_tax"
              placeholder="VD: 0110398986"
              value={partyA.party_a_tax_code ?? ""}
              onChange={(e) => setPartyA({ ...partyA, party_a_tax_code: e.target.value || null })}
            />
          </div>
          <div>
            <Label htmlFor="pa_rep">Người đại diện</Label>
            <Input
              id="pa_rep"
              placeholder="VD: Nguyễn Bình Minh"
              value={partyA.party_a_representative ?? ""}
              onChange={(e) => setPartyA({ ...partyA, party_a_representative: e.target.value || null })}
            />
          </div>
          <div>
            <Label htmlFor="pa_pos">Chức vụ</Label>
            <Input
              id="pa_pos"
              placeholder="VD: Giám đốc"
              value={partyA.party_a_position ?? ""}
              onChange={(e) => setPartyA({ ...partyA, party_a_position: e.target.value || null })}
            />
          </div>
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
          <Label className="text-sm font-semibold">Nội dung</Label>
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

function extractVariables(html: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) set.add(m[1].trim());
  return Array.from(set);
}

/** Convert nullable PartyAConfig into a string-only override map for the preview. */
function partyAToOverrides(cfg: PartyAConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (v != null && v !== "") out[k] = v;
  }
  return out;
}
