"use client";

/**
 * F-024 Contract Wizard — 6 step (PRD Screen 2).
 *
 * Step 1: Loại + Provider + Source
 * Step 2: Đối tác (Client) — pick or inline create, auto-fill
 * Step 3: Race (optional) — search + auto-fill
 * Step 4: Hạng mục & Giá — line items OR revenue share
 * Step 5: Điều khoản thanh toán
 * Step 6: Review & Submit
 *
 * Step navigation: KHÔNG cho skip forward (PRD: "cannot skip forward without
 * completing current step"). "Quay lại" miễn phí. Step 1 validate: contractType
 * + provider chosen. Step 2: client.entityName required. Step 3: optional.
 * Step 4: must have ≥1 lineItem OR revenueShare. Step 5: defaults pre-filled.
 *
 * Cancel: confirm dialog → router.back().
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderPicker } from "./provider-picker";
import { PartnerPicker } from "./partner-picker";
import { RacePicker, type RacePickerValue } from "./race-picker";
import { LineItemsEditor } from "./line-items-editor";
import { RevenueShareForm } from "./revenue-share-form";
import { FinancialSummary } from "./financial-summary";
import { ServiceCatalogPicker } from "./service-catalog-picker";
import {
  calcTotals,
  createContract,
  formatVND,
  type ContractType,
  type CreateContractInput,
  type LineItemInput,
  type PartnerView,
  type ProviderId,
  type RevenueShare,
} from "@/lib/contracts-api";
import { ChevronLeft, ChevronRight, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/confirm-dialog";

const STEPS = [
  "Loại & Provider",
  "Đối tác",
  "Giải đấu",
  "Hạng mục & Giá",
  "Thanh toán",
  "Xem lại & Tạo",
];

type State = {
  contractType: ContractType;
  documentType: "QUOTATION" | "CONTRACT";
  providerId: ProviderId;
  partner: PartnerView | null;
  client: CreateContractInput["client"];
  race: RacePickerValue;
  lineItems: LineItemInput[];
  revenueShare: RevenueShare;
  vatRate: number;
  advancePercentage: number;
  latePenaltyRate: number;
  latePenaltyUnit: "PER_DAY" | "PER_YEAR";
  paymentDeadlineDays: number;
  signDate: string;
  effectiveDate: string;
  endDate: string;
};

const DEFAULT_STATE: State = {
  contractType: "TIMING",
  documentType: "CONTRACT",
  providerId: "5BIB",
  partner: null,
  client: {
    entityName: "",
    taxId: "",
    address: "",
    representative: "",
    position: "",
    bankAccount: "",
    bankName: "",
    phone: "",
    email: "",
  },
  race: null,
  lineItems: [],
  revenueShare: { feePercentage: 0, feePerAthlete: 0, estimatedAthletes: 0 },
  vatRate: 8,
  advancePercentage: 50,
  latePenaltyRate: 0.02,
  latePenaltyUnit: "PER_DAY",
  paymentDeadlineDays: 15,
  signDate: new Date().toISOString().slice(0, 10),
  effectiveDate: new Date().toISOString().slice(0, 10),
  endDate: "",
};

function defaultProviderFor(type: ContractType): ProviderId {
  return type === "OPERATIONS" ? "5SOLUTION" : "5BIB";
}

function defaultLatePenaltyFor(type: ContractType): {
  rate: number;
  unit: "PER_DAY" | "PER_YEAR";
} {
  if (type === "OPERATIONS") return { rate: 12, unit: "PER_YEAR" };
  return { rate: 0.02, unit: "PER_DAY" };
}

export function ContractWizard() {
  const router = useRouter();
  const confirm = useConfirm();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);

  const isRevenueShare = state.contractType === "TICKET_SALES";

  const totals = useMemo(
    () => calcTotals(state.lineItems, state.vatRate),
    [state.lineItems, state.vatRate],
  );

  function patch<K extends keyof State>(k: K, v: State[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  function onContractTypeChange(t: ContractType) {
    setState((s) => {
      const lp = defaultLatePenaltyFor(t);
      return {
        ...s,
        contractType: t,
        providerId: defaultProviderFor(t),
        latePenaltyRate: lp.rate,
        latePenaltyUnit: lp.unit,
        // Reset advance for revenue-share — TICKET_SALES default 0% advance
        advancePercentage: t === "TICKET_SALES" ? 0 : 50,
      };
    });
  }

  function onPartnerPick(p: PartnerView) {
    setState((s) => ({
      ...s,
      partner: p,
      client: {
        entityName: p.entityName,
        taxId: p.taxId ?? "",
        address: p.address ?? "",
        representative: p.representative ?? "",
        position: p.position ?? "",
        bankAccount: p.bankAccount ?? "",
        bankName: p.bankName ?? "",
        phone: p.phone ?? "",
        email: p.email ?? "",
      },
    }));
  }

  function validateStep(n: number): string | null {
    if (n === 1) {
      if (!state.contractType) return "Chọn loại hợp đồng";
      if (!state.providerId) return "Chọn provider";
    }
    if (n === 2) {
      if (!state.client.entityName?.trim()) return "Tên đối tác bắt buộc";
    }
    if (n === 3) {
      // optional — no validation
    }
    if (n === 4) {
      if (isRevenueShare) {
        if (
          !state.revenueShare.feePercentage &&
          !state.revenueShare.feePerAthlete
        )
          return "Nhập ít nhất 1 trong 2: % phí hoặc phí/VĐV";
      } else {
        if (state.lineItems.length === 0) return "Cần ít nhất 1 hạng mục";
        if (state.lineItems.some((it) => !it.description?.trim()))
          return "Mỗi hạng mục cần mô tả";
      }
    }
    if (n === 5) {
      if (![0, 8, 10].includes(state.vatRate))
        return "VAT phải là 0%, 8% hoặc 10%";
      if (state.advancePercentage < 0 || state.advancePercentage > 100)
        return "Tạm ứng 0–100%";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  }

  function prev() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit(activate: boolean) {
    // Re-validate everything
    for (let i = 1; i <= 5; i++) {
      const err = validateStep(i);
      if (err) {
        toast.error(`Step ${i}: ${err}`);
        setStep(i);
        return;
      }
    }
    setSubmitting(true);
    try {
      const input: CreateContractInput = {
        contractType: state.contractType,
        documentType: state.documentType,
        providerId: state.providerId,
        partnerId: state.partner?._id,
        client: state.client,
        raceId: state.race?.raceId,
        raceName: state.race?.raceName,
        raceDate: state.race?.raceDate,
        raceLocation: state.race?.raceLocation,
        signDate: state.signDate,
        effectiveDate: state.effectiveDate || undefined,
        endDate: state.endDate || undefined,
        vatRate: state.vatRate,
        paymentTerms: {
          advancePercentage: state.advancePercentage,
          latePenaltyRate: state.latePenaltyRate,
          latePenaltyUnit: state.latePenaltyUnit,
          paymentDeadlineDays: state.paymentDeadlineDays,
        },
        ...(isRevenueShare
          ? { revenueShare: state.revenueShare }
          : { lineItems: state.lineItems }),
      };
      const c = await createContract(input);
      if (activate && c.status === "DRAFT") {
        // Trigger activate via subsequent call — keeps API surface clean.
        const { activateContract } = await import("@/lib/contracts-api");
        const next = await activateContract(c._id);
        // UX-03 toast post-navigate: id + duration 2500ms để clear nhanh.
        toast.success(
          `Đã tạo + kích hoạt: ${next.contractNumber ?? next._id}`,
          { id: "create-contract", duration: 2500 },
        );
        router.push(`/contracts/${next._id}`);
      } else {
        toast.success(`Đã tạo nháp: ${c.contractNumber ?? c._id}`, {
          id: "create-contract",
          duration: 2500,
        });
        router.push(`/contracts/${c._id}`);
      }
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    if (
      state.client.entityName ||
      state.lineItems.length > 0 ||
      state.revenueShare.feePercentage
    ) {
      const ok = await confirm({
        title: "Huỷ tạo hợp đồng?",
        description: "Dữ liệu chưa lưu sẽ bị mất. Tiếp tục huỷ?",
        confirmText: "Huỷ tạo",
        cancelText: "Tiếp tục soạn",
        variant: "destructive",
      });
      if (!ok) return;
    }
    router.push("/contracts");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Tạo hợp đồng mới
          </h1>
          <p className="text-sm text-[var(--text-muted,#78716C)]">
            Bước {step} / {STEPS.length}: {STEPS[step - 1]}
          </p>
        </div>
        <Button variant="ghost" onClick={cancel}>
          <X className="size-4" /> Huỷ
        </Button>
      </div>

      <Stepper current={step} />

      <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white p-6">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Label>Loại hợp đồng</Label>
              <Select
                value={state.contractType}
                onValueChange={(v) => onContractTypeChange(v as ContractType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TIMING">Dịch vụ tính giờ</SelectItem>
                  <SelectItem value="RACEKIT">Vận hành racekit</SelectItem>
                  <SelectItem value="OPERATIONS">Vận hành sự kiện</SelectItem>
                  <SelectItem value="TICKET_SALES">Bán vé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Loại tài liệu</Label>
              <Select
                value={state.documentType}
                onValueChange={(v) =>
                  patch("documentType", v as "QUOTATION" | "CONTRACT")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTRACT">Hợp đồng</SelectItem>
                  <SelectItem value="QUOTATION">Báo giá</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Provider (đơn vị cung cấp dịch vụ)</Label>
              <ProviderPicker
                value={state.providerId}
                onChange={(id) => patch("providerId", id)}
                contractType={state.contractType}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <Label>Chọn đối tác từ danh sách hoặc tạo mới</Label>
              <PartnerPicker value={state.partner} onChange={onPartnerPick} />
            </div>
            <hr className="border-[var(--border,#E7E2D9)]" />
            <div>
              <Label className="text-sm font-semibold">
                Thông tin đối tác (có thể chỉnh sửa sau khi auto-fill)
              </Label>
              {/* UX-19: warning khi user sửa entityName khác với partner đã pick.
                  Backend snapshot client info → contract dùng tên mới này khi sinh
                  số HĐ, KHÔNG dùng partner.entityName gốc. Set expectation rõ. */}
              {state.partner &&
                state.partner.entityName !== state.client.entityName && (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Bạn đã sửa tên đơn vị khác với đối tác đã chọn ("
                    {state.partner.entityName}"). Số HĐ + DOCX sẽ dùng tên mới
                    này, KHÔNG dùng tên gốc. Tiếp tục nếu đó là chủ đích.
                  </p>
                )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <FormField
                  label="Tên đơn vị *"
                  value={state.client.entityName}
                  onChange={(v) =>
                    patch("client", { ...state.client, entityName: v })
                  }
                />
                <FormField
                  label="MST"
                  value={state.client.taxId ?? ""}
                  onChange={(v) =>
                    patch("client", { ...state.client, taxId: v })
                  }
                />
                <FormField
                  label="Địa chỉ"
                  value={state.client.address ?? ""}
                  onChange={(v) =>
                    patch("client", { ...state.client, address: v })
                  }
                  className="sm:col-span-2"
                />
                <FormField
                  label="Đại diện"
                  value={state.client.representative ?? ""}
                  onChange={(v) =>
                    patch("client", { ...state.client, representative: v })
                  }
                />
                <FormField
                  label="Chức vụ"
                  value={state.client.position ?? ""}
                  onChange={(v) =>
                    patch("client", { ...state.client, position: v })
                  }
                />
                <FormField
                  label="Số TK"
                  value={state.client.bankAccount ?? ""}
                  onChange={(v) =>
                    patch("client", { ...state.client, bankAccount: v })
                  }
                />
                <FormField
                  label="Tên ngân hàng"
                  value={state.client.bankName ?? ""}
                  onChange={(v) =>
                    patch("client", { ...state.client, bankName: v })
                  }
                />
                <FormField
                  label="Điện thoại"
                  value={state.client.phone ?? ""}
                  onChange={(v) =>
                    patch("client", { ...state.client, phone: v })
                  }
                />
                <FormField
                  label="Email"
                  value={state.client.email ?? ""}
                  onChange={(v) =>
                    patch("client", { ...state.client, email: v })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <Label>Chọn giải đấu (tuỳ chọn)</Label>
              <p className="mb-2 text-xs text-[var(--text-muted,#78716C)]">
                Hợp đồng vận hành/báo giá có thể không gắn race cụ thể.
              </p>
              <RacePicker value={state.race} onChange={(v) => patch("race", v)} />
            </div>
            {state.race && (
              <div className="rounded-md bg-[#F3F0EB] p-3 text-sm">
                <div>
                  <strong>Tên race:</strong> {state.race.raceName}
                </div>
                {state.race.raceDate && (
                  <div>
                    <strong>Ngày:</strong> {state.race.raceDate.slice(0, 10)}
                  </div>
                )}
                {state.race.raceLocation && (
                  <div>
                    <strong>Địa điểm:</strong> {state.race.raceLocation}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            {isRevenueShare ? (
              <RevenueShareForm
                value={state.revenueShare}
                onChange={(v) => patch("revenueShare", v)}
              />
            ) : (
              <>
                <LineItemsEditor
                  items={state.lineItems}
                  onChange={(v) => patch("lineItems", v)}
                  onPickFromCatalog={() => setCatalogPickerOpen(true)}
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
              </>
            )}
            <ServiceCatalogPicker
              open={catalogPickerOpen}
              onClose={() => setCatalogPickerOpen(false)}
              contractType={state.contractType}
              onPick={(item) => {
                const next = [
                  ...state.lineItems,
                  { ...item, stt: state.lineItems.length + 1 },
                ];
                patch("lineItems", next);
              }}
            />
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="advance-pct">% Tạm ứng</Label>
              <Input
                id="advance-pct"
                type="number"
                min={0}
                max={100}
                value={state.advancePercentage}
                onChange={(e) =>
                  patch("advancePercentage", Number(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label htmlFor="deadline-days">Hạn thanh toán sau nghiệm thu (ngày)</Label>
              <Input
                id="deadline-days"
                type="number"
                min={0}
                value={state.paymentDeadlineDays}
                onChange={(e) =>
                  patch("paymentDeadlineDays", Number(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label htmlFor="penalty-rate">Phạt chậm thanh toán (%)</Label>
              <Input
                id="penalty-rate"
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
              <Label htmlFor="penalty-unit">Đơn vị phạt</Label>
              <Select
                value={state.latePenaltyUnit}
                onValueChange={(v) =>
                  patch("latePenaltyUnit", v as "PER_DAY" | "PER_YEAR")
                }
              >
                <SelectTrigger id="penalty-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_DAY">/ngày</SelectItem>
                  <SelectItem value="PER_YEAR">/năm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sign-date">Ngày ký</Label>
              <Input
                id="sign-date"
                type="date"
                value={state.signDate}
                onChange={(e) => patch("signDate", e.target.value)}
              />
              <p className="mt-1 font-mono text-xs text-[var(--text-muted,#78716C)]">
                Số HĐ dự kiến: {formatContractNumberPreview(state)}
              </p>
            </div>
            <div>
              <Label htmlFor="effective-date">Hiệu lực từ</Label>
              <Input
                id="effective-date"
                type="date"
                value={state.effectiveDate}
                onChange={(e) => patch("effectiveDate", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date">Đến hạn (tuỳ chọn)</Label>
              <Input
                id="end-date"
                type="date"
                value={state.endDate}
                onChange={(e) => patch("endDate", e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 6 && <ReviewStep state={state} totals={totals} />}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prev}
          disabled={step === 1 || submitting}
        >
          <ChevronLeft className="size-4" /> Quay lại
        </Button>
        {step < STEPS.length ? (
          <Button onClick={next} disabled={submitting}>
            Tiếp tục <ChevronRight className="size-4" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => submit(false)}
              disabled={submitting}
            >
              Tạo nháp
            </Button>
            <Button
              onClick={() => submit(true)}
              disabled={submitting}
              data-testid="btn-finalize-create-active"
            >
              <CheckCircle2 className="size-4" /> Tạo & Kích hoạt
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {STEPS.map((label, idx) => {
        const stepNum = idx + 1;
        const active = stepNum === current;
        const done = stepNum < current;
        return (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5",
              active && "border-[var(--admin-blue,#1D49FF)] bg-[#E6ECFF] font-semibold",
              done && "border-green-600 bg-green-50 text-green-700",
              !active && !done && "border-[var(--border,#E7E2D9)] text-[var(--text-muted,#78716C)]",
            )}
          >
            <span className="font-mono">{stepNum}</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function FormField({
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

/**
 * F-024 UX-07: Wizard preview KHỚP backend ContractsService.activate() logic:
 *   1) split entityName theo whitespace
 *   2) take first char of each word (KHÔNG strip diacritic trước)
 *   3) join → replace non-alphanumeric (strip diacritics + Vietnamese đ/Đ)
 *   4) uppercase + slice 8
 *
 * Trước đây frontend strip non-ASCII TRƯỚC split → "Đại Việt" → "i Vit" → "iV"
 * trong khi backend split TRƯỚC → ["Đại","Việt"] → ["Đ","V"] → strip → "V".
 * Mismatch khiến user thấy preview lệch với số HĐ thật khi activate.
 *
 * Note: Phase 3 nếu cần handle diacritic accurately (vd "Đại" → "D" thay vì
 * mất), backend cần thêm normalizeToAscii() trước replace.
 */
function formatContractNumberPreview(state: State): string {
  if (!state.signDate || !state.client.entityName) return "—";
  const d = new Date(state.signDate);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const clientShort =
    state.client.entityName
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8) || "CLIENT";
  const provider = state.providerId === "5SOLUTION" ? "5SOLUTION" : "5BIB";
  return `${dd}.${mm}/${yyyy}/HDDV/${clientShort}-${provider}`;
}

function ReviewStep({
  state,
  totals,
}: {
  state: State;
  totals: { subtotal: number; vatAmount: number; totalAmount: number };
}) {
  const isRevenueShare = state.contractType === "TICKET_SALES";
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
          Loại + Provider
        </div>
        <div>
          {state.contractType} · {state.documentType} · Provider:{" "}
          {state.providerId}
        </div>
      </div>
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
          Đối tác
        </div>
        <div>{state.client.entityName}</div>
        <div className="font-mono text-xs text-[var(--text-muted,#78716C)]">
          {state.client.taxId} · {state.client.representative}
        </div>
      </div>
      {state.race && (
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
            Giải đấu
          </div>
          <div>
            {state.race.raceName}
            {state.race.raceDate && ` · ${state.race.raceDate.slice(0, 10)}`}
          </div>
        </div>
      )}
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
          Hạng mục
        </div>
        {isRevenueShare ? (
          <div className="font-mono">
            {state.revenueShare.feePercentage}% phí + {formatVND(state.revenueShare.feePerAthlete)}
            /VĐV · ước tính {state.revenueShare.estimatedAthletes} VĐV
          </div>
        ) : (
          <div className="font-mono">
            {state.lineItems.length} hạng mục · Subtotal{" "}
            {formatVND(totals.subtotal)} · VAT {state.vatRate}% ={" "}
            {formatVND(totals.vatAmount)} · Tổng{" "}
            <strong>{formatVND(totals.totalAmount)}</strong>
          </div>
        )}
      </div>
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
          Thanh toán
        </div>
        <div>
          Tạm ứng {state.advancePercentage}% · Phạt {state.latePenaltyRate}%/{state.latePenaltyUnit === "PER_DAY" ? "ngày" : "năm"} · Hạn{" "}
          {state.paymentDeadlineDays} ngày
        </div>
      </div>
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
          Số HĐ dự kiến
        </div>
        <div className="font-mono font-semibold">
          {formatContractNumberPreview(state)}
        </div>
      </div>
    </div>
  );
}
