"use client";

/**
 * F-024 Fix 2 — Contract edit dialog (DRAFT only).
 *
 * Hiển thị tab edit cho 4 section: Client / Race / Line items + VAT / Payment terms.
 * Gửi PATCH /api/contracts/:id với diff. Backend service.update() block nếu
 * status != DRAFT (BadRequestException → toast.error).
 *
 * KHÔNG cho edit:
 *   - provider (read-only sau create — BR-CM-01)
 *   - contractType / documentType / providerId (giữ immutable per business rule)
 *   - status (luôn DRAFT khi edit; chuyển trạng thái qua activate/cancel)
 *
 * Race: tái sử dụng `RacePicker` đầy đủ — 2 tab DB/Manual giống wizard.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calcTotals,
  formatVND,
  updateContract,
  type ContractView,
  type LatePenaltyUnit,
  type LineItemInput,
  type UpdateContractInput,
} from "@/lib/contracts-api";
import { RacePicker, type RacePickerValue } from "./race-picker";
import { LineItemsEditor } from "./line-items-editor";
import { FinancialSummary } from "./financial-summary";

type Props = {
  contract: ContractView;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: ContractView) => void;
};

type EditState = {
  client: ContractView["client"];
  race: RacePickerValue;
  lineItems: LineItemInput[];
  vatRate: number;
  advancePercentage: number;
  latePenaltyRate: number;
  latePenaltyUnit: LatePenaltyUnit;
  paymentDeadlineDays: number;
  signDate: string;
  effectiveDate: string;
  endDate: string;
};

function buildInitialState(c: ContractView): EditState {
  return {
    client: { ...c.client },
    race: c.raceName
      ? {
          raceId: c.raceId ?? undefined,
          raceName: c.raceName,
          raceDate: c.raceDate ?? undefined,
          raceLocation: c.raceLocation,
        }
      : null,
    lineItems: c.lineItems.map((li) => ({
      stt: li.stt,
      description: li.description,
      unit: li.unit,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      discount: li.discount ?? 0,
      selected: li.selected ?? true,
      note: li.note,
    })),
    vatRate: c.vatRate,
    advancePercentage: c.paymentTerms.advancePercentage,
    latePenaltyRate: c.paymentTerms.latePenaltyRate,
    latePenaltyUnit: c.paymentTerms.latePenaltyUnit,
    paymentDeadlineDays: c.paymentTerms.paymentDeadlineDays,
    signDate: c.signDate ? c.signDate.slice(0, 10) : "",
    effectiveDate: c.effectiveDate ? c.effectiveDate.slice(0, 10) : "",
    endDate: c.endDate ? c.endDate.slice(0, 10) : "",
  };
}

export function ContractEditDialog({ contract, open, onClose, onSaved }: Props) {
  const [state, setState] = useState<EditState>(() =>
    buildInitialState(contract),
  );
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("client");

  // Reset state khi mở lại với contract khác.
  useEffect(() => {
    if (open) {
      setState(buildInitialState(contract));
      setTab("client");
    }
  }, [open, contract]);

  const totals = useMemo(
    () => calcTotals(state.lineItems, state.vatRate),
    [state.lineItems, state.vatRate],
  );

  function patch<K extends keyof EditState>(k: K, v: EditState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    if (!state.client.entityName?.trim()) {
      toast.error("Tên đơn vị Bên A bắt buộc");
      setTab("client");
      return;
    }
    if (state.lineItems.length > 0 && !contract.revenueShare) {
      if (state.lineItems.some((li) => !li.description?.trim())) {
        toast.error("Mỗi hạng mục cần có mô tả");
        setTab("lineItems");
        return;
      }
    }

    setSaving(true);
    try {
      const input: UpdateContractInput = {
        client: state.client,
        // Race: nếu manual mode (raceId undefined) → send raceName/raceDate/raceLocation.
        // Nếu pick DB → send raceId + race* để service auto-fill từ Race entity (override).
        raceId: state.race?.raceId,
        raceName: state.race?.raceName ?? "",
        raceDate: state.race?.raceDate,
        raceLocation: state.race?.raceLocation,
        lineItems: contract.revenueShare ? undefined : state.lineItems,
        vatRate: state.vatRate,
        paymentTerms: {
          advancePercentage: state.advancePercentage,
          latePenaltyRate: state.latePenaltyRate,
          latePenaltyUnit: state.latePenaltyUnit,
          paymentDeadlineDays: state.paymentDeadlineDays,
        },
        signDate: state.signDate || undefined,
        effectiveDate: state.effectiveDate || undefined,
        endDate: state.endDate || undefined,
      };
      const updated = await updateContract(contract._id, input);
      toast.success("Đã lưu thay đổi");
      onSaved(updated);
      onClose();
    } catch (err) {
      const msg = (err as Error).message;
      // Friendly message khi backend block ACTIVE update.
      if (msg.toLowerCase().includes("draft")) {
        toast.error("Chỉ DRAFT mới sửa được — hợp đồng này đã kích hoạt");
      } else {
        toast.error(`Lỗi: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Chỉnh sửa hợp đồng nháp
            {contract.contractNumber && (
              <span className="ml-2 font-mono text-xs text-[var(--text-muted,#78716C)]">
                · {contract.contractNumber}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="client">Bên A</TabsTrigger>
            <TabsTrigger value="race">Giải đấu</TabsTrigger>
            {!contract.revenueShare && (
              <TabsTrigger value="lineItems">Hạng mục</TabsTrigger>
            )}
            <TabsTrigger value="payment">Thanh toán</TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="space-y-3 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField
                label="Tên đơn vị *"
                value={state.client.entityName}
                onChange={(v) =>
                  patch("client", { ...state.client, entityName: v })
                }
              />
              <EditField
                label="MST"
                value={state.client.taxId ?? ""}
                onChange={(v) =>
                  patch("client", { ...state.client, taxId: v })
                }
              />
              <EditField
                label="Địa chỉ"
                value={state.client.address ?? ""}
                onChange={(v) =>
                  patch("client", { ...state.client, address: v })
                }
                className="sm:col-span-2"
              />
              <EditField
                label="Đại diện"
                value={state.client.representative ?? ""}
                onChange={(v) =>
                  patch("client", { ...state.client, representative: v })
                }
              />
              <EditField
                label="Chức vụ"
                value={state.client.position ?? ""}
                onChange={(v) =>
                  patch("client", { ...state.client, position: v })
                }
              />
              <EditField
                label="Số TK"
                value={state.client.bankAccount ?? ""}
                onChange={(v) =>
                  patch("client", { ...state.client, bankAccount: v })
                }
              />
              <EditField
                label="Ngân hàng"
                value={state.client.bankName ?? ""}
                onChange={(v) =>
                  patch("client", { ...state.client, bankName: v })
                }
              />
              <EditField
                label="Điện thoại"
                value={state.client.phone ?? ""}
                onChange={(v) =>
                  patch("client", { ...state.client, phone: v })
                }
              />
              <EditField
                label="Email"
                value={state.client.email ?? ""}
                onChange={(v) =>
                  patch("client", { ...state.client, email: v })
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="race" className="space-y-3 pt-3">
            <p className="text-xs text-[var(--text-muted,#78716C)]">
              Có thể chọn từ danh sách hoặc nhập thủ công (race nhiều ngày, race
              chưa setup entity, v.v.).
            </p>
            <RacePicker
              value={state.race}
              onChange={(v) => patch("race", v)}
              allowManual
            />
          </TabsContent>

          {!contract.revenueShare && (
            <TabsContent value="lineItems" className="space-y-3 pt-3">
              <LineItemsEditor
                items={state.lineItems}
                onChange={(v) => patch("lineItems", v)}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <Label>VAT (%)</Label>
                  <Select
                    value={String(state.vatRate)}
                    onValueChange={(v) => patch("vatRate", Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="8">8% (mặc định)</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <FinancialSummary
                  subtotal={totals.subtotal}
                  vatRate={state.vatRate}
                  vatAmount={totals.vatAmount}
                  totalAmount={totals.totalAmount}
                />
              </div>
            </TabsContent>
          )}

          <TabsContent value="payment" className="space-y-3 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-advance-pct">% Tạm ứng</Label>
                <Input
                  id="edit-advance-pct"
                  type="number"
                  min={0}
                  max={100}
                  value={state.advancePercentage}
                  onChange={(e) =>
                    patch(
                      "advancePercentage",
                      Number(e.target.value) || 0,
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-deadline-days">
                  Hạn thanh toán sau nghiệm thu (ngày)
                </Label>
                <Input
                  id="edit-deadline-days"
                  type="number"
                  min={0}
                  value={state.paymentDeadlineDays}
                  onChange={(e) =>
                    patch(
                      "paymentDeadlineDays",
                      Number(e.target.value) || 0,
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-penalty-rate">Phạt chậm (%)</Label>
                <Input
                  id="edit-penalty-rate"
                  type="number"
                  min={0}
                  step={0.01}
                  value={state.latePenaltyRate}
                  onChange={(e) =>
                    patch("latePenaltyRate", Number(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-penalty-unit">Đơn vị phạt</Label>
                <Select
                  value={state.latePenaltyUnit}
                  onValueChange={(v) =>
                    patch("latePenaltyUnit", v as LatePenaltyUnit)
                  }
                >
                  <SelectTrigger id="edit-penalty-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_DAY">/ngày</SelectItem>
                    <SelectItem value="PER_YEAR">/năm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-sign-date">Ngày ký</Label>
                <Input
                  id="edit-sign-date"
                  type="date"
                  value={state.signDate}
                  onChange={(e) => patch("signDate", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-effective-date">Hiệu lực từ</Label>
                <Input
                  id="edit-effective-date"
                  type="date"
                  value={state.effectiveDate}
                  onChange={(e) => patch("effectiveDate", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-end-date">Đến hạn</Label>
                <Input
                  id="edit-end-date"
                  type="date"
                  value={state.endDate}
                  onChange={(e) => patch("endDate", e.target.value)}
                />
              </div>
            </div>
            {state.lineItems.length > 0 && !contract.revenueShare && (
              <p className="rounded border border-[var(--border,#E7E2D9)] bg-[#FAF8F5] px-3 py-2 text-xs text-[var(--text-muted,#78716C)]">
                Tổng giá trị mới:{" "}
                <strong>{formatVND(totals.totalAmount)}</strong> (server sẽ
                tính lại advance/remainder theo % tạm ứng).
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
