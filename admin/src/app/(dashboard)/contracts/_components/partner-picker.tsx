"use client";

/**
 * F-024 Partner Picker — search existing partners or "Tạo mới" inline form.
 *
 * Returns a `PartnerView` to caller; wizard step 2 uses this to auto-fill
 * `client` info.
 */
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import {
  createPartner,
  listPartners,
  type CreatePartnerInput,
  type PartnerView,
} from "@/lib/contracts-api";

type Props = {
  value: PartnerView | null;
  onChange: (p: PartnerView) => void;
};

export function PartnerPicker({ value, onChange }: Props) {
  const [partners, setPartners] = useState<PartnerView[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      listPartners({ q: q.trim() || undefined, limit: 20 })
        .then((res) => {
          if (alive) setPartners(res.items);
        })
        .catch((err) => {
          if (alive) toast.error(`Không tải được đối tác: ${err.message}`);
        })
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted,#78716C)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên / MST"
            className="pl-8"
            aria-label="Tìm đối tác"
          />
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button type="button" variant="outline" />}>
            <Plus className="size-4" /> Tạo mới
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo đối tác mới</DialogTitle>
            </DialogHeader>
            <CreatePartnerForm
              onCreated={(p) => {
                setCreateOpen(false);
                setPartners((prev) => [p, ...prev]);
                onChange(p);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-md border border-[var(--border,#E7E2D9)] bg-white">
        {loading ? (
          <div className="p-4 text-center text-sm text-[var(--text-muted,#78716C)]">
            Đang tải...
          </div>
        ) : partners.length === 0 ? (
          <div className="p-4 text-center text-sm text-[var(--text-muted,#78716C)]">
            Không tìm thấy đối tác — bấm "Tạo mới"
          </div>
        ) : (
          <ul>
            {partners.map((p) => (
              <li key={p._id}>
                <button
                  type="button"
                  onClick={() => onChange(p)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-[#F3F0EB] ${
                    value?._id === p._id
                      ? "bg-[#E6ECFF] font-semibold"
                      : ""
                  }`}
                >
                  <div className="font-medium">{p.entityName}</div>
                  <div className="font-mono text-xs text-[var(--text-muted,#78716C)]">
                    {p.taxId || "—"} · {p.representative || "—"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CreatePartnerForm({
  onCreated,
}: {
  onCreated: (p: PartnerView) => void;
}) {
  const [form, setForm] = useState<CreatePartnerInput>({
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
  });
  const [saving, setSaving] = useState(false);

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
      const p = await createPartner(form);
      toast.success("Đã tạo đối tác", {
        id: "create-partner",
        duration: 2500,
      });
      onCreated(p);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="p-name">Tên đối tác *</Label>
        <Input
          id="p-name"
          value={form.entityName}
          onChange={(e) => set("entityName", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="p-short">Tên viết tắt</Label>
          <Input
            id="p-short"
            value={form.shortName ?? ""}
            onChange={(e) => set("shortName", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="p-mst">MST</Label>
          <Input
            id="p-mst"
            value={form.taxId ?? ""}
            onChange={(e) => set("taxId", e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="p-addr">Địa chỉ</Label>
        <Input
          id="p-addr"
          value={form.address ?? ""}
          onChange={(e) => set("address", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="p-rep">Đại diện</Label>
          <Input
            id="p-rep"
            value={form.representative ?? ""}
            onChange={(e) => set("representative", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="p-pos">Chức vụ</Label>
          <Input
            id="p-pos"
            value={form.position ?? ""}
            onChange={(e) => set("position", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="p-bank-acc">Số TK</Label>
          <Input
            id="p-bank-acc"
            value={form.bankAccount ?? ""}
            onChange={(e) => set("bankAccount", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="p-bank-name">Tên ngân hàng</Label>
          <Input
            id="p-bank-name"
            value={form.bankName ?? ""}
            onChange={(e) => set("bankName", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="p-phone">Điện thoại</Label>
          <Input
            id="p-phone"
            value={form.phone ?? ""}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="p-email">Email</Label>
          <Input
            id="p-email"
            type="email"
            value={form.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving || !form.entityName.trim()}>
          {saving ? "Đang lưu..." : "Tạo đối tác"}
        </Button>
      </DialogFooter>
    </div>
  );
}
