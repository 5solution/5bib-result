"use client";

/**
 * F-043 — Event-level fee override manager.
 *
 * Quản lý CRUD override mức phí theo từng sự kiện cho 1 merchant.
 * Hiển thị trong tab "Phí dịch vụ" của trang `/admin/merchants/[id]`,
 * ngay DƯỚI phần "Phí mặc định" hiện tại.
 *
 * Features:
 * - List overrides (sort by effective_from DESC)
 * - Add new override (race picker từ GET /merchants/:id/races)
 * - Edit existing override (raceId immutable)
 * - Delete override (confirm dialog)
 *
 * Pattern: raw fetch + authHeaders (consistent với merchants/[id]/page.tsx).
 * SDK regen sẽ replace fetch khi backend stable.
 */

import { useEffect, useState, useCallback } from "react";
import { authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Pencil, Trash2, Plus, AlertCircle, Calendar } from "lucide-react";
import { toast } from "sonner";

interface EventFeeOverride {
  raceId: number;
  raceName?: string | null;
  service_fee_rate: number | null;
  manual_fee_per_ticket: number | null;
  fee_vat_rate: number | null;
  effective_from: string;
  note: string | null;
  createdBy: number | null;
  createdAt?: string;
  updatedAt?: string;
}

interface RaceOption {
  race_id: number;
  title: string;
}

interface Props {
  tenantId: number;
  races: RaceOption[]; // passed from parent — already fetched
}

const API_BASE = `/api/merchants`;

