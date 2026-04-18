"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  getScheduleEmail,
  sendTestScheduleEmail,
  upsertScheduleEmail,
  type ScheduleEmailConfig,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { VariableGroup } from "@/components/ContractEditor";

// Spec BR-SCH-04: 18 variables exposed in the schedule-email variable
// picker. Keep in sync with backend SCHEDULE_EMAIL_VARIABLES.
const SCHEDULE_VARIABLE_GROUPS: VariableGroup[] = [
  {
    label: "Thông tin cá nhân",
    items: [
      { key: "full_name", hint: "Họ tên đầy đủ" },
      { key: "phone", hint: "Số điện thoại" },
      { key: "email", hint: "Email" },
      { key: "cccd", hint: "Số CCCD" },
      { key: "dob", hint: "Ngày sinh" },
    ],
  },
  {
    label: "Sự kiện",
    items: [
      { key: "event_name", hint: "Tên sự kiện" },
      { key: "event_start_date", hint: "Ngày bắt đầu" },
      { key: "event_end_date", hint: "Ngày kết thúc" },
      { key: "event_location", hint: "Địa điểm" },
    ],
  },
  {
    label: "Vai trò & thù lao",
    items: [
      { key: "role_name", hint: "Tên vai trò" },
      { key: "daily_rate", hint: "Đơn giá / ngày" },
      { key: "working_days", hint: "Số ngày làm" },
      { key: "total_compensation", hint: "Tổng thù lao" },
      { key: "signed_date", hint: "Ngày ký HĐ" },
    ],
  },
  {
    label: "Lịch trình (tùy chỉnh theo role)",
    items: [
      { key: "reporting_time", hint: "Giờ tập kết" },
      { key: "gathering_point", hint: "Điểm tập kết" },
      { key: "team_contact_phone", hint: "SĐT liên hệ team" },
      { key: "special_note", hint: "Lưu ý đặc biệt" },
    ],
  },
];

const ContractEditor = dynamic(() => import("@/components/ContractEditor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border bg-muted/20 p-8 text-sm text-muted-foreground">
      Đang tải trình soạn thảo...
    </div>
  ),
});

const BLANK_TEMPLATE = `<h2>Lịch trình vận hành — {{event_name}}</h2>
<p>Chào <strong>{{full_name}}</strong>,</p>
<p>Đây là chi tiết lịch trình vận hành cho vai trò <strong>{{role_name}}</strong> trong sự kiện <strong>{{event_name}}</strong>.</p>
<ul>
  <li>Thời gian tập kết: <strong>{{reporting_time}}</strong></li>
  <li>Điểm tập kết: <strong>{{gathering_point}}</strong></li>
  <li>Địa điểm sự kiện: {{event_location}}</li>
  <li>Ngày diễn ra: {{event_start_date}} – {{event_end_date}}</li>
  <li>SĐT liên hệ Team: <strong>{{team_contact_phone}}</strong></li>
</ul>
<p><em>Lưu ý đặc biệt:</em> {{special_note}}</p>
<p>Cảm ơn bạn đã đồng hành cùng 5BIB. Hẹn gặp ở event!</p>`;

interface Props {
  eventId: number;
  roleId: number;
  roleName: string;
  eligibleCount: number;
  onClose: () => void;
}

