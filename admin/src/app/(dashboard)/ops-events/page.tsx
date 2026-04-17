"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { opsEventsApi, type OpsEvent } from "@/lib/ops-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import { Plus, ExternalLink, Trash2, X } from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Nháp", className: "bg-gray-100 text-gray-700" },
  LIVE: { label: "Live", className: "bg-green-100 text-green-700" },
  ENDED: { label: "Kết thúc", className: "bg-orange-100 text-orange-700" },
};

type CourseInput = { name: string; distance_km: string; start_time: string };
type StationInput = {
  station_id: string;
  name: string;
  courses_served: string; // CSV
};

export default function OpsEventsPage() {
  const { token } = useAuth();
  const confirm = useConfirm();
  const router = useRouter();
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Basic fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [date, setDate] = useState("");
  const [locationName, setLocationName] = useState("");
  // Advanced fields
  const [courses, setCourses] = useState<CourseInput[]>([]);
  const [stations, setStations] = useState<StationInput[]>([]);

  const loadEvents = useCallback(async () => {
    if (!token) return;
    try {
      const res = await opsEventsApi.list(token);
      setEvents(res.items);
    } catch (err) {
      toast.error(
        `Load events thất bại: ${err instanceof Error ? err.message : "Unknown"}`,
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  function resetForm() {
    setName("");
    setSlug("");
    setDate("");
    setLocationName("");
    setCourses([]);
    setStations([]);
  }

  async function handleCreate() {
    if (!token || !name || !slug || !date || !locationName) return;
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        slug: slug.toLowerCase().replace(/\s+/g, "-"),
        date: new Date(date).toISOString(),
        location: { name: locationName },
      };
      if (courses.length > 0) {
        payload.courses = courses
          .filter((c) => c.name && c.distance_km && c.start_time)
          .map((c) => ({
            name: c.name,
            distance_km: Number(c.distance_km),
            start_time: new Date(c.start_time).toISOString(),
          }));
      }
      if (stations.length > 0) {
        payload.stations = stations
          .filter((s) => s.station_id && s.name)
          .map((s) => ({
            station_id: s.station_id,
            name: s.name,
            courses_served: s.courses_served
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          }));
      }
      await opsEventsApi.create(token, payload);
      toast.success("Tạo event thành công");
      setDialogOpen(false);
      resetForm();
      await loadEvents();
    } catch (err) {
      toast.error(`Lỗi: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(
    ev: OpsEvent,
    newStatus: "DRAFT" | "LIVE" | "ENDED",
  ) {
    if (!token || ev.status === newStatus) return;
    try {
      await opsEventsApi.update(token, ev.id, { status: newStatus });
      toast.success(`Đã chuyển "${ev.name}" → ${newStatus}`);
      await loadEvents();
    } catch (err) {
      toast.error(`Lỗi: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  async function handleArchive(ev: OpsEvent) {
    if (!token) return;
    const ok = await confirm({
      title: "Archive event?",
      description: `"${ev.name}" sẽ bị soft-delete. Không thể khôi phục từ UI.`,
      confirmLabel: "Archive",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await opsEventsApi.archive(token, ev.id);
      toast.success(`Đã archive "${ev.name}"`);
      await loadEvents();
    } catch (err) {
      toast.error(`Lỗi: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Race Ops — Events
          </h1>
          <p className="text-sm text-muted-foreground">
            Quản lý sự kiện vận hành
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) resetForm();
          }}
        >
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 size-4" />
            Tạo Event
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tạo Event Mới</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Basic */}
              <div className="grid gap-2">
                <Label>Tên event</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="HHTT2026"
                />
              </div>
              <div className="grid gap-2">
                <Label>Slug (URL-safe)</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="hhtt2026"
                />
              </div>
              <div className="grid gap-2">
                <Label>Ngày tổ chức</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Địa điểm</Label>
                <Input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Quảng trường Hồ Chí Minh, TP Vinh"
                />
              </div>

              {/* Courses */}
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Cự ly (tùy chọn)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCourses((c) => [
                        ...c,
                        { name: "", distance_km: "", start_time: "" },
                      ])
                    }
                  >
                    <Plus className="mr-1 size-3" />
                    Thêm
                  </Button>
                </div>
                {courses.map((c, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_100px_1fr_auto] gap-2"
                  >
                    <Input
                      value={c.name}
                      placeholder="42KM"
                      onChange={(e) => {
                        const v = e.target.value;
                        setCourses((arr) =>
                          arr.map((x, idx) =>
                            idx === i ? { ...x, name: v } : x,
                          ),
                        );
                      }}
                    />
                    <Input
                      type="number"
                      step="0.1"
                      value={c.distance_km}
                      placeholder="42.2"
                      onChange={(e) => {
                        const v = e.target.value;
                        setCourses((arr) =>
                          arr.map((x, idx) =>
                            idx === i ? { ...x, distance_km: v } : x,
                          ),
                        );
                      }}
                    />
                    <Input
                      type="datetime-local"
                      value={c.start_time}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCourses((arr) =>
                          arr.map((x, idx) =>
                            idx === i ? { ...x, start_time: v } : x,
                          ),
                        );
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setCourses((arr) => arr.filter((_, idx) => idx !== i))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                {courses.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Chưa có cự ly nào.
                  </p>
                )}
              </div>

              {/* Stations */}
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Trạm (tùy chọn)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setStations((s) => [
                        ...s,
                        { station_id: "", name: "", courses_served: "" },
                      ])
                    }
                  >
                    <Plus className="mr-1 size-3" />
                    Thêm
                  </Button>
                </div>
                {stations.map((s, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[100px_1fr_1fr_auto] gap-2"
                  >
                    <Input
                      value={s.station_id}
                      placeholder="N01"
                      onChange={(e) => {
                        const v = e.target.value;
                        setStations((arr) =>
                          arr.map((x, idx) =>
                            idx === i ? { ...x, station_id: v } : x,
                          ),
                        );
                      }}
                    />
                    <Input
                      value={s.name}
                      placeholder="Trạm nước 2km"
                      onChange={(e) => {
                        const v = e.target.value;
                        setStations((arr) =>
                          arr.map((x, idx) =>
                            idx === i ? { ...x, name: v } : x,
                          ),
                        );
                      }}
                    />
                    <Input
                      value={s.courses_served}
                      placeholder="42KM,21KM"
                      onChange={(e) => {
                        const v = e.target.value;
                        setStations((arr) =>
                          arr.map((x, idx) =>
                            idx === i ? { ...x, courses_served: v } : x,
                          ),
                        );
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setStations((arr) => arr.filter((_, idx) => idx !== i))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                {stations.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Chưa có trạm nào. Cự ly phục vụ: CSV (VD: 42KM,21KM).
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={
                  creating || !name || !slug || !date || !locationName
                }
              >
                {creating ? "Đang tạo..." : "Tạo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            Chưa có event nào. Tạo event đầu tiên!
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Địa điểm</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[200px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => {
                const badge = STATUS_BADGE[ev.status] ?? STATUS_BADGE.DRAFT;
                return (
                  <TableRow key={ev.id}>
                    <TableCell
                      className="cursor-pointer font-medium hover:underline"
                      onClick={() => router.push(`/ops-events/${ev.id}`)}
                    >
                      {ev.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ev.slug}
                    </TableCell>
                    <TableCell>
                      {new Date(ev.date).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell>{ev.location?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={badge.className}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Select
                          value={ev.status}
                          onValueChange={(v) =>
                            handleStatusChange(
                              ev,
                              v as "DRAFT" | "LIVE" | "ENDED",
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DRAFT">Nháp</SelectItem>
                            <SelectItem value="LIVE">Live</SelectItem>
                            <SelectItem value="ENDED">Kết thúc</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Mở chi tiết"
                          onClick={() =>
                            router.push(`/ops-events/${ev.id}`)
                          }
                        >
                          <ExternalLink className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Archive"
                          className="text-red-600"
                          onClick={() => handleArchive(ev)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
