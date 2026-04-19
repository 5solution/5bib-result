"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getTeamEvent,
  updateTeamEvent,
  uploadTeamPhoto,
  type TeamEvent,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings } from "lucide-react";
import { toast } from "sonner";

// v1.8 — Full event edit page. Covers everything the create dialog exposes
// plus status, description, lat/lng, contact, T&C, min work hours, benefits
// banner. The only field we intentionally don't expose here is `race_id`
// (linking to a race record is a future v2 feature).
//
// Time-handling invariant:
//   - Backend stores registration_open/close as UTC ISO8601 strings.
//   - <input type="datetime-local"> emits LOCAL time without a timezone
//     suffix, e.g. "2026-04-19T14:30".
//   - We render by shifting UTC into the browser's tz, and persist by
//     letting `new Date(local).toISOString()` re-shift back to UTC.
//   - event_start_date / event_end_date are DATE-only (no tz ambiguity).

type Status = "draft" | "open" | "closed" | "completed";

interface FormState {
  event_name: string;
  description: string;
  location: string;
  location_lat: string;
  location_lng: string;
  checkin_radius_m: number;
  event_start_date: string;
  event_end_date: string;
  registration_open: string; // local "YYYY-MM-DDTHH:mm"
  registration_close: string; // local
  status: Status;
  contact_email: string;
  contact_phone: string;
  benefits_image_url: string;
  terms_conditions: string;
  min_work_hours: string; // numeric as string to allow empty/decimal typing
}

// Convert ISO8601 UTC → "YYYY-MM-DDTHH:mm" in local tz for <input datetime-local>.
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

// Convert "YYYY-MM-DDTHH:mm" local → ISO8601 UTC. Empty string returns null.
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function eventToForm(e: TeamEvent): FormState {
  return {
    event_name: e.event_name,
    description: e.description ?? "",
    location: e.location ?? "",
    location_lat: e.location_lat == null ? "" : String(e.location_lat),
    location_lng: e.location_lng == null ? "" : String(e.location_lng),
    checkin_radius_m: e.checkin_radius_m,
    event_start_date: e.event_start_date,
    event_end_date: e.event_end_date,
    registration_open: isoToLocalInput(e.registration_open),
    registration_close: isoToLocalInput(e.registration_close),
    status: e.status,
    contact_email: e.contact_email ?? "",
    contact_phone: e.contact_phone ?? "",
    benefits_image_url: e.benefits_image_url ?? "",
    terms_conditions: e.terms_conditions ?? "",
    min_work_hours:
      e.min_work_hours_for_completion == null
        ? ""
        : String(e.min_work_hours_for_completion),
  };
}

const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
  { value: "draft", label: "Bản nháp" },
  { value: "open", label: "Mở đăng ký" },
  { value: "closed", label: "Đóng đăng ký" },
  { value: "completed", label: "Đã kết thúc" },
];