export default function ScheduleEmailConfigSheet({
  eventId,
  roleId,
  roleName,
  eligibleCount,
  onClose,
}: Props): React.ReactElement {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [existing, setExisting] = useState<ScheduleEmailConfig | null>(null);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState(BLANK_TEMPLATE);
  const [reportingTime, setReportingTime] = useState("");
  const [gatheringPoint, setGatheringPoint] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [specialNote, setSpecialNote] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      if (!token) return;
      try {
        const cfg = await getScheduleEmail(token, eventId, roleId);
        if (cancelled) return;
        if (cfg) {
          setExisting(cfg);
          setSubject(cfg.subject);
          setHtml(cfg.body_html);
          setReportingTime(cfg.reporting_time ?? "");
          setGatheringPoint(cfg.gathering_point ?? "");
          setContactPhone(cfg.team_contact_phone ?? "");
          setSpecialNote(cfg.special_note ?? "");
        } else {
          // Seed the subject with a sensible default so the admin doesn't
          // stare at a blank input.
          setSubject(`Lịch trình vận hành — ${roleName}`);
        }
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, roleId, roleName, token]);

  async function handleSave(): Promise<ScheduleEmailConfig | null> {
    if (!token) return null;
    if (!subject.trim()) {
      toast.error("Chủ đề email không được để trống");
      return null;
    }
    if (!html.trim()) {
      toast.error("Nội dung email không được để trống");
      return null;
    }
    try {
      setSaving(true);
      const saved = await upsertScheduleEmail(token, eventId, roleId, {
        subject: subject.trim(),
        body_html: html,
        reporting_time: reportingTime.trim() || null,
        gathering_point: gatheringPoint.trim() || null,
        team_contact_phone: contactPhone.trim() || null,
        special_note: specialNote.trim() || null,
      });
      setExisting(saved);
      toast.success("Đã lưu cấu hình email lịch trình");
      return saved;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest(): Promise<void> {
    if (!token) return;
    // Always persist before test — otherwise the test will send the
    // previously-saved body, which is confusing when the admin is iterating.
    const saved = await handleSave();
    if (!saved) return;
    const input = window.prompt(
      "Nhập email nhận bản test (bỏ trống để gửi đến email của bạn)",
      "",
    );
    if (input === null) return; // Cancel
    const trimmed = input.trim();
    try {
      setSendingTest(true);
      const res = await sendTestScheduleEmail(
        token,
        eventId,
        roleId,
        trimmed || undefined,
      );
      if (res.sent) {
        toast.success(`Đã gửi email test tới ${res.delivered_to}`);
      } else {
        toast.warning(
          `Đã render cho ${res.delivered_to} nhưng Mailchimp không gửi (dev mode hoặc lỗi API)`,
        );
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <Sheet open onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>
            Email lịch trình · {roleName}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({eligibleCount} thành viên đủ điều kiện)
            </span>
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4 p-4 pt-2">
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldBlock
                label="Giờ tập kết"
                hint="VD: 05:00 sáng ngày 15/05/2026"
              >
                <Input
                  value={reportingTime}
                  onChange={(e) => setReportingTime(e.target.value)}
                  placeholder="05:00 ngày..."
                />
              </FieldBlock>
              <FieldBlock
                label="Điểm tập kết"
                hint="VD: Cổng A — Khu vực Race Village"
              >
                <Input
                  value={gatheringPoint}
                  onChange={(e) => setGatheringPoint(e.target.value)}
                  placeholder="Địa chỉ / landmark..."
                />
              </FieldBlock>
              <FieldBlock label="SĐT liên hệ team" hint="VD: 09xxxxxxxx">
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Số điện thoại..."
                  inputMode="tel"
                />
              </FieldBlock>
              <FieldBlock
                label="Lưu ý đặc biệt"
                hint="Hiển thị ở phần {{special_note}}"
              >
                <Textarea
                  value={specialNote}
                  onChange={(e) => setSpecialNote(e.target.value)}
                  placeholder="Mang theo CCCD, áo ấm, giày chống nước..."
                  rows={2}
                />
              </FieldBlock>
            </section>

            <FieldBlock label="Chủ đề email" hint="Tối đa 500 ký tự · hỗ trợ {{biến}}">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={500}
                placeholder="VD: [5BIB] Lịch trình vận hành — {{event_name}}"
              />
            </FieldBlock>

            <FieldBlock
              label="Nội dung email"
              hint="Dùng nút 'Chèn biến' trên thanh công cụ — 18 biến có sẵn theo spec v1.4"
            >
              <ContractEditor
                initialContent={html}
                onChange={setHtml}
                variableGroups={SCHEDULE_VARIABLE_GROUPS}
                placeholder="Nhập nội dung email lịch trình..."
              />
            </FieldBlock>

            {showPreview ? (
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label>Xem trước (sample data)</Label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(false)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Ẩn
                  </button>
                </div>
                <iframe
                  title="Preview email lịch trình"
                  srcDoc={buildPreviewHtml(html, {
                    reporting_time: reportingTime,
                    gathering_point: gatheringPoint,
                    team_contact_phone: contactPhone,
                    special_note: specialNote,
                  })}
                  className="h-96 w-full rounded border bg-white"
                />
              </section>
            ) : null}

            <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background px-4 py-3">
              {!showPreview ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowPreview(true)}
                >
                  Xem trước
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={handleSendTest}
                disabled={sendingTest || saving}
              >
                {sendingTest ? "Đang gửi..." : "Gửi email test"}
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const saved = await handleSave();
                  if (saved) onClose();
                }}
                disabled={saving}
              >
                {saving
                  ? "Đang lưu..."
                  : existing
                    ? "Lưu thay đổi"
                    : "Lưu cấu hình"}
              </Button>
            </div>

            {existing ? (
              <p className="text-xs text-muted-foreground">
                Đã gửi tổng cộng <strong>{existing.total_sent_count}</strong> email ·
                lần gần nhất <strong>{existing.last_sent_count}</strong> người{" "}
                {existing.last_sent_at
                  ? `(${new Date(existing.last_sent_at).toLocaleString("vi-VN")})`
                  : ""}
              </p>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FieldBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Build a client-side preview HTML by substituting sample values directly —
 * this is ONLY for the admin's eyes inside an iframe. The real render happens
 * server-side through the hardened sanitize+render pipeline. We don't
 * sanitize here because the iframe is sandboxed to the admin's own session.
 */
function buildPreviewHtml(
  body: string,
  customs: {
    reporting_time: string;
    gathering_point: string;
    team_contact_phone: string;
    special_note: string;
  },
): string {
  const sample: Record<string, string> = {
    full_name: "Nguyễn Văn An",
    phone: "0901234567",
    email: "test.member@example.com",
    cccd: "012345678901",
    dob: "01/01/1995",
    event_name: "5BIB Trail Marathon 2026",
    event_start_date: "15/05/2026",
    event_end_date: "16/05/2026",
    event_location: "Đà Lạt, Lâm Đồng",
    role_name: "Crew Hậu Cần",
    daily_rate: "500.000",
    working_days: "2",
    total_compensation: "1.000.000",
    signed_date: "01/04/2026",
    reporting_time: customs.reporting_time || "05:00 sáng ngày 15/05/2026",
    gathering_point: customs.gathering_point || "Cổng A — Race Village",
    team_contact_phone: customs.team_contact_phone || "0909876543",
    special_note: customs.special_note || "Mang theo CCCD gốc và áo khoác ấm.",
  };
  const rendered = body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) =>
    key in sample ? sample[key] : m,
  );
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;color:#1c1917;padding:16px;line-height:1.5}h1,h2,h3{margin-top:0}</style></head><body>${rendered}</body></html>`;
}