export function EventFeeOverrideManager({ tenantId, races }: Props) {
  const [overrides, setOverrides] = useState<EventFeeOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRaceId, setEditingRaceId] = useState<number | null>(null);
  const [form, setForm] = useState({
    raceId: "",
    service_fee_rate: "",
    manual_fee_per_ticket: "",
    fee_vat_rate: "",
    effective_from: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const fetchOverrides = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/${tenantId}/event-fee-overrides`, {
        headers: await authHeaders(),
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error("Chỉ admin mới có quyền cấu hình override");
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as EventFeeOverride[];
      setOverrides(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void fetchOverrides();
  }, [fetchOverrides]);

  function resetForm() {
    setForm({
      raceId: "",
      service_fee_rate: "",
      manual_fee_per_ticket: "",
      fee_vat_rate: "",
      effective_from: "",
      note: "",
    });
    setEditingRaceId(null);
  }

  function openAddDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(o: EventFeeOverride) {
    setForm({
      raceId: String(o.raceId),
      service_fee_rate: o.service_fee_rate != null ? String(o.service_fee_rate) : "",
      manual_fee_per_ticket:
        o.manual_fee_per_ticket != null ? String(o.manual_fee_per_ticket) : "",
      fee_vat_rate: o.fee_vat_rate != null ? String(o.fee_vat_rate) : "",
      effective_from: o.effective_from,
      note: o.note ?? "",
    });
    setEditingRaceId(o.raceId);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        effective_from: form.effective_from,
      };
      if (!editingRaceId) {
        body.raceId = parseInt(form.raceId, 10);
      }
      if (form.service_fee_rate !== "") {
        body.service_fee_rate = parseFloat(form.service_fee_rate);
      } else {
        body.service_fee_rate = null;
      }
      if (form.manual_fee_per_ticket !== "") {
        body.manual_fee_per_ticket = parseInt(form.manual_fee_per_ticket, 10);
      } else {
        body.manual_fee_per_ticket = null;
      }
      if (form.fee_vat_rate !== "") {
        body.fee_vat_rate = parseFloat(form.fee_vat_rate);
      } else {
        body.fee_vat_rate = null;
      }
      if (form.note) body.note = form.note;

      const url = editingRaceId
        ? `${API_BASE}/${tenantId}/event-fee-overrides/${editingRaceId}`
        : `${API_BASE}/${tenantId}/event-fee-overrides`;
      const method = editingRaceId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          toast.error("Override cho sự kiện này đã tồn tại — vui lòng dùng nút Sửa");
        } else if (res.status === 400) {
          toast.error(data.message ?? "Dữ liệu không hợp lệ");
        } else if (res.status === 403) {
          toast.error("Chỉ admin mới có quyền cấu hình override");
        } else {
          toast.error(`Lỗi: HTTP ${res.status}`);
        }
        return;
      }

      toast.success(editingRaceId ? "Đã cập nhật override" : "Đã tạo override");
      setDialogOpen(false);
      resetForm();
      void fetchOverrides();
    } catch (e) {
      toast.error(`Lỗi: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(raceId: number) {
    try {
      const res = await fetch(`${API_BASE}/${tenantId}/event-fee-overrides/${raceId}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (!res.ok) {
        toast.error(`Lỗi xoá: HTTP ${res.status}`);
        return;
      }
      toast.success("Đã xoá override");
      setDeleteTarget(null);
      void fetchOverrides();
    } catch (e) {
      toast.error(`Lỗi: ${(e as Error).message}`);
    }
  }

  function formatVal(v: number | null, suffix: string): string {
    if (v == null) return "—";
    return `${v}${suffix}`;
  }

  function formatVND(v: number | null): string {
    if (v == null) return "—";
    return `${v.toLocaleString("vi-VN")} đ`;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">
            Cấu hình phí theo sự kiện ({overrides.length})
          </CardTitle>
          <CardDescription>
            Override mức phí áp dụng cho từng sự kiện cụ thể. Khi không có override,
            đối soát sẽ dùng phí mặc định của merchant.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="size-4 mr-1" />
          Thêm override
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-muted/40 rounded animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" />
            <span className="text-sm">{error}</span>
          </div>
        ) : overrides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="size-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">Chưa có override</p>
            <p className="text-xs mt-1">
              Mọi sự kiện đang dùng phí mặc định của merchant
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={openAddDialog}
            >
              <Plus className="size-4 mr-1" />
              Thêm override đầu tiên
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sự kiện</TableHead>
                <TableHead>Phí DV (%)</TableHead>
                <TableHead>Phí thủ công (VNĐ/vé)</TableHead>
                <TableHead>VAT (%)</TableHead>
                <TableHead>Hiệu lực từ</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((o) => (
                <TableRow key={o.raceId}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-medium truncate max-w-[200px]" title={o.raceName ?? ""}>
                        {o.raceName ?? "—"}
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        #{o.raceId}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{formatVal(o.service_fee_rate, "%")}</TableCell>
                  <TableCell>{formatVND(o.manual_fee_per_ticket)}</TableCell>
                  <TableCell>{formatVal(o.fee_vat_rate, "%")}</TableCell>
                  <TableCell className="text-sm">{o.effective_from}</TableCell>
                  <TableCell
                    className="text-sm truncate max-w-[150px]"
                    title={o.note ?? ""}
                  >
                    {o.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(o)}
                        title="Sửa"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteTarget(o.raceId)}
                        title="Xoá"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRaceId ? "Sửa override" : "Thêm override mới"}
            </DialogTitle>
            <DialogDescription>
              Để trống các field phí để dùng giá trị mặc định của merchant.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="raceId">Sự kiện *</Label>
              {editingRaceId ? (
                <div>
                  <Input value={`#${editingRaceId}`} disabled className="font-mono" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Không thể đổi sự kiện — vui lòng xoá và tạo mới
                  </p>
                </div>
              ) : (
                <Select
                  value={form.raceId}
                  onValueChange={(v) => setForm((f) => ({ ...f, raceId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn sự kiện..." />
                  </SelectTrigger>
                  <SelectContent>
                    {races.map((r) => (
                      <SelectItem key={r.race_id} value={String(r.race_id)}>
                        {r.title} (#{r.race_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rate">Phí DV (%)</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="Mặc định"
                  value={form.service_fee_rate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, service_fee_rate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual">Phí TC (VNĐ)</Label>
                <Input
                  id="manual"
                  type="number"
                  min="0"
                  placeholder="Mặc định"
                  value={form.manual_fee_per_ticket}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      manual_fee_per_ticket: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vat">VAT (%)</Label>
                <Input
                  id="vat"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="Mặc định"
                  value={form.fee_vat_rate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fee_vat_rate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from">Hiệu lực từ ngày *</Label>
              <Input
                id="from"
                type="date"
                value={form.effective_from}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effective_from: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Ghi chú</Label>
              <Input
                id="note"
                maxLength={200}
                placeholder="Lý do override..."
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !form.effective_from ||
                (!editingRaceId && !form.raceId)
              }
            >
              {submitting ? "Đang lưu..." : editingRaceId ? "Cập nhật" : "Lưu override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xoá override</DialogTitle>
            <DialogDescription>
              Sau khi xoá, đối soát mới của sự kiện này sẽ dùng phí mặc định của
              merchant. Đối soát đã tạo trước đó không bị ảnh hưởng.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Xoá override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
