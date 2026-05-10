"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { authHeaders } from "@/lib/api";
import { racesControllerCreateRace } from "@/lib/api-generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

/**
 * F-023 PAUSE-CODER-V23-DIALOG-EXTRACT — tách Dialog "Tạo giải mới" từ
 * `admin/src/app/(dashboard)/races/page.tsx` lines 247–312.
 *
 * KHÔNG đổi business logic: form 4 trường (title / slug / raceType / province)
 * + cacheTtlSeconds + 4 boolean flag mặc định (enableEcert/Claim/LiveTracking/5pix)
 * → mutation `racesControllerCreateRace`.
 *
 * Reusable từ Dashboard (header right action) + Races list page.
 */
type NewRaceState = {
  title: string;
  slug: string;
  status: string;
  raceType: string;
  cacheTtlSeconds: number;
  province?: string;
};

const initialState: NewRaceState = {
  title: "",
  slug: "",
  status: "draft",
  raceType: "running",
  cacheTtlSeconds: 60,
};

interface CreateRaceDialogProps {
  /** Element kích hoạt mở Dialog. Bắt buộc — caller render Button tuỳ ý. */
  trigger: ReactNode;
  /** Callback sau khi tạo thành công. Nhận về `raceId` nếu API trả về. */
  onSuccess?: (raceId?: string) => void;
}

export function CreateRaceDialog({ trigger, onSuccess }: CreateRaceDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewRaceState>(initialState);

  function update<K extends keyof NewRaceState>(key: K, value: NewRaceState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate() {
    if (!token || !form.title) return;
    setCreating(true);
    try {
      const slug =
        form.slug ||
        form.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      const { data, error } = await racesControllerCreateRace({
        body: {
          title: form.title,
          slug,
          status: form.status || "draft",
          raceType: form.raceType || "running",
          province: form.province,
          cacheTtlSeconds: form.cacheTtlSeconds ?? 60,
          enableEcert: false,
          enableClaim: false,
          enableLiveTracking: false,
          enable5pix: false,
        } as Parameters<typeof racesControllerCreateRace>[0]["body"],
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Tạo giải thành công!");
      const raceId = readRaceId(data);
      setOpen(false);
      setForm(initialState);
      onSuccess?.(raceId);
    } catch {
      toast.error("Tạo giải thất bại");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo giải chạy mới</DialogTitle>
          <DialogDescription>
            Nhập thông tin cơ bản để tạo giải chạy
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="race-title">Tên giải *</Label>
            <Input
              id="race-title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Vietnam Mountain Marathon 2026"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="race-slug">Đường dẫn SEO</Label>
            <Input
              id="race-slug"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
              placeholder="vietnam-mountain-marathon-2026"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Loại hình</Label>
            <Input
              value={form.raceType}
              onChange={(e) => update("raceType", e.target.value)}
              placeholder="running"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Tỉnh/Thành</Label>
            <Input
              value={form.province ?? ""}
              onChange={(e) => update("province", e.target.value)}
              placeholder="Hà Nội"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={creating || !form.title}>
            {creating ? "Đang tạo..." : "Tạo giải"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Đọc raceId từ payload API (best-effort — API trả nhiều shape khác nhau). */
function readRaceId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const inner = (payload as { data?: unknown }).data ?? payload;
  if (!inner || typeof inner !== "object") return undefined;
  const r = inner as { _id?: string; id?: string };
  return r._id ?? r.id;
}
