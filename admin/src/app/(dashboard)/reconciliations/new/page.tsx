"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, ChevronLeft, CheckCircle, Download } from "lucide-react";

async function downloadWithAuth(url: string, filename: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function fmtDate(s: string): string {
  if (!s) return "";
  const parts = s.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : s;
}

function buildRecFilename(data: any, ext: string): string {
  const parts = [
    data.tenant_name || String(data.tenant_id),
    data.race_title,
    `${fmtDate(data.period_start)} đến ${fmtDate(data.period_end)}`,
  ].filter(Boolean);
  return `${parts.join(" - ")}.${ext}`;
}

interface Merchant {
  id: number;
  name: string;
  contract_status: string;
  service_fee_rate: number | null;
  manual_fee_per_ticket: number;
  fee_vat_rate: number;
}

interface Race {
  race_id: number;
  title: string;
  created_on: string | null;
}

interface LineItem {
  order_category: string;
  ticket_type_name: string;
  distance_name: string;
  unit_price: number;
  quantity: number;
  discount_amount: number;
  subtotal: number;
  add_on_price: number;
}

interface ManualOrderRow {
  order_id: number;
  ticket_type_name: string;
  participant_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  note: string | null;
}

interface PreviewResult {
  tenant_name: string;
  fee_rate_applied: number | null;
  manual_fee_per_ticket: number;
  fee_vat_rate: number;
  gross_revenue: number;
  total_discount: number;
  net_revenue: number;
  fee_amount: number;
  fee_vat_amount: number;
  manual_ticket_count: number;
  manual_gross_revenue: number;
  manual_fee_amount: number;
  payout_amount: number;
  missing_payment_ref_count: number;
  raw_5bib_order_count: number;
  raw_manual_order_count: number;
  line_items: LineItem[];
  manual_orders: ManualOrderRow[];
}

interface CreateResult {
  _id: string;
  xlsx_url: string | null;
  docx_url: string | null;
}

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " đ";
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthStart(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 10);
}

function getMonthEnd(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset + 1);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

const STEPS = ["Chọn thông tin", "Xem xét & Điều chỉnh", "Tạo tài liệu"];

