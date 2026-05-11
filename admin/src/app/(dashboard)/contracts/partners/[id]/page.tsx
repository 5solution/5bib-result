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

  const [form, setForm] = useState<CreatePartnerInput>(BLANK);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

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
        toast.success("Đã tạo");
        router.push(`/contracts/partners/${p._id}`);
      } else {
        await updatePartner(id, form);
        toast.success("Đã cập nhật");
      }
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Đang tải...</div>;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/contracts/partners")}
        >
          <ChevronLeft className="size-4" /> Quay lại
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? "Thêm đối tác" : form.entityName}
        </h1>
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
            />
          </div>
          <div>
            <Label htmlFor="bank-name">Ngân hàng</Label>
            <Input
              id="bank-name"
              value={form.bankName ?? ""}
              onChange={(e) => set("bankName", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="phone">Điện thoại</Label>
            <Input
              id="phone"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
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
        <div className="mt-6 flex justify-end">
          <Button onClick={submit} disabled={saving || !form.entityName.trim()}>
            {saving ? "Đang lưu..." : isNew ? "Tạo đối tác" : "Cập nhật"}
          </Button>
        </div>
      </div>
    </div>
  );
}