export default function EventSettingsPage(): React.ReactElement {
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token } = useAuth();

  const [event, setEvent] = useState<TeamEvent | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingBenefits, setUploadingBenefits] = useState(false);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(eventId)) return;
    try {
      const e = await getTeamEvent(token, eventId);
      setEvent(e);
      setForm(eventToForm(e));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [token, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleBenefitsFile(file: File): Promise<void> {
    if (!file || !form) return;
    setUploadingBenefits(true);
    try {
      const { url } = await uploadTeamPhoto(file, "benefits");
      setForm({ ...form, benefits_image_url: url });
      toast.success("Đã upload ảnh quyền lợi");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingBenefits(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (!token || !event || !form) return;
    if (!form.event_name.trim()) {
      toast.error("Tên sự kiện bắt buộc");
      return;
    }
    if (!form.event_start_date || !form.event_end_date) {
      toast.error("Ngày diễn ra bắt buộc");
      return;
    }
    if (new Date(form.event_end_date) < new Date(form.event_start_date)) {
      toast.error("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
      return;
    }
    const regOpen = localInputToIso(form.registration_open);
    const regClose = localInputToIso(form.registration_close);
    if (regOpen && regClose && new Date(regClose) <= new Date(regOpen)) {
      toast.error("Đóng ĐK phải sau Mở ĐK");
      return;
    }
    // Coordinate sanity — if one of lat/lng is set, the other must be too.
    const hasLat = form.location_lat.trim() !== "";
    const hasLng = form.location_lng.trim() !== "";
    if (hasLat !== hasLng) {
      toast.error("Nhập cả lat và lng, hoặc để trống cả hai");
      return;
    }
    const lat = hasLat ? Number(form.location_lat) : undefined;
    const lng = hasLng ? Number(form.location_lng) : undefined;
    if (
      (lat !== undefined && (Number.isNaN(lat) || lat < -90 || lat > 90)) ||
      (lng !== undefined && (Number.isNaN(lng) || lng < -180 || lng > 180))
    ) {
      toast.error("Toạ độ không hợp lệ");
      return;
    }

    setSaving(true);
    try {
      await updateTeamEvent(token, event.id, {
        event_name: form.event_name.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim(),
        location_lat: lat,
        location_lng: lng,
        checkin_radius_m: form.checkin_radius_m,
        event_start_date: form.event_start_date,
        event_end_date: form.event_end_date,
        // Backend DTO has registration_open/close as required strings, so
        // we only send when present — if admin cleared them we'd let
        // backend reject. Empty dates are product-wise nonsensical.
        ...(regOpen ? { registration_open: regOpen } : {}),
        ...(regClose ? { registration_close: regClose } : {}),
        status: form.status,
        contact_email: form.contact_email.trim() || undefined,
        contact_phone: form.contact_phone.trim() || undefined,
        benefits_image_url: form.benefits_image_url.trim() || undefined,
        terms_conditions: form.terms_conditions.trim() || undefined,
      });
      toast.success("Đã lưu cấu hình");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!form || !event) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6 max-w-3xl pb-24">
      <div>
        <h2 className="font-display text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Settings className="size-5 text-gray-400" />
          Cấu hình sự kiện
        </h2>
        <p className="text-xs text-gray-500">
          Sửa toàn bộ thông tin sự kiện: thời gian mở/đóng đăng ký, địa điểm, trạng
          thái, T&C. Xoá sự kiện thực hiện ở trang danh sách.
        </p>
      </div>

      {/* Group 1 — core metadata */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Thông tin cơ bản</h3>
        <div>
          <Label>Tên sự kiện *</Label>
          <Input
            value={form.event_name}
            onChange={(e) => setForm({ ...form, event_name: e.target.value })}
          />
        </div>
        <div>
          <Label>Mô tả ngắn</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
          />
        </div>
        <div>
          <Label>Trạng thái</Label>
          <select
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as Status })
            }
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-500 mt-1">
            Public API chỉ hiện event khi status = &quot;Mở đăng ký&quot; và NOW nằm
            trong khoảng Mở ĐK → Đóng ĐK.
          </p>
        </div>
      </section>

      {/* Group 2 — schedule */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Thời gian</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ngày diễn ra (bắt đầu) *</Label>
            <Input
              type="date"
              value={form.event_start_date}
              onChange={(e) =>
                setForm({ ...form, event_start_date: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Ngày diễn ra (kết thúc) *</Label>
            <Input
              type="date"
              value={form.event_end_date}
              onChange={(e) =>
                setForm({ ...form, event_end_date: e.target.value })
              }
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Mở đăng ký (local time)</Label>
            <Input
              type="datetime-local"
              value={form.registration_open}
              onChange={(e) =>
                setForm({ ...form, registration_open: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Đóng đăng ký (local time)</Label>
            <Input
              type="datetime-local"
              value={form.registration_close}
              onChange={(e) =>
                setForm({ ...form, registration_close: e.target.value })
              }
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-500">
          Thời gian nhập theo giờ máy của bạn, backend lưu dạng UTC.
        </p>
      </section>

      {/* Group 3 — location + checkin */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Địa điểm &amp; Check-in GPS
        </h3>
        <div>
          <Label>Địa điểm</Label>
          <Input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Lat</Label>
            <Input
              inputMode="decimal"
              value={form.location_lat}
              onChange={(e) =>
                setForm({ ...form, location_lat: e.target.value })
              }
              placeholder="21.028511"
            />
          </div>
          <div>
            <Label>Lng</Label>
            <Input
              inputMode="decimal"
              value={form.location_lng}
              onChange={(e) =>
                setForm({ ...form, location_lng: e.target.value })
              }
              placeholder="105.804817"
            />
          </div>
          <div>
            <Label>Bán kính (m)</Label>
            <Input
              type="number"
              min={50}
              value={form.checkin_radius_m}
              onChange={(e) =>
                setForm({
                  ...form,
                  checkin_radius_m: Number(e.target.value) || 500,
                })
              }
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-500">
          GPS self-checkin sẽ chấp nhận người trong bán kính này tính từ toạ độ sự
          kiện. Không set toạ độ → tắt self-checkin GPS, chỉ QR scan hoạt động.
        </p>
      </section>

      {/* Group 4 — contact */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Liên hệ BTC</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.contact_email}
              onChange={(e) =>
                setForm({ ...form, contact_email: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Hotline</Label>
            <Input
              value={form.contact_phone}
              onChange={(e) =>
                setForm({ ...form, contact_phone: e.target.value })
              }
            />
          </div>
        </div>
      </section>

      {/* Group 5 — benefits + T&C */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Quyền lợi &amp; Điều khoản</h3>
        <div>
          <Label>Ảnh quyền lợi khi tham gia</Label>
          {form.benefits_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.benefits_image_url}
              alt="Benefits preview"
              className="mb-2 max-h-40 rounded-md border"
            />
          ) : null}
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingBenefits}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleBenefitsFile(f);
              }}
            />
            {form.benefits_image_url ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setForm({ ...form, benefits_image_url: "" })}
              >
                Gỡ ảnh
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Ảnh này hiện ở trang đăng ký của Crew (mặt trước form).
          </p>
        </div>
        <div>
          <Label>Điều khoản &amp; Cam kết</Label>
          <Textarea
            value={form.terms_conditions}
            onChange={(e) =>
              setForm({ ...form, terms_conditions: e.target.value })
            }
            rows={6}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Hiện ở trang đăng ký — TNV bắt buộc tick xác nhận mới submit được.
          </p>
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-0 flex justify-end gap-2 bg-white border-t py-3 -mx-4 px-4">
        <Button
          variant="ghost"
          onClick={() => setForm(eventToForm(event))}
          disabled={saving}
        >
          Reset
        </Button>
        <Button disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </Button>
      </div>
    </div>
  );
}
