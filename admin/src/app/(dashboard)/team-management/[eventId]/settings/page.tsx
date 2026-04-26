"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getTeamEvent,
  updateTeamEvent,
  uploadTeamPhoto,
  updateEventFeatures,
  type TeamEvent,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Settings, AlertTriangle } from "lucide-react";
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
  contract_code_prefix: string;
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
    contract_code_prefix: e.contract_code_prefix ?? "",
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

  // v1.9: Feature mode state
  const [featureMode, setFeatureMode] = useState<"full" | "lite">("full");
  const [nghiemThu, setNghiemThu] = useState(true);
  const [showLiteConfirm, setShowLiteConfirm] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);

  function handleLiteModeSelect(): void {
    if (featureMode === "full") {
      setShowLiteConfirm(true);
    } else {
      setFeatureMode("lite");
    }
  }

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(eventId)) return;
    try {
      const e = await getTeamEvent(token, eventId);
      setEvent(e);
      setForm(eventToForm(e));
      // v1.9: initialise feature mode state from loaded event
      setFeatureMode(e.feature_mode ?? "full");
      setNghiemThu(e.feature_nghiem_thu ?? true);
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
      // v1.8 QC fix: send `null` (not undefined) for cleared optional
      // strings so the backend actually wipes the stored value. Backend
      // DTO accepts null via ValidateIf pattern; Object.assign copies null
      // into the entity column (all these columns are nullable).
      // `lat` / `lng` already use `undefined` when the admin didn't
      // provide a value at all — but if the admin cleared a previously
      // set coordinate, we want to persist that as null.
      const clearedLatLng = !hasLat && !hasLng;
      const trimmedPrefix = form.contract_code_prefix.trim().toUpperCase();
      await updateTeamEvent(token, event.id, {
        event_name: form.event_name.trim(),
        contract_code_prefix: trimmedPrefix === "" ? null : trimmedPrefix,
        description: form.description.trim() === "" ? null : form.description.trim(),
        location: form.location.trim(),
        location_lat: clearedLatLng ? null : lat,
        location_lng: clearedLatLng ? null : lng,
        checkin_radius_m: form.checkin_radius_m,
        event_start_date: form.event_start_date,
        event_end_date: form.event_end_date,
        // registration_open/close are required on backend — only omit if
        // admin somehow cleared them (blocked by validation above).
        ...(regOpen ? { registration_open: regOpen } : {}),
        ...(regClose ? { registration_close: regClose } : {}),
        status: form.status,
        contact_email: form.contact_email.trim() === "" ? null : form.contact_email.trim(),
        contact_phone: form.contact_phone.trim() === "" ? null : form.contact_phone.trim(),
        benefits_image_url: form.benefits_image_url.trim() === "" ? null : form.benefits_image_url.trim(),
        terms_conditions: form.terms_conditions.trim() === "" ? null : form.terms_conditions.trim(),
      });
      toast.success("Đã lưu cấu hình");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveFeatures(): Promise<void> {
    if (!token) return;
    setSavingFeatures(true);
    try {
      await updateEventFeatures(token, eventId, {
        feature_mode: featureMode,
        feature_nghiem_thu: nghiemThu,
      });
      toast.success("Đã lưu cấu hình tính năng");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingFeatures(false);
    }
  }

  // v1.8 QC fix: surface the #1 operator foot-gun — setting
  // status=open while the registration window doesn't include NOW.
  // Public crew homepage filter (listPublicEvents) strictly requires
  // status='open' AND registration_open <= NOW <= registration_close.
  // Misconfiguring this silently hides the event from the public site.
  const visibilityWarning = ((): string | null => {
    if (!form) return null;
    if (form.status !== "open") return null;
    const now = Date.now();
    const open = form.registration_open
      ? new Date(form.registration_open).getTime()
      : NaN;
    const close = form.registration_close
      ? new Date(form.registration_close).getTime()
      : NaN;
    if (Number.isNaN(open) || Number.isNaN(close)) return null;
    if (now < open) {
      return "Cấu hình hiện tại: status = Mở đăng ký NHƯNG thời điểm mở ĐK còn ở tương lai → event sẽ CHƯA hiện công khai cho đến khi tới giờ mở ĐK.";
    }
    if (now > close) {
      return "Cấu hình hiện tại: status = Mở đăng ký NHƯNG đã QUÁ giờ đóng ĐK → event sẽ KHÔNG hiện công khai trên crew site.";
    }
    return null;
  })();

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

      {visibilityWarning ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="size-4 mt-0.5 flex-shrink-0" />
          <span>{visibilityWarning}</span>
        </div>
      ) : null}

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
          <Label>Mã prefix hợp đồng</Label>
          <Input
            value={form.contract_code_prefix}
            placeholder="VD: HNLLT, MHST, 5BIB..."
            maxLength={10}
            onChange={(e) =>
              setForm({
                ...form,
                contract_code_prefix: e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 10),
              })
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            2–10 ký tự (A-Z, 0-9). Số HĐ sẽ format <code>NNN-{form.contract_code_prefix || "PREFIX"}-HDDV/CTV-5BIB</code>.
            Sau khi đã phát hành 1 HĐ thì <strong>không sửa được</strong> để giữ tính toàn vẹn audit.
          </p>
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

      {/* Group 6 — v1.9 Feature mode */}
      <section className="space-y-4 border-t pt-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Chế độ tính năng</h3>
          <p className="text-xs text-gray-500 mt-1">
            Full mode: toàn bộ tính năng. Lite mode: chỉ nhân sự + hợp đồng + liên lạc.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label
            className={[
              "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
              featureMode === "full"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:bg-gray-50",
            ].join(" ")}
          >
            <input
              type="radio"
              value="full"
              checked={featureMode === "full"}
              onChange={() => setFeatureMode("full")}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium">Full mode</div>
              <div className="text-xs text-gray-500">QR check-in, Trạm, Vật tư</div>
            </div>
          </label>

          <label
            className={[
              "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
              featureMode === "lite"
                ? "border-gray-500 bg-gray-50"
                : "border-gray-200 hover:bg-gray-50",
            ].join(" ")}
          >
            <input
              type="radio"
              value="lite"
              checked={featureMode === "lite"}
              onChange={handleLiteModeSelect}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium">Lite mode</div>
              <div className="text-xs text-gray-500">Chỉ nhân sự + hợp đồng + liên lạc</div>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
          <div>
            <div className="text-sm font-medium">Xác nhận nghiệm thu</div>
            <div className="text-xs text-gray-500">
              Bật = admin phải xác nhận trước khi chuyển trạng thái Hoàn thành
            </div>
          </div>
          <Switch checked={nghiemThu} onCheckedChange={setNghiemThu} />
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={savingFeatures}
            onClick={() => void handleSaveFeatures()}
          >
            {savingFeatures ? "Đang lưu..." : "Lưu tính năng"}
          </Button>
        </div>
      </section>

      {/* Confirm dialog for Full → Lite switch */}
      <Dialog open={showLiteConfirm} onOpenChange={setShowLiteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chuyển sang Lite Mode?</DialogTitle>
            <DialogDescription>
              Sau khi chuyển, các tính năng sau sẽ bị ẩn: QR Check-in, Phân
              công trạm &amp; vật tư. Dữ liệu đã nhập sẽ được giữ lại. Bạn có
              thể chuyển lại Full mode bất cứ lúc nào.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setFeatureMode("full");
                setShowLiteConfirm(false);
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={() => {
                setFeatureMode("lite");
                setShowLiteConfirm(false);
              }}
            >
              Xác nhận chuyển Lite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
