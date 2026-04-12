"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Percent,
  Ticket,
  Receipt,
  Pencil,
} from "lucide-react";

interface Merchant {
  id: number;
  name: string;
  tax_code: string | null;
  is_approved: boolean;
  contract_status: string;
  api_token: string | null;
  service_fee_rate: number | null;
  manual_fee_per_ticket: number;
  fee_vat_rate: number;
  fee_effective_date: string | null;
  fee_note: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  website: string | null;
  approved_at: string | null;
  approved_by: number | null;
  created_on: string;
}

interface FeeHistoryRecord {
  id: number;
  fee_field: "service_fee_rate" | "manual_fee_per_ticket" | "fee_vat_rate";
  old_value: string | null;
  new_value: string;
  changed_at: string;
  changed_by: number | null;
  note: string;
}

const FEE_FIELD_LABELS: Record<string, string> = {
  service_fee_rate: "Tỉ lệ phí dịch vụ (%)",
  manual_fee_per_ticket: "Phí vé thủ công (VNĐ/vé)",
  fee_vat_rate: "VAT trên phí (%)",
};

export default function MerchantDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [feeHistory, setFeeHistory] = useState<FeeHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Fee update modal
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [updatingFee, setUpdatingFee] = useState(false);
  const [feeForm, setFeeForm] = useState({
    service_fee_rate: "",
    manual_fee_per_ticket: "",
    fee_vat_rate: "",
    fee_effective_date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const fetchMerchant = useCallback(async () => {
    if (!token) return;
    try {
      const [mRes, hRes] = await Promise.all([
        fetch(`/api/merchants/${id}`, { headers: authHeaders(token).headers }),
        fetch(`/api/merchants/${id}/fee-history`, { headers: authHeaders(token).headers }),
      ]);
      if (!mRes.ok) throw new Error("Not found");
      const mJson = await mRes.json();
      setMerchant(mJson.data);
      if (hRes.ok) {
        const hJson = await hRes.json();
        setFeeHistory(hJson.data ?? []);
      }
    } catch {
      toast.error("Không thể tải thông tin merchant");
      router.push("/merchants");
    } finally {
      setLoading(false);
    }
  }, [token, id, router]);

  useEffect(() => {
    fetchMerchant();
  }, [fetchMerchant]);

  // Pre-fill fee form when modal opens
  function openFeeModal() {
    if (!merchant) return;
    setFeeForm({
      service_fee_rate: merchant.service_fee_rate != null ? String(merchant.service_fee_rate) : "",
      manual_fee_per_ticket: String(merchant.manual_fee_per_ticket),
      fee_vat_rate: String(merchant.fee_vat_rate),
      fee_effective_date: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setFeeModalOpen(true);
  }

  async function handleFeeUpdate() {
    if (!token || !merchant) return;
    if (!feeForm.note.trim()) {
      toast.error("Ghi chú lý do thay đổi là bắt buộc");
      return;
    }
    setUpdatingFee(true);
    try {
      const body: Record<string, any> = { note: feeForm.note, fee_effective_date: feeForm.fee_effective_date };
      if (feeForm.service_fee_rate !== "") body.service_fee_rate = parseFloat(feeForm.service_fee_rate);
      if (feeForm.manual_fee_per_ticket !== "") body.manual_fee_per_ticket = parseInt(feeForm.manual_fee_per_ticket);
      if (feeForm.fee_vat_rate !== "") body.fee_vat_rate = parseFloat(feeForm.fee_vat_rate);

      const res = await fetch(`/api/merchants/${id}/fee`, {
        method: "PATCH",
        headers: { ...authHeaders(token).headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success("Đã cập nhật cấu hình phí");
      setFeeModalOpen(false);
      fetchMerchant();
    } catch {
      toast.error("Cập nhật phí thất bại");
    } finally {
      setUpdatingFee(false);
    }
  }

  async function handleApprove(approve: boolean) {
    if (!token) return;
    try {
      const res = await fetch(`/api/merchants/${id}/approve`, {
        method: "PATCH",
        headers: { ...authHeaders(token).headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          is_approved: approve,
          contract_status: approve ? "active" : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(approve ? "Đã duyệt merchant" : "Đã hủy duyệt");
      fetchMerchant();
    } catch {
      toast.error("Thao tác thất bại");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!merchant) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" onClick={() => router.push("/merchants")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{merchant.name}</h1>
          <p className="text-sm text-muted-foreground">ID: #{merchant.id} · Tạo: {new Date(merchant.created_on).toLocaleDateString("vi-VN")}</p>
        </div>
        <div className="flex gap-2">
          {merchant.is_approved ? (
            <Button variant="outline" size="sm" onClick={() => handleApprove(false)}>
              Hủy duyệt
            </Button>
          ) : (
            <Button size="sm" onClick={() => handleApprove(true)}>
              <CheckCircle className="size-4 mr-1" />
              Duyệt merchant
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="fee">
            Phí dịch vụ
            {merchant.service_fee_rate == null && (
              <AlertTriangle className="ml-1 size-3 text-red-400" />
            )}
          </TabsTrigger>
          <TabsTrigger value="status">Trạng thái</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Thông tin ── */}
        <TabsContent value="info" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Thông tin công ty</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                  <span className="text-muted-foreground">Tên công ty</span>
                  <span className="font-medium">{merchant.name}</span>
                  <span className="text-muted-foreground">Mã số thuế</span>
                  <span>{merchant.tax_code ?? "—"}</span>
                  <span className="text-muted-foreground">API Token</span>
                  <span className="font-mono text-xs">{merchant.api_token ?? "—"}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Người liên hệ</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <span className="text-muted-foreground">Họ tên</span>
                  <span>{merchant.contact_name ?? "—"}</span>
                  <span className="text-muted-foreground">Email</span>
                  <span>{merchant.contact_email ?? "—"}</span>
                  <span className="text-muted-foreground">Điện thoại</span>
                  <span>{merchant.contact_phone ?? "—"}</span>
                  <span className="text-muted-foreground">Địa chỉ</span>
                  <span>{merchant.address ?? "—"}</span>
                  <span className="text-muted-foreground">Website</span>
                  <span>{merchant.website ?? "—"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 2: Phí dịch vụ ── */}
        <TabsContent value="fee" className="mt-4">
          <div className="flex flex-col gap-6">
            {/* Fee cards */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Cấu hình phí hiện tại</h3>
              <Dialog open={feeModalOpen} onOpenChange={setFeeModalOpen}>
                <DialogTrigger render={<Button size="sm" onClick={openFeeModal} />}>
                  <Pencil className="size-4 mr-1" />
                  Cập nhật phí
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Cập nhật cấu hình phí</DialogTitle>
                    <DialogDescription>
                      Để trống trường không muốn thay đổi. Ghi chú lý do là bắt buộc.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-col gap-2">
                      <Label>Tỉ lệ phí dịch vụ mới (%)</Label>
                      <Input
                        type="number" min="0" max="100" step="0.1"
                        value={feeForm.service_fee_rate}
                        onChange={e => setFeeForm(p => ({ ...p, service_fee_rate: e.target.value }))}
                        placeholder={`Hiện tại: ${merchant.service_fee_rate ?? "Chưa có"}%`}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Phí vé thủ công mới (VNĐ/vé)</Label>
                      <Input
                        type="number" min="0" step="500"
                        value={feeForm.manual_fee_per_ticket}
                        onChange={e => setFeeForm(p => ({ ...p, manual_fee_per_ticket: e.target.value }))}
                        placeholder={`Hiện tại: ${merchant.manual_fee_per_ticket.toLocaleString("vi-VN")}`}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>VAT trên phí mới (%)</Label>
                      <Select
                        value={feeForm.fee_vat_rate}
                        onValueChange={v => setFeeForm(p => ({ ...p, fee_vat_rate: v ?? p.fee_vat_rate }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0% (Không VAT)</SelectItem>
                          <SelectItem value="8">8%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Ngày áp dụng</Label>
                      <Input
                        type="date"
                        value={feeForm.fee_effective_date}
                        onChange={e => setFeeForm(p => ({ ...p, fee_effective_date: e.target.value }))}
                      />
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <Label>
                        Lý do thay đổi <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        value={feeForm.note}
                        onChange={e => setFeeForm(p => ({ ...p, note: e.target.value }))}
                        placeholder="VD: Ký hợp đồng mới, điều chỉnh theo thỏa thuận..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setFeeModalOpen(false)}>Hủy</Button>
                    <Button onClick={handleFeeUpdate} disabled={updatingFee || !feeForm.note.trim()}>
                      {updatingFee ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-purple-500/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/10">
                      <Percent className="size-4 text-purple-400" />
                    </div>
                    <CardTitle className="text-sm">Phí dịch vụ</CardTitle>
                  </div>
                  <CardDescription className="text-xs">ORDINARY · GROUP · CHANGE_COURSE</CardDescription>
                </CardHeader>
                <CardContent>
                  {merchant.service_fee_rate != null ? (
                    <p className="text-3xl font-bold text-purple-400">{merchant.service_fee_rate}%</p>
                  ) : (
                    <div className="flex items-center gap-1 text-red-400">
                      <AlertTriangle className="size-4" />
                      <span className="font-semibold">Chưa thiết lập</span>
                    </div>
                  )}
                  {merchant.fee_effective_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Áp dụng từ {new Date(merchant.fee_effective_date).toLocaleDateString("vi-VN")}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-blue-500/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10">
                      <Ticket className="size-4 text-blue-400" />
                    </div>
                    <CardTitle className="text-sm">Phí thủ công</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Đơn MANUAL (bán ngoài)</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-400">
                    {merchant.manual_fee_per_ticket.toLocaleString("vi-VN")}
                    <span className="text-sm font-normal ml-1 text-muted-foreground">VNĐ/vé</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-yellow-500/10">
                      <Receipt className="size-4 text-yellow-400" />
                    </div>
                    <CardTitle className="text-sm">VAT trên phí</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Tính trên tiền phí dịch vụ</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-yellow-400">{merchant.fee_vat_rate}%</p>
                  {merchant.fee_note && (
                    <p className="text-xs text-muted-foreground mt-1">{merchant.fee_note}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Fee history */}
            <div>
              <h3 className="font-semibold mb-3">Lịch sử thay đổi phí</h3>
              {feeHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có lịch sử thay đổi phí.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày thay đổi</TableHead>
                      <TableHead>Trường thay đổi</TableHead>
                      <TableHead>Giá trị cũ</TableHead>
                      <TableHead>Giá trị mới</TableHead>
                      <TableHead>Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeHistory.map(h => (
                      <TableRow key={h.id}>
                        <TableCell className="text-sm">
                          {new Date(h.changed_at).toLocaleString("vi-VN")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {FEE_FIELD_LABELS[h.fee_field] ?? h.fee_field}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {h.old_value ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{h.new_value}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{h.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 3: Trạng thái ── */}
        <TabsContent value="status" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trạng thái duyệt</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {merchant.is_approved ? (
                    <Badge className="bg-green-500/20 text-green-400">
                      <CheckCircle className="mr-1 size-3" /> Đã duyệt
                    </Badge>
                  ) : (
                    <Badge className="bg-zinc-500/20 text-zinc-400">Chờ duyệt</Badge>
                  )}
                </div>
                {merchant.approved_at && (
                  <p className="text-sm text-muted-foreground">
                    Duyệt lúc: {new Date(merchant.approved_at).toLocaleString("vi-VN")}
                    {merchant.approved_by && ` · Admin #${merchant.approved_by}`}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hợp đồng</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                  <span className="text-muted-foreground">Trạng thái HĐ</span>
                  <span className="font-medium capitalize">{merchant.contract_status}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
