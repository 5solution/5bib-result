"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Archive, ArchiveRestore, Save } from "lucide-react";

type LeadStatus = "new" | "contacted" | "quoted" | "closed_won" | "closed_lost";

interface TimingLeadDetail {
  _id: string;
  lead_number: number;
  full_name: string;
  phone: string;
  organization: string;
  athlete_count_range: string;
  package_interest: "basic" | "advanced" | "professional" | "unspecified";
  notes: string;
  status: LeadStatus;
  is_archived: boolean;
  staff_notes: string;
  ip_address: string;
  user_agent: string;
  createdAt: string;
  updatedAt: string;
}

const PACKAGE_LABEL: Record<TimingLeadDetail["package_interest"], string> = {
  basic: "Basic",
  advanced: "Advanced",
  professional: "Professional",
  unspecified: "Chưa xác định",
};

export default function TimingLeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const id = params.id as string;

  const [lead, setLead] = useState<TimingLeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<LeadStatus>("new");
  const [staffNotes, setStaffNotes] = useState("");

  const fetchLead = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/timing/leads/${id}`, {
        ...authHeaders(token),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: TimingLeadDetail = await res.json();
      setLead(data);
      setStatus(data.status);
      setStaffNotes(data.staff_notes || "");
    } catch {
      toast.error("Không tải được lead");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const save = async () => {
    if (!token || !lead) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/timing/leads/${lead._id}`, {
        method: "PATCH",
        headers: { ...authHeaders(token).headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status, staff_notes: staffNotes }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: TimingLeadDetail = await res.json();
      setLead(data);
      toast.success("Đã lưu");
    } catch {
      toast.error("Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!token || !lead) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/timing/leads/${lead._id}`, {
        method: "PATCH",
        headers: { ...authHeaders(token).headers, "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: !lead.is_archived }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: TimingLeadDetail = await res.json();
      setLead(data);
      toast.success(data.is_archived ? "Đã archive" : "Đã khôi phục");
    } catch {
      toast.error("Không cập nhật được");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        Không tìm thấy lead
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push("/timing-leads")}>
            <ArrowLeft className="mr-2 size-4" />
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/timing-leads")}>
          <ArrowLeft className="mr-2 size-4" />
          Danh sách
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Lead #{lead.lead_number}
            {lead.is_archived && (
              <span className="ml-2 inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                Archived
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Gửi lúc{" "}
            {new Date(lead.createdAt).toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
            })}
          </p>
        </div>
        <Button variant="outline" onClick={toggleArchive} disabled={saving}>
          {lead.is_archived ? (
            <>
              <ArchiveRestore className="mr-2 size-4" />
              Khôi phục
            </>
          ) : (
            <>
              <Archive className="mr-2 size-4" />
              Archive
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="font-semibold">Thông tin liên hệ</h2>
          <Field label="Họ tên" value={lead.full_name} />
          <Field label="SĐT" value={lead.phone} mono />
          <Field label="Tổ chức" value={lead.organization} />
          <Field label="Quy mô" value={lead.athlete_count_range || "-"} />
          <Field label="Gói quan tâm" value={PACKAGE_LABEL[lead.package_interest]} />
          {lead.notes && (
            <div>
              <Label className="text-muted-foreground">Ghi chú từ BTC</Label>
              <div className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                {lead.notes}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="font-semibold">Quản lý</h2>
          <div>
            <Label>Trạng thái</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Mới</SelectItem>
                <SelectItem value="contacted">Đã liên hệ</SelectItem>
                <SelectItem value="quoted">Đã báo giá</SelectItem>
                <SelectItem value="closed_won">Chốt deal</SelectItem>
                <SelectItem value="closed_lost">Không chốt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="staff-notes">Ghi chú nội bộ</Label>
            <Textarea
              id="staff-notes"
              rows={6}
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              maxLength={5000}
              placeholder="Lịch sử liên hệ, báo giá, quyết định..."
            />
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            <Save className="mr-2 size-4" />
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>

          <div className="pt-4 border-t space-y-2 text-xs text-muted-foreground">
            <div>
              <strong>IP (masked):</strong> <span className="font-mono">{lead.ip_address || "-"}</span>
            </div>
            <div className="truncate">
              <strong>User agent:</strong>{" "}
              <span className="font-mono" title={lead.user_agent}>
                {lead.user_agent || "-"}
              </span>
            </div>
            <div>
              <strong>Cập nhật:</strong>{" "}
              {new Date(lead.updatedAt).toLocaleString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <Label className="text-muted-foreground">{label}</Label>
      <div className={`mt-1 text-sm ${mono ? "font-mono" : "font-medium"}`}>{value}</div>
    </div>
  );
}