export default function NewReconciliationPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);

  // Step 1 state
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantsLoading, setMerchantsLoading] = useState(true);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>("");
  const [races, setRaces] = useState<Race[]>([]);
  const [racesLoading, setRacesLoading] = useState(false);
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const [raceTitle, setRaceTitle] = useState("");
  const [periodStart, setPeriodStart] = useState(getMonthStart(-1));
  const [periodEnd, setPeriodEnd] = useState(getMonthEnd(-1));
  const [previewLoading, setPreviewLoading] = useState(false);

  // Step 2 state
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [feeRate, setFeeRate] = useState("");
  const [feeVatRate, setFeeVatRate] = useState("");
  const [manualFeePerTicket, setManualFeePerTicket] = useState("");
  const [manualAdjustment, setManualAdjustment] = useState("0");
  const [adjustmentNote, setAdjustmentNote] = useState("");

  // Step 3 state
  const [signedDateStr, setSignedDateStr] = useState(getTodayStr());
  const [createXlsx, setCreateXlsx] = useState(true);
  const [createDocx, setCreateDocx] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);

  const selectedMerchant = merchants.find((m) => String(m.id) === selectedMerchantId);

  useEffect(() => {
    if (!token) return;
    setMerchantsLoading(true);
    fetch("/api/merchants?pageSize=100", { headers: authHeaders(token).headers })
      .then((r) => r.json())
      .then((json) => {
        const list: Merchant[] = json.data?.list ?? json.data ?? [];
        setMerchants(list);
      })
      .catch(() => toast.error("Không thể tải danh sách merchant"))
      .finally(() => setMerchantsLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedMerchantId) {
      setRaces([]);
      setSelectedRaceId("");
      setRaceTitle("");
      return;
    }
    setRacesLoading(true);
    fetch(`/api/reconciliations/races/${selectedMerchantId}`, {
      headers: authHeaders(token).headers,
    })
      .then((r) => r.json())
      .then((json) => {
        const list: Race[] = json.data ?? json ?? [];
        setRaces(list);
      })
      .catch(() => toast.error("Không thể tải danh sách giải đấu"))
      .finally(() => setRacesLoading(false));
  }, [token, selectedMerchantId]);

  const selectedRace = races.find((r) => String(r.race_id) === selectedRaceId);

  async function handlePreview() {
    const effectiveRaceTitle = raceTitle || selectedRace?.title || "";
    if (!token || !selectedMerchantId || !selectedRaceId || !effectiveRaceTitle || !periodStart || !periodEnd) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/reconciliations/preview", {
        method: "POST",
        headers: { ...authHeaders(token).headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: Number(selectedMerchantId),
          mysql_race_id: Number(selectedRaceId),
          race_title: effectiveRaceTitle,
          period_start: periodStart,
          period_end: periodEnd,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Lỗi khi lấy dữ liệu");
      }
      const json = await res.json();
      const data: PreviewResult = json.data ?? json;
      setPreview(data);
      setFeeRate(String(data.fee_rate_applied ?? ""));
      setFeeVatRate(String(data.fee_vat_rate ?? ""));
      setManualFeePerTicket(String(data.manual_fee_per_ticket ?? ""));
      setStep(1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Không thể lấy dữ liệu preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  function computedFee() {
    if (!preview) return 0;
    const rate = parseFloat(feeRate) || 0;
    return Math.round(preview.net_revenue * (rate / 100));
  }

  function computedVat() {
    const vatRate = parseFloat(feeVatRate) || 0;
    return Math.round(computedFee() * (vatRate / 100));
  }

  function computedManualFee() {
    if (!preview) return 0;
    const perTicket = parseFloat(manualFeePerTicket) || 0;
    return Math.round(preview.manual_ticket_count * perTicket);
  }

  function computedPayout() {
    if (!preview) return 0;
    const adj = parseFloat(manualAdjustment) || 0;
    return preview.net_revenue - computedFee() - computedVat() - computedManualFee() + adj;
  }

  async function handleCreate() {
    if (!token || !preview) return;
    const adj = parseFloat(manualAdjustment) || 0;
    if (adj !== 0 && !adjustmentNote.trim()) {
      toast.error("Vui lòng nhập ghi chú cho khoản điều chỉnh");
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch("/api/reconciliations", {
        method: "POST",
        headers: { ...authHeaders(token).headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: Number(selectedMerchantId),
          mysql_race_id: Number(selectedRaceId),
          race_title: raceTitle || selectedRace?.title || "",
          period_start: periodStart,
          period_end: periodEnd,
          fee_rate_applied: parseFloat(feeRate) || null,
          fee_vat_rate: parseFloat(feeVatRate) || 0,
          manual_fee_per_ticket: parseFloat(manualFeePerTicket) || 0,
          manual_adjustment: adj,
          adjustment_note: adjustmentNote || null,
          signed_date_str: signedDateStr,
          generate_xlsx: createXlsx,
          generate_docx: createDocx,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Lỗi khi tạo đối soát");
      }
      const json = await res.json();
      setCreateResult(json.data ?? json);
      setStep(2);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Không thể tạo đối soát");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Stepper */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Tạo đối soát mới</h1>
        <div className="flex items-center gap-2 mt-3">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i < step
                    ? "bg-green-500 text-white"
                    : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <CheckCircle className="size-4" /> : i + 1}
              </div>
              <span className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <ChevronRight className="size-4 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1 */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Chọn thông tin đối soát</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Merchant */}
            <div className="flex flex-col gap-1.5">
              <Label>Merchant</Label>
              {merchantsLoading ? (
                <div className="text-sm text-muted-foreground">Đang tải...</div>
              ) : (
                <Select value={selectedMerchantId} onValueChange={v => { if (v) setSelectedMerchantId(v); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn merchant...">
                      {selectedMerchant ? `${selectedMerchant.name}${selectedMerchant.service_fee_rate == null ? " ⚠" : ""}` : "Chọn merchant..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-w-[500px]">
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)} className="whitespace-normal">
                        {m.name}
                        {m.service_fee_rate == null && " ⚠"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedMerchant && selectedMerchant.service_fee_rate == null && (
                <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600">
                  <AlertTriangle className="size-4 shrink-0" />
                  Merchant chưa có tỉ lệ phí. Vui lòng cập nhật trước khi tạo đối soát.
                </div>
              )}
            </div>

            {/* Race */}
            <div className="flex flex-col gap-1.5">
              <Label>Giải đấu</Label>
              {!selectedMerchantId ? (
                <p className="text-sm text-muted-foreground">Chọn merchant trước</p>
              ) : racesLoading ? (
                <p className="text-sm text-muted-foreground">Đang tải giải đấu...</p>
              ) : (
                <Select value={selectedRaceId} onValueChange={(v) => { if (v) { setSelectedRaceId(v); const r = races.find((r) => String(r.race_id) === v); if (r) setRaceTitle(r.title); } }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn giải đấu...">
                      {selectedRace ? selectedRace.title : "Chọn giải đấu..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-w-[500px]">
                    {races.map((r) => (
                      <SelectItem key={r.race_id} value={String(r.race_id)} className="whitespace-normal">
                        {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {races.length === 0 && selectedMerchantId && !racesLoading && (
                <p className="text-xs text-muted-foreground">Merchant này chưa có giải đấu nào</p>
              )}
            </div>

            {/* Race Title Override */}
            <div className="flex flex-col gap-1.5">
              <Label>Tên giải (tùy chỉnh)</Label>
              <Input
                placeholder={selectedRace?.title || "Tên giải hiển thị trên tài liệu"}
                value={raceTitle}
                onChange={(e) => setRaceTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Để trống sẽ dùng tên giải từ hệ thống</p>
            </div>

            {/* Period */}
            <div className="flex flex-col gap-1.5">
              <Label>Kỳ đối soát</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPeriodStart(getMonthStart(0));
                    setPeriodEnd(getMonthEnd(0));
                  }}
                >
                  Tháng này
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPeriodStart(getMonthStart(-1));
                    setPeriodEnd(getMonthEnd(-1));
                  }}
                >
                  Tháng trước
                </Button>
              </div>
              <div className="flex gap-3 items-center">
                <div className="flex flex-col gap-1 flex-1">
                  <Label className="text-xs text-muted-foreground">Từ ngày</Label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <span className="text-muted-foreground mt-5">—</span>
                <div className="flex flex-col gap-1 flex-1">
                  <Label className="text-xs text-muted-foreground">Đến ngày</Label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handlePreview} disabled={previewLoading} className="self-start">
              {previewLoading ? "Đang lấy dữ liệu..." : "Lấy dữ liệu →"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 1 && preview && (
        <div className="flex flex-col gap-5">
          {/* Warning */}
          {preview.missing_payment_ref_count > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700">
              <AlertTriangle className="size-4 shrink-0" />
              Có {preview.missing_payment_ref_count} đơn không có mã thanh toán. Dữ liệu có thể chưa đầy đủ.
            </div>
          )}

          {/* Section A */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Đơn 5BIB (ORDINARY / PERSONAL_GROUP / CHANGE_COURSE)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Tổng giao dịch</p>
                <p className="text-lg font-semibold">{preview.raw_5bib_order_count}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Doanh thu gross</p>
                <p className="text-lg font-semibold">{formatVnd(preview.gross_revenue)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Doanh thu thực tế (net)</p>
                <p className="text-lg font-semibold">{formatVnd(preview.net_revenue)}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Tỉ lệ phí (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={feeRate}
                  onChange={(e) => setFeeRate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Phí dịch vụ</p>
                <p className="text-lg font-semibold">{formatVnd(computedFee())}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">VAT trên phí (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={feeVatRate}
                  onChange={(e) => setFeeVatRate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Số tiền VAT</p>
                <p className="text-lg font-semibold">{formatVnd(computedVat())}</p>
              </div>
            </CardContent>
          </Card>

          {/* Section B */}
          {preview.manual_ticket_count > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Đơn thủ công (MANUAL)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Tổng số vé</p>
                  <p className="text-lg font-semibold">{preview.manual_ticket_count}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Phí/vé (đ)</Label>
                  <Input
                    type="number"
                    value={manualFeePerTicket}
                    onChange={(e) => setManualFeePerTicket(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Tổng phí thủ công</p>
                  <p className="text-lg font-semibold">{formatVnd(computedManualFee())}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Line items table */}
          {preview.line_items && preview.line_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bảng chi tiết</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">STT</TableHead>
                      <TableHead>Loại đơn</TableHead>
                      <TableHead>Loại vé</TableHead>
                      <TableHead>Cự ly</TableHead>
                      <TableHead className="text-right">Số lượng</TableHead>
                      <TableHead className="text-right">Đơn giá</TableHead>
                      <TableHead className="text-right">Giảm giá</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.line_items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.order_category || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.ticket_type_name || "—"}</TableCell>
                        <TableCell>{item.distance_name || "—"}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatVnd(item.unit_price)}</TableCell>
                        <TableCell className="text-right">{item.discount_amount ? formatVnd(item.discount_amount) : "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatVnd(item.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Manual orders table */}
          {preview.manual_orders && preview.manual_orders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Đơn thủ công chi tiết</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">STT</TableHead>
                      <TableHead>Tên người tham gia</TableHead>
                      <TableHead>Loại vé</TableHead>
                      <TableHead className="text-right">Số lượng</TableHead>
                      <TableHead className="text-right">Đơn giá</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.manual_orders.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>{row.participant_name || "—"}</TableCell>
                        <TableCell>{row.ticket_type_name || "—"}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="text-right">{formatVnd(row.unit_price)}</TableCell>
                        <TableCell className="text-right font-medium">{formatVnd(row.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Manual adjustment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Điều chỉnh thủ công</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Khoản điều chỉnh (đ)</Label>
                <Input
                  type="number"
                  placeholder="VD: -50000 hoặc +100000"
                  value={manualAdjustment}
                  onChange={(e) => setManualAdjustment(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Nhập số âm để trừ, số dương để cộng</p>
              </div>
              {parseFloat(manualAdjustment) !== 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label>Ghi chú điều chỉnh <span className="text-red-400">*</span></Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Lý do điều chỉnh..."
                    value={adjustmentNote}
                    onChange={(e) => setAdjustmentNote(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payout summary */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Tổng kết thanh toán</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Doanh thu thực (net)</span>
                <span className="font-medium">{formatVnd(preview.net_revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí dịch vụ</span>
                <span className="font-medium text-red-400">− {formatVnd(computedFee())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT trên phí</span>
                <span className="font-medium text-red-400">− {formatVnd(computedVat())}</span>
              </div>
              {preview.manual_ticket_count > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phí thủ công ({preview.manual_ticket_count} vé)</span>
                  <span className="font-medium text-red-400">− {formatVnd(computedManualFee())}</span>
                </div>
              )}
              {parseFloat(manualAdjustment) !== 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Điều chỉnh</span>
                  <span className={`font-medium ${parseFloat(manualAdjustment) > 0 ? "text-green-400" : "text-red-400"}`}>
                    {parseFloat(manualAdjustment) > 0 ? "+" : ""}{formatVnd(parseFloat(manualAdjustment))}
                  </span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t pt-2">
                <span className="font-semibold">Số tiền thanh toán</span>
                <span className="text-lg font-bold text-green-400">{formatVnd(computedPayout())}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft className="mr-1 size-4" />
              Quay lại
            </Button>
            <Button onClick={() => setStep(2)}>
              Tiếp tục
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 2 && !createResult && preview && (
        <div className="flex flex-col gap-5">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Tóm tắt đối soát</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Merchant</p>
                <p className="font-medium">{preview.tenant_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Giải đấu</p>
                <p className="font-medium">{raceTitle || selectedRace?.title || ""}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Doanh thu thực</p>
                <p className="font-semibold">{formatVnd(preview.net_revenue)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phí + VAT</p>
                <p className="font-semibold text-red-400">
                  {formatVnd(computedFee() + computedVat())}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Điều chỉnh</p>
                <p className="font-semibold">
                  {parseFloat(manualAdjustment) !== 0
                    ? formatVnd(parseFloat(manualAdjustment))
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Thanh toán</p>
                <p className="text-lg font-bold text-green-400">{formatVnd(computedPayout())}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cấu hình tài liệu</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Ngày ký (hiển thị trên tài liệu)</Label>
                <Input
                  type="date"
                  value={signedDateStr}
                  onChange={(e) => setSignedDateStr(e.target.value)}
                  className="max-w-[200px]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Tạo tài liệu</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createXlsx}
                    onChange={(e) => setCreateXlsx(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Tạo XLSX (Excel)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createDocx}
                    onChange={(e) => setCreateDocx(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Tạo DOCX (Word)</span>
                </label>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 size-4" />
              Quay lại
            </Button>
            <Button onClick={handleCreate} disabled={createLoading}>
              {createLoading ? "Đang tạo..." : "Tạo đối soát"}
            </Button>
          </div>
        </div>
      )}

      {/* Success */}
      {step === 2 && createResult && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-500">
              <CheckCircle className="size-5" />
              Tạo đối soát thành công!
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Bản đối soát đã được tạo. Bạn có thể tải tài liệu hoặc xem chi tiết bên dưới.
            </p>
            <div className="flex flex-wrap gap-3">
              {createXlsx && (
                <button
                  onClick={() =>
                    downloadWithAuth(
                      createResult.xlsx_url || `/api/reconciliations/${createResult._id}/download/xlsx`,
                      buildRecFilename(createResult, "xlsx"),
                      token!,
                    ).catch(() => toast.error("Tải XLSX thất bại"))
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <Download className="size-4" />
                  Tải XLSX
                </button>
              )}
              {createDocx && (
                <button
                  onClick={() =>
                    downloadWithAuth(
                      createResult.docx_url || `/api/reconciliations/${createResult._id}/download/docx`,
                      buildRecFilename(createResult, "docx"),
                      token!,
                    ).catch(() => toast.error("Tải DOCX thất bại"))
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Download className="size-4" />
                  Tải DOCX
                </button>
              )}
              <Button
                variant="outline"
                onClick={() => router.push(`/reconciliations/${createResult._id}`)}
              >
                Xem chi tiết
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
