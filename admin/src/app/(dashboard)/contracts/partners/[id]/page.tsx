"use client";

/**
 * F-024 Partner edit page.
 *
 * Special id: "new" → create form. Otherwise load existing + edit.
 */
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft } from "lucide-react";
import {
  createPartner,
  getPartner,
  updatePartner,
  type CreatePartnerInput,
} from "@/lib/contracts-api";
import { useSetCrumb } from "@/components/admin-shell/breadcrumb-context";
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { DetailSkeleton } from "../../_components/detail-skeleton";

const BLANK: CreatePartnerInput = {
  entityName: "",
  shortName: "",
  taxId: "",
  address: "",
  representative: "",
  position: "",
  bankAccount: "",
  bankName: "",
  phone: "",
  email: "",
  notes: "",
};

export default function PartnerEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const isNew = id === "new";
  // F-029 BR-HD-30 — page-level RBAC gate `isStaff || isFinance` (F-078 widen).
  const { isStaff, isFinance, isLoading: authLoading } = useAuth();

  const [form, setForm] = useState<CreatePartnerInput>(BLANK);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // UX-01/UX-05: dynamic crumb cho segment id — không bao giờ show raw ObjectId.
  useSetCrumb(id, isNew ? "Thêm mới" : form.entityName || "Chi tiết");

  // UX-04: set tab title (browser tab) theo tên partner
  useEffect(() => {
    if (isNew) {
      document.title = "Thêm đối tác · 5BIB Admin";
      return;
    }
    if (form.entityName) {
      document.title = `${form.entityName} · Đối tác · 5BIB Admin`;
    }
  }, [isNew, form.entityName]);

  useEffect(() => {
    if (isNew) return;
    getPartner(id)
      .then((p) =>
        setForm({
          entityName: p.entityName,
          shortName: p.shortName ?? "",
          taxId: p.taxId ?? "",
          address: p.address ?? "",
          representative: p.representative ?? "",
          position: p.position ?? "",
          bankAccount: p.bankAccount ?? "",
          bankName: p.bankName ?? "",
          phone: p.phone ?? "",
          email: p.email ?? "",
          notes: p.notes ?? "",
        }),
      )
      .catch((err) => toast.error(`Lỗi: ${err.message}`))
      .finally(() => setLoading(false));
  }, [isNew, id]);

  function set<K extends keyof CreatePartnerInput>(
    k: K,
    v: CreatePartnerInput[K],
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.entityName.trim()) {
      toast.error("Tên đối tác bắt buộc");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const p = await createPartner(form);
        // UX-02: dùng id + duration 2500ms để toast tự clear trước khi user
        // kịp click Cập nhật ở detail page mới.
        toast.success("Đã tạo đối tác", {
          id: "create-partner",
          duration: 2500,
        });
        router.push(`/contracts/partners/${p._id}`);
      } else {
        await updatePartner(id, form);
        toast.success("Đã cập nhật", {
          id: "update-partner",
          duration: 2500,
        });
      }
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return null;
  if (!isStaff && !isFinance) return <RestrictedAccess />;
  if (loading) return <DetailSkeleton sections={2} />;

  return (
    <div className="space-y-4 p-6">
      {/* UX-06: stacked layout matching acceptance/payment pattern — button + 2-line title */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/contracts/partners")}
        >
          <ChevronLeft className="size-4" /> Danh sách đối tác
        </Button>
        <div>
          {/* UX-05: title FIXED — không phụ thuộc input value */}
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "Thêm đối tác" : "Chỉnh sửa đối tác"}
          </h1>
          {!isNew && (
            <p className="font-mono text-xs text-[var(--text-muted,#78716C)]">
              {form.entityName || "—"}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="entity-name">Tên đơn vị *</Label>
            <Input
              id="entity-name"
              value={form.entityName}
              onChange={(e) => set("entityName", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="short-name">Tên viết tắt</Label>
            <Input
              id="short-name"
              value={form.shortName ?? ""}
              onChange={(e) => set("shortName", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="tax-id">MST</Label>
            <Input
              id="tax-id"
              value={form.taxId ?? ""}
              onChange={(e) => set("taxId", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="address">Địa chỉ</Label>
            <Input
              id="address"
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="rep">Đại diện</Label>
            <Input
              id="rep"
              value={form.representative ?? ""}
              onChange={(e) => set("representative", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pos">Chức vụ</Label>
            <Input
              id="pos"
              value={form.position ?? ""}
              onChange={(e) => set("position", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="bank-acc">Số TK</Label>
            <Input
              id="bank-acc"
              value={form.bankAccount ?? ""}
              onChange={(e) => set("bankAccount", e.target.value)}
              placeholder="Tuỳ chọn — vd: 1234567890"
            />
          </div>
          <div>
            <Label htmlFor="bank-name">Ngân hàng</Label>
            <Input
              id="bank-name"
              value={form.bankName ?? ""}
              onChange={(e) => set("bankName", e.target.value)}
              placeholder="Tuỳ chọn — vd: Vietcombank CN HN"
            />
          </div>
          <div>
            <Label htmlFor="phone">Điện thoại</Label>
            <Input
              id="phone"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="Tuỳ chọn — vd: 0987654321"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
              placeholder="Tuỳ chọn — vd: lien.he@partner.vn"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>
      {/* UX-13 sticky bottom save (form dài có thể vượt 1 màn) */}
      <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-[var(--border,#E7E2D9)] bg-white/95 px-6 py-3 backdrop-blur">
        <Button
          variant="outline"
          onClick={() => router.push("/contracts/partners")}
          disabled={saving}
        >
          Huỷ
        </Button>
        <Button onClick={submit} disabled={saving || !form.entityName.trim()}>
          {saving ? "Đang lưu..." : isNew ? "Tạo đối tác" : "Cập nhật"}
        </Button>
      </div>
    </div>
  );
}
