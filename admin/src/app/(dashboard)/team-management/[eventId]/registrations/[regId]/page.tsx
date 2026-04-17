"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getRegistrationDetail,
  patchRegistration,
  type RegistrationDetail,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function PersonnelDetailPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string; regId: string }>();
  const regId = Number(params.regId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [detail, setDetail] = useState<RegistrationDetail | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingDays, setEditingDays] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await getRegistrationDetail(token, regId);
      setDetail(d);
      setEditingNotes(d.notes ?? "");
      setEditingDays(d.actual_working_days ?? "");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [token, regId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function saveNotes(): Promise<void> {
    if (!token || !detail) return;
    setSaving(true);
    try {
      await patchRegistration(token, regId, { notes: editingNotes });
      toast.success("Đã lưu ghi chú");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function savePayment(
    payment_status: "pending" | "paid",
  ): Promise<void> {
    if (!token || !detail) return;
    setSaving(true);
    try {
      await patchRegistration(token, regId, {
        payment_status,
        actual_working_days:
          typeof editingDays === "number" ? editingDays : undefined,
      });
      toast.success("Đã cập nhật thanh toán");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !isAuthenticated || !detail) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/team-management/${params.eventId}/registrations`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Quay lại
          </Button>
        </Link>
      </div>

      <div className="flex flex-col items-start gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
        {detail.avatar_photo_url ? (
          <img
            src={detail.avatar_photo_url}
            alt=""
            className="size-24 rounded-lg object-cover"
          />
        ) : (
          <div className="size-24 rounded-lg bg-muted" />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{detail.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {detail.role_name} · {detail.event_name}
          </p>
          <p className="text-sm mt-1">
            SĐT: {detail.phone} · Email: {detail.email}
          </p>
          <p className="text-sm">
            Size áo: {detail.shirt_size ?? "—"} · Check-in:{" "}
            {detail.checked_in_at
              ? `✅ ${new Date(detail.checked_in_at).toLocaleString("vi-VN")}`
              : "⏳ Chưa"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="contract">Hợp đồng</TabsTrigger>
          <TabsTrigger value="payment">Thanh toán</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-3">
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <h3 className="font-semibold mb-2">Dữ liệu form</h3>
              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                {Object.entries(detail.form_data).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {key}
                    </dt>
                    <dd className="break-all">
                      {typeof value === "string" &&
                      (key === "avatar_photo" || key === "cccd_photo") ? (
                        <span className="text-xs">(ảnh, xem bên dưới)</span>
                      ) : typeof value === "string" ||
                        typeof value === "number" ? (
                        String(value)
                      ) : (
                        <code className="text-xs">{JSON.stringify(value)}</code>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {detail.cccd_photo_url ? (
              <div>
                <h3 className="font-semibold mb-2">Ảnh CCCD (presigned 1h)</h3>
                <a
                  href={detail.cccd_photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-sm text-primary hover:underline"
                >
                  Mở ảnh CCCD →
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Link hết hạn sau 1 giờ. Refresh trang để tạo link mới.
                </p>
              </div>
            ) : null}

            <div>
              <Label>Ghi chú admin</Label>
              <Textarea
                rows={3}
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="Ghi chú nội bộ..."
              />
              <Button
                size="sm"
                className="mt-2"
                onClick={() => {
                  void saveNotes();
                }}
                disabled={saving}
              >
                Lưu ghi chú
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contract" className="space-y-3">
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <strong>Trạng thái:</strong>{" "}
              {detail.contract_status === "signed"
                ? "✅ Đã ký"
                : detail.contract_status === "sent"
                  ? "⏳ Đã gửi, chờ ký"
                  : "Chưa gửi"}
            </div>
            {detail.contract_signed_at ? (
              <div className="text-sm">
                Ký vào:{" "}
                {new Date(detail.contract_signed_at).toLocaleString("vi-VN")}
              </div>
            ) : null}
            {detail.contract_pdf_url ? (
              <p className="text-xs text-muted-foreground">
                PDF key: <code className="break-all">{detail.contract_pdf_url}</code>
              </p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="payment" className="space-y-3">
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <Label>Số ngày công thực tế</Label>
              <Input
                type="number"
                min={0}
                value={editingDays === "" ? "" : editingDays}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditingDays(v === "" ? "" : Number(v));
                }}
              />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-muted-foreground">Hiện tại</span>
                <div className="font-medium">
                  {detail.payment_status === "paid"
                    ? "✅ Đã thanh toán"
                    : "⏳ Chờ"}
                </div>
              </div>
              {detail.actual_compensation ? (
                <div>
                  <span className="text-xs text-muted-foreground">Thành tiền</span>
                  <div className="font-medium">
                    {Number(detail.actual_compensation).toLocaleString("vi-VN")} ₫
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  void savePayment("paid");
                }}
                disabled={saving}
              >
                Đánh dấu đã thanh toán
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void savePayment("pending");
                }}
                disabled={saving}
              >
                Đặt lại về chờ
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
