"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import {
  getAcceptanceTemplate,
  updateAcceptanceTemplate,
  type AcceptanceTemplate,
  type PartyAConfig,
} from "@/lib/team-api";
import ContractPreview from "@/components/ContractPreview";
import { ACCEPTANCE_VARIABLE_GROUPS } from "../../../acceptance-templates/new/page";

const ContractEditor = dynamic(() => import("@/components/ContractEditor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border bg-muted/20 p-8 text-sm text-muted-foreground">
      Đang tải trình soạn thảo...
    </div>
  ),
});

function partyAToOverrides(cfg: PartyAConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (v != null && v !== "") out[k] = v;
  }
  return out;
}

export default function EditAcceptanceTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const { id } = use(params);
  const templateId = Number(id);

  const router = useRouter();
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [template, setTemplate] = useState<AcceptanceTemplate | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [html, setHtml] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [withSample, setWithSample] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partyA, setPartyA] = useState<PartyAConfig>({
    party_a_company_name: null,
    party_a_address: null,
    party_a_tax_code: null,
    party_a_representative: null,
    party_a_position: null,
  });

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const t = await getAcceptanceTemplate(token, templateId);
      setTemplate(t);
      setName(t.template_name);
      setHtml(t.content_html);
      setIsDefault(t.is_default);
      setIsActive(t.is_active);
      setPartyA({
        party_a_company_name: t.party_a_company_name ?? null,
        party_a_address: t.party_a_address ?? null,
        party_a_tax_code: t.party_a_tax_code ?? null,
        party_a_representative: t.party_a_representative ?? null,
        party_a_position: t.party_a_position ?? null,
      });
    } catch {
      setLoadFailed(true);
      toast.error("Không tải được template");
    }
  }, [token, templateId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/sign-in");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const handleSave = useCallback(async () => {
    if (!token) return;
    if (!name.trim()) {
      toast.error("Tên template bắt buộc");
      return;
    }
    setSaving(true);
    try {
      await updateAcceptanceTemplate(token, templateId, {
        template_name: name.trim(),
        content_html: html,
        variables: ACCEPTANCE_VARIABLE_GROUPS.flatMap((g) =>
          g.items.map((i) => i.key),
        ),
        is_default: isDefault,
        is_active: isActive,
        ...partyA,
      });
      toast.success("Đã lưu");
      router.push("/team-management/contract-templates?tab=acceptance");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [token, templateId, name, html, isDefault, isActive, router]);

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;
  if (loadFailed)
    return (
      <div className="p-8 text-destructive">
        Không tải được template. <Link href="/team-management/contract-templates?tab=acceptance" className="underline">Quay lại</Link>
      </div>
    );
  if (!template) return <Skeleton className="h-64" />;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-0">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-3">
        <Link href="/team-management/contract-templates?tab=acceptance">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Quay lại
          </Button>
        </Link>
        <h1 className="font-display text-xl font-bold">
          Sửa mẫu biên bản nghiệm thu
        </h1>
        <div className="flex-1" />

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên template"
          className="w-64"
        />

        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Label className="text-sm">Mặc định</Label>
          <Switch checked={isDefault} onCheckedChange={setIsDefault} />
        </div>

        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Label className="text-sm">Đang dùng</Label>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Label className="text-sm">Dữ liệu mẫu</Label>
          <Switch checked={withSample} onCheckedChange={setWithSample} />
        </div>

        <Button onClick={() => void handleSave()} disabled={saving}>
          <Save className="mr-2 size-4" />
          {saving ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>

      {/* Editor + Preview split */}
      <div className="flex min-h-0 flex-1">
        <div className="w-1/2 overflow-y-auto border-r">
          {/* Party A config */}
          <div className="border-b bg-card/50 px-4 py-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Thông tin Bên A (pháp nhân ký)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Tên công ty</Label>
                <Input
                  placeholder="VD: CÔNG TY CỔ PHẦN 5BIB"
                  value={partyA.party_a_company_name ?? ""}
                  onChange={(e) => setPartyA({ ...partyA, party_a_company_name: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Địa chỉ</Label>
                <Input
                  placeholder="Địa chỉ công ty"
                  value={partyA.party_a_address ?? ""}
                  onChange={(e) => setPartyA({ ...partyA, party_a_address: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Mã số thuế</Label>
                <Input
                  placeholder="VD: 0110398986"
                  value={partyA.party_a_tax_code ?? ""}
                  onChange={(e) => setPartyA({ ...partyA, party_a_tax_code: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Người đại diện</Label>
                <Input
                  placeholder="VD: Nguyễn Bình Minh"
                  value={partyA.party_a_representative ?? ""}
                  onChange={(e) => setPartyA({ ...partyA, party_a_representative: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Chức vụ</Label>
                <Input
                  placeholder="VD: Giám đốc"
                  value={partyA.party_a_position ?? ""}
                  onChange={(e) => setPartyA({ ...partyA, party_a_position: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
          <ContractEditor
            initialContent={html}
            onChange={setHtml}
            placeholder="Nhập nội dung biên bản nghiệm thu..."
            variableGroups={ACCEPTANCE_VARIABLE_GROUPS}
          />
        </div>
        <div className="w-1/2 overflow-y-auto p-4">
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
