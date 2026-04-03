"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api"; // ensure client baseUrl is configured
import { authHeaders } from "@/lib/api";
import {
  racesControllerGetRaceById,
  racesControllerUpdateRace,
  racesControllerUpdateStatus,
  racesControllerAddCourse,
  racesControllerUpdateCourse,
  racesControllerRemoveCourse,
  adminControllerForceSync,
  adminControllerResetData,
  raceResultControllerGetRaceResults,
  sponsorsControllerFindByRaceId,
  sponsorsControllerCreate,
  sponsorsControllerUpdate,
  sponsorsControllerRemove,
} from "@/lib/api-generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import ImageUpload from "@/components/ImageUpload";
import SponsorBanners from "@/components/SponsorBanners";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  RotateCcw,
  Save,
  Mountain,
  Clock,
  MapPin,
  Image as ImageIcon,
  Download,
} from "lucide-react";

type RaceStatus = "draft" | "pre_race" | "live" | "ended";

interface Checkpoint {
  key: string;
  name: string;
  distance?: string;
}

interface Course {
  courseId: string;
  name: string;
  distance?: string;
  distanceKm?: number;
  courseType?: string;
  apiFormat?: string;
  apiUrl?: string;
  imageUrl?: string;
  elevationGain?: number;
  cutOffTime?: string;
  startTime?: string;
  startLocation?: string;
  mapUrl?: string;
  gpxUrl?: string;
  checkpoints?: Checkpoint[];
}

interface Race {
  _id: string;
  title: string;
  slug: string;
  status: RaceStatus;
  raceType?: string;
  province?: string;
  location?: string;
  organizer?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  season?: string;
  imageUrl?: string;
  logoUrl?: string;
  bannerUrl?: string;
  brandColor?: string;
  sponsorBanners?: string[];
  enableEcert?: boolean;
  enableClaim?: boolean;
  enableLiveTracking?: boolean;
  enable5pix?: boolean;
  pixEventUrl?: string;
  cacheTtlSeconds?: number;
  courses?: Course[];
}

function StatusBadge({ status }: { status: RaceStatus }) {
  const config: Record<RaceStatus, { label: string; className: string }> = {
    draft: { label: "Nháp", className: "bg-yellow-500/20 text-yellow-400" },
    pre_race: { label: "Chuẩn bị", className: "bg-blue-500/20 text-blue-400" },
    live: { label: "Đang diễn ra", className: "bg-green-500/20 text-green-400" },
    ended: { label: "Đã kết thúc", className: "bg-zinc-500/20 text-zinc-400" },
  };
  const c = config[status] || config.ended;
  return (
    <Badge className={c.className}>
      {status === "live" && (
        <span className="mr-1 inline-block size-2 animate-pulse rounded-full bg-green-400" />
      )}
      {c.label}
    </Badge>
  );
}

export default function RaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const raceId = params.id as string;

  const [race, setRace] = useState<Race | null>(null);
  const [activeTab, setActiveTab] = useState("info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  // Course dialog
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState<Record<string, any>>({
    courseId: "",
    name: "",
    distance: "",
    courseType: "split",
    apiFormat: "json",
    apiUrl: "",
    checkpoints: [] as Checkpoint[],
  });
  const [savingCourse, setSavingCourse] = useState(false);

  // Syncing state
  const [syncingCourseId, setSyncingCourseId] = useState<string | null>(null);
  const [resettingCourseId, setResettingCourseId] = useState<string | null>(null);

  // Race sponsors state
  interface RaceSponsor {
    _id: string;
    name: string;
    logoUrl: string;
    website?: string;
    level: string;
    order: number;
    raceId?: string;
  }
  const [raceSponsors, setRaceSponsors] = useState<RaceSponsor[]>([]);
  const [loadingSponsors, setLoadingSponsors] = useState(false);
  const [sponsorDialogOpen, setSponsorDialogOpen] = useState(false);
  const [sponsorForm, setSponsorForm] = useState({ name: '', logoUrl: '', website: '', level: 'silver', order: 0 });
  const [editingSponsor, setEditingSponsor] = useState<RaceSponsor | null>(null);
  const [savingSponsor, setSavingSponsor] = useState(false);

  const fetchRace = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data, error } = await racesControllerGetRaceById({
        path: { id: raceId },
        ...authHeaders(token),
      });

      if (error) throw new Error("Race not found");

      const body = data as any;
      const raceData = (body?.data ?? body) as Race;
      setRace(raceData);
      setEditForm({
        title: raceData.title,
        slug: raceData.slug,
        status: raceData.status,
        raceType: raceData.raceType,
        province: raceData.province,
        location: raceData.location,
        organizer: raceData.organizer,
        startDate: raceData.startDate,
        endDate: raceData.endDate,
        description: raceData.description,
        season: raceData.season,
        imageUrl: raceData.imageUrl,
        logoUrl: raceData.logoUrl,
        bannerUrl: raceData.bannerUrl,
        brandColor: raceData.brandColor,
        sponsorBanners: raceData.sponsorBanners || [],
        enableEcert: raceData.enableEcert ?? false,
        enableClaim: raceData.enableClaim ?? false,
        enableLiveTracking: raceData.enableLiveTracking ?? false,
        enable5pix: raceData.enable5pix ?? false,
        pixEventUrl: raceData.pixEventUrl,
        cacheTtlSeconds: raceData.cacheTtlSeconds ?? 60,
      });
    } catch {
      toast.error("Không thể tải thông tin giải");
    } finally {
      setLoading(false);
    }
  }, [token, raceId]);

  useEffect(() => {
    fetchRace();
  }, [fetchRace]);

  // ─── Race Sponsors ─────────────────────────────
  const fetchRaceSponsors = useCallback(async () => {
    if (!token) return;
    setLoadingSponsors(true);
    try {
      const { data, error } = await sponsorsControllerFindByRaceId({
        path: { raceId },
        ...authHeaders(token),
      });
      if (!error) {
        const body = data as any;
        setRaceSponsors(body?.data ?? body ?? []);
      }
    } catch { /* ignore */ } finally {
      setLoadingSponsors(false);
    }
  }, [token, raceId]);

  useEffect(() => {
    if (activeTab === 'sponsors') fetchRaceSponsors();
  }, [activeTab, fetchRaceSponsors]);

  function openAddSponsor() {
    setEditingSponsor(null);
    setSponsorForm({ name: '', logoUrl: '', website: '', level: 'silver', order: 0 });
    setSponsorDialogOpen(true);
  }

  function openEditSponsor(s: RaceSponsor) {
    setEditingSponsor(s);
    setSponsorForm({ name: s.name, logoUrl: s.logoUrl, website: s.website || '', level: s.level, order: s.order });
    setSponsorDialogOpen(true);
  }

  async function handleSaveSponsor() {
    if (!token) return;
    setSavingSponsor(true);
    try {
      const payload = { ...sponsorForm, raceId };
      if (editingSponsor) {
        const { error } = await sponsorsControllerUpdate({
          path: { id: editingSponsor._id },
          body: payload as any,
          ...authHeaders(token),
        });
        if (error) throw new Error('Update failed');
        toast.success('Đã cập nhật nhà tài trợ');
      } else {
        const { error } = await sponsorsControllerCreate({
          body: payload as any,
          ...authHeaders(token),
        });
        if (error) throw new Error('Create failed');
        toast.success('Đã thêm nhà tài trợ');
      }
      setSponsorDialogOpen(false);
      fetchRaceSponsors();
    } catch {
      toast.error('Lưu nhà tài trợ thất bại');
    } finally {
      setSavingSponsor(false);
    }
  }

  async function handleDeleteSponsor(id: string) {
    if (!token) return;
    try {
      const { error } = await sponsorsControllerRemove({
        path: { id },
        ...authHeaders(token),
      });
      if (error) throw new Error('Delete failed');
      toast.success('Đã xóa nhà tài trợ');
      fetchRaceSponsors();
    } catch {
      toast.error('Xóa nhà tài trợ thất bại');
    }
  }

  async function handleSaveRace() {
    if (!token || !race) return;
    setSaving(true);
    try {
      const { error } = await racesControllerUpdateRace({
        path: { id: raceId },
        body: {
          ...editForm,
          status: editForm.status || race.status,
          cacheTtlSeconds: editForm.cacheTtlSeconds ?? 60,
        } as any,
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Cập nhật giải thành công!");
      fetchRace();
    } catch {
      toast.error("Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(newStatus: RaceStatus) {
    if (!token) return;
    try {
      const { error } = await racesControllerUpdateStatus({
        path: { id: raceId },
        body: { status: newStatus } as any,
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success(`Đã chuyển sang ${newStatus}`);
      fetchRace();
    } catch {
      toast.error("Cập nhật trạng thái thất bại");
    }
  }

  async function handleSaveCourse() {
    if (!token || !courseForm.name) return;
    setSavingCourse(true);
    try {
      if (editingCourse) {
        const { error } = await racesControllerUpdateCourse({
          path: { id: raceId, courseId: editingCourse.courseId },
          body: {
            name: courseForm.name,
            distance: courseForm.distance,
            distanceKm: courseForm.distanceKm,
            courseType: courseForm.courseType,
            apiFormat: courseForm.apiFormat,
            apiUrl: courseForm.apiUrl,
            imageUrl: courseForm.imageUrl,
            elevationGain: courseForm.elevationGain,
            cutOffTime: courseForm.cutOffTime,
            startTime: courseForm.startTime,
            startLocation: courseForm.startLocation,
            mapUrl: courseForm.mapUrl,
            gpxUrl: courseForm.gpxUrl,
            checkpoints: courseForm.checkpoints?.length ? courseForm.checkpoints : undefined,
          } as any,
          ...authHeaders(token),
        });
        if (error) throw error;
        toast.success("Cập nhật cự ly thành công!");
      } else {
        const { error } = await racesControllerAddCourse({
          path: { id: raceId },
          body: {
            name: courseForm.name,
            distance: courseForm.distance,
            distanceKm: courseForm.distanceKm,
            courseType: courseForm.courseType,
            apiFormat: courseForm.apiFormat,
            apiUrl: courseForm.apiUrl,
            imageUrl: courseForm.imageUrl,
            elevationGain: courseForm.elevationGain,
            cutOffTime: courseForm.cutOffTime,
            startTime: courseForm.startTime,
            startLocation: courseForm.startLocation,
            mapUrl: courseForm.mapUrl,
            gpxUrl: courseForm.gpxUrl,
            checkpoints: courseForm.checkpoints?.length ? courseForm.checkpoints : undefined,
          } as any,
          ...authHeaders(token),
        });
        if (error) throw error;
        toast.success("Thêm cự ly thành công!");

        // Auto-sync if apiUrl is provided
        if (courseForm.apiUrl) {
          const cid = courseForm.courseId || courseForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          toast.info("Đang đồng bộ dữ liệu...");
          try {
            await adminControllerForceSync({
              path: { raceId: raceId, courseId: cid },
              ...authHeaders(token),
            });
            toast.success("Đồng bộ dữ liệu thành công!");
          } catch {
            toast.warning("Đồng bộ thất bại, sẽ tự động đồng bộ sau 10 phút");
          }
        }
      }
      setCourseDialogOpen(false);
      setEditingCourse(null);
      setCourseForm({ courseId: "", name: "", distance: "", courseType: "split", apiFormat: "json", apiUrl: "", checkpoints: [], imageUrl: "", elevationGain: undefined, cutOffTime: "", startTime: "", startLocation: "", mapUrl: "", gpxUrl: "" });
      fetchRace();
    } catch {
      toast.error("Lưu cự ly thất bại");
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleRemoveCourse(courseId: string) {
    if (!token) return;
    try {
      const { error } = await racesControllerRemoveCourse({
        path: { id: raceId, courseId },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Đã xóa cự ly!");
      fetchRace();
    } catch {
      toast.error("Xóa cự ly thất bại");
    }
  }

  async function handleForceSync(courseId: string) {
    if (!token) return;
    setSyncingCourseId(courseId);
    try {
      const { error } = await adminControllerForceSync({
        path: { raceId, courseId },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Đồng bộ thành công!");
    } catch {
      toast.error("Đồng bộ thất bại");
    } finally {
      setSyncingCourseId(null);
    }
  }

  async function handleResetData(courseId: string) {
    if (!token) return;
    setResettingCourseId(courseId);
    try {
      const { error } = await adminControllerResetData({
        path: { raceId, courseId },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Đã xóa dữ liệu!");
    } catch {
      toast.error("Xóa dữ liệu thất bại");
    } finally {
      setResettingCourseId(null);
    }
  }

  async function handleExportCSV(courseId: string, courseName: string) {
    try {
      // Fetch all results (large page)
      const { data: body, error } = await raceResultControllerGetRaceResults({
        query: { course_id: courseId, pageNo: 1, pageSize: 10000, sortField: 'OverallRank', sortDirection: 'ASC' },
      });
      if (error) { toast.error("Không thể tải dữ liệu"); return; }
      const results = (body as any)?.data ?? [];
      if (results.length === 0) { toast.error("Không có dữ liệu để xuất"); return; }

      const headers = ['Rank', 'BIB', 'Name', 'Gender', 'Category', 'ChipTime', 'GunTime', 'Pace', 'Gap', 'Nationality'];
      const csvRows = [headers.join(',')];
      for (const r of results) {
        csvRows.push([
          r.OverallRank, r.Bib, `"${(r.Name || '').replace(/"/g, '""')}"`,
          r.Gender, r.Category, r.ChipTime, r.GunTime, r.Pace, r.Gap, r.Nationality,
        ].join(','));
      }

      const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${race?.title || 'race'}-${courseName || courseId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Đã xuất ${results.length} kết quả`);
    } catch {
      toast.error("Xuất CSV thất bại");
    }
  }

  function openEditCourse(course: Course) {
    setEditingCourse(course);
    setCourseForm({
      courseId: course.courseId,
      name: course.name,
      distance: course.distance,
      distanceKm: course.distanceKm,
      courseType: course.courseType || "split",
      apiFormat: course.apiFormat || "json",
      apiUrl: course.apiUrl,
      imageUrl: course.imageUrl,
      elevationGain: course.elevationGain,
      cutOffTime: course.cutOffTime,
      startTime: course.startTime,
      startLocation: course.startLocation,
      mapUrl: course.mapUrl,
      gpxUrl: course.gpxUrl,
      checkpoints: course.checkpoints || [],
    });
    setCourseDialogOpen(true);
  }

  function openAddCourse() {
    setEditingCourse(null);
    setCourseForm({ courseId: "", name: "", distance: "", courseType: "split", apiFormat: "json", apiUrl: "", checkpoints: [], imageUrl: "", elevationGain: undefined, cutOffTime: "", startTime: "", startLocation: "", mapUrl: "", gpxUrl: "" });
    setCourseDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!race) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Không tìm thấy giải</p>
        <Button variant="outline" onClick={() => router.push("/races")}>
          Quay lại
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/races")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{race.title}</h1>
          <p className="text-sm text-muted-foreground">{race.slug}</p>
        </div>
        <StatusBadge status={race.status} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="courses">
            Cự ly ({race.courses?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="branding">Hình ảnh & Thương hiệu</TabsTrigger>
          <TabsTrigger value="features">Tính năng</TabsTrigger>
          <TabsTrigger value="sponsors">Nhà tài trợ</TabsTrigger>
        </TabsList>

        {/* ════════════ Info Tab ════════════ */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin giải chạy</CardTitle>
              <CardDescription>
                Cập nhật thông tin cơ bản của giải
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Status Controls — Clear Lifecycle */}
              <div className="flex flex-col gap-3">
                <Label>Trạng thái giải đấu</Label>
                <div className="grid grid-cols-4 gap-3">
                  {([
                    {
                      key: "draft" as RaceStatus,
                      label: "Nháp",
                      desc: "Ẩn khỏi trang công khai",
                      icon: "✏️",
                      activeClass: "border-yellow-500 bg-yellow-50 text-yellow-800",
                      dotClass: "bg-yellow-500",
                    },
                    {
                      key: "pre_race" as RaceStatus,
                      label: "Chuẩn bị",
                      desc: "Giải chưa diễn ra",
                      icon: "📋",
                      activeClass: "border-blue-500 bg-blue-50 text-blue-800",
                      dotClass: "bg-blue-500",
                    },
                    {
                      key: "live" as RaceStatus,
                      label: "Đang diễn ra",
                      desc: "Giải đang thi đấu",
                      icon: "🏃",
                      activeClass: "border-green-500 bg-green-50 text-green-800",
                      dotClass: "bg-green-500 animate-pulse",
                    },
                    {
                      key: "ended" as RaceStatus,
                      label: "Đã kết thúc",
                      desc: "Giải đã hoàn tất",
                      icon: "🏁",
                      activeClass: "border-zinc-400 bg-zinc-50 text-zinc-700",
                      dotClass: "bg-zinc-400",
                    },
                  ]).map((step) => {
                    const isCurrent = race.status === step.key;
                    return (
                      <button
                        key={step.key}
                        onClick={() => {
                          if (isCurrent) return;
                          if (confirm(`Chuyển trạng thái giải sang "${step.label}"?`)) {
                            handleUpdateStatus(step.key);
                          }
                        }}
                        className={`
                          relative flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all text-center
                          ${isCurrent
                            ? step.activeClass
                            : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:border-muted-foreground/20 cursor-pointer"
                          }
                        `}
                      >
                        {isCurrent && (
                          <span className={`absolute top-2 right-2 size-2.5 rounded-full ${step.dotClass}`} />
                        )}
                        <span className="text-2xl">{step.icon}</span>
                        <span className={`text-sm font-semibold ${isCurrent ? "" : "opacity-70"}`}>
                          {step.label}
                        </span>
                        <span className={`text-[10px] ${isCurrent ? "opacity-70" : "opacity-50"}`}>
                          {step.desc}
                        </span>
                        {isCurrent && (
                          <span className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-60">
                            Hiện tại
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-title">Tên giải</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title ?? ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({ ...p, title: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-slug">Đường dẫn SEO</Label>
                  <Input
                    id="edit-slug"
                    value={editForm.slug ?? ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({ ...p, slug: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-type">Loại hình</Label>
                  <Input
                    id="edit-type"
                    value={editForm.raceType ?? ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({ ...p, raceType: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-province">Tỉnh/Thành</Label>
                  <Input
                    id="edit-province"
                    value={editForm.province ?? ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({ ...p, province: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-location">Địa điểm</Label>
                  <Input
                    id="edit-location"
                    value={editForm.location ?? ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({ ...p, location: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-organizer">Ban tổ chức</Label>
                  <Input
                    id="edit-organizer"
                    value={editForm.organizer ?? ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({ ...p, organizer: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-season">Mùa giải</Label>
                  <Input
                    id="edit-season"
                    value={editForm.season ?? ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({ ...p, season: e.target.value }))
                    }
                    placeholder="2026"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-ttl">Thời gian cache (giây)</Label>
                  <Input
                    id="edit-ttl"
                    type="number"
                    value={editForm.cacheTtlSeconds ?? 60}
                    onChange={(e) =>
                      setEditForm((p: any) => ({
                        ...p,
                        cacheTtlSeconds: parseInt(e.target.value) || 60,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-start">Ngày bắt đầu</Label>
                  <Input
                    id="edit-start"
                    type="date"
                    value={editForm.startDate?.slice(0, 10) ?? ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({
                        ...p,
                        startDate: e.target.value
                          ? new Date(e.target.value + "T00:00:00").toISOString()
                          : undefined,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-end">Ngày kết thúc</Label>
                  <Input
                    id="edit-end"
                    type="date"
                    value={editForm.endDate?.slice(0, 10) ?? ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({
                        ...p,
                        endDate: e.target.value
                          ? new Date(e.target.value + "T00:00:00").toISOString()
                          : undefined,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Description (full width) */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-desc">Mô tả</Label>
                <textarea
                  id="edit-desc"
                  rows={3}
                  value={editForm.description ?? ""}
                  onChange={(e) =>
                    setEditForm((p: any) => ({ ...p, description: e.target.value }))
                  }
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Mô tả giải chạy..."
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveRace} disabled={saving}>
                  <Save className="size-4 mr-2" />
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════ Courses Tab ════════════ */}
        <TabsContent value="courses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Cự ly</CardTitle>
                <CardDescription>
                  Quản lý các cự ly của giải
                </CardDescription>
              </div>
              <Button size="sm" onClick={openAddCourse}>
                <Plus className="size-4 mr-1" />
                Thêm
              </Button>
              <Dialog open={courseDialogOpen} onOpenChange={(open) => {
                setCourseDialogOpen(open);
                if (!open) {
                  setEditingCourse(null);
                  setCourseForm({ courseId: "", name: "", distance: "", courseType: "split", apiFormat: "json", apiUrl: "", checkpoints: [], imageUrl: "", elevationGain: undefined, cutOffTime: "", startTime: "", startLocation: "", mapUrl: "", gpxUrl: "" });
                }
              }}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingCourse ? "Sửa cự ly" : "Thêm cự ly"}
                    </DialogTitle>
                    <DialogDescription>
                      Nhập thông tin cự ly
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-4">
                    <div className="flex flex-col gap-2">
                      <Label>Tên cự ly *</Label>
                      <Input
                        value={courseForm.name ?? ""}
                        onChange={(e) =>
                          setCourseForm((p: any) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="42km Full Marathon"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Khoảng cách</Label>
                        <Input
                          value={courseForm.distance ?? ""}
                          onChange={(e) =>
                            setCourseForm((p: any) => ({ ...p, distance: e.target.value }))
                          }
                          placeholder="42km"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Km</Label>
                        <Input
                          type="number"
                          value={courseForm.distanceKm ?? ""}
                          onChange={(e) =>
                            setCourseForm((p: any) => ({
                              ...p,
                              distanceKm: parseFloat(e.target.value) || undefined,
                            }))
                          }
                          placeholder="42.195"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Loại cự ly</Label>
                        <Select
                          value={courseForm.courseType ?? "split"}
                          onValueChange={(val) =>
                            setCourseForm((p: any) => ({ ...p, courseType: val }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="split">Split Race</SelectItem>
                            <SelectItem value="lap">Lap Race</SelectItem>
                            <SelectItem value="team_relay">Team Relay</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Định dạng API</Label>
                        <Select
                          value={courseForm.apiFormat ?? "json"}
                          onValueChange={(val) =>
                            setCourseForm((p: any) => ({ ...p, apiFormat: val }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="json">JSON</SelectItem>
                            <SelectItem value="csv">CSV</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>API URL</Label>
                      <Input
                        value={courseForm.apiUrl ?? ""}
                        onChange={(e) =>
                          setCourseForm((p: any) => ({ ...p, apiUrl: e.target.value }))
                        }
                        placeholder="https://my.raceresult.com/api/results?contest=708"
                      />
                    </div>

                    <Separator />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Thông tin bổ sung</p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label className="flex items-center gap-1.5">
                          <Mountain className="size-3.5" /> Tổng leo cao (m)
                        </Label>
                        <Input
                          type="number"
                          value={courseForm.elevationGain ?? ""}
                          onChange={(e) =>
                            setCourseForm((p: any) => ({
                              ...p,
                              elevationGain: parseInt(e.target.value) || undefined,
                            }))
                          }
                          placeholder="1500"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="flex items-center gap-1.5">
                          <Clock className="size-3.5" /> Giờ xuất phát
                        </Label>
                        <Input
                          value={courseForm.startTime ?? ""}
                          onChange={(e) =>
                            setCourseForm((p: any) => ({ ...p, startTime: e.target.value }))
                          }
                          placeholder="05:00"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label className="flex items-center gap-1.5">
                          <MapPin className="size-3.5" /> Địa điểm xuất phát
                        </Label>
                        <Input
                          value={courseForm.startLocation ?? ""}
                          onChange={(e) =>
                            setCourseForm((p: any) => ({ ...p, startLocation: e.target.value }))
                          }
                          placeholder="Quảng trường Lâm Viên"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="flex items-center gap-1.5">
                          <Clock className="size-3.5" /> Cut-off time (COT)
                        </Label>
                        <Input
                          value={courseForm.cutOffTime ?? ""}
                          onChange={(e) =>
                            setCourseForm((p: any) => ({ ...p, cutOffTime: e.target.value }))
                          }
                          placeholder="12:00:00"
                        />
                      </div>
                    </div>

                    <Separator />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hình ảnh</p>

                    <div className="flex flex-col gap-2">
                      <Label className="flex items-center gap-1.5">
                        <ImageIcon className="size-3.5" /> Ảnh cự ly
                      </Label>
                      <ImageUpload
                        value={courseForm.imageUrl}
                        onChange={(url) =>
                          setCourseForm((p: any) => ({ ...p, imageUrl: url }))
                        }
                        folder={`races/${raceId}/courses`}
                        token={token || undefined}
                        label="Tải ảnh cự ly"
                        previewHeight="h-28"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Bản đồ cự ly</Label>
                      <ImageUpload
                        value={courseForm.mapUrl}
                        onChange={(url) =>
                          setCourseForm((p: any) => ({ ...p, mapUrl: url }))
                        }
                        folder={`races/${raceId}/maps`}
                        token={token || undefined}
                        label="Tải bản đồ"
                        previewHeight="h-28"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>File GPX</Label>
                      <div className="flex gap-2">
                        <Input
                          value={courseForm.gpxUrl ?? ""}
                          onChange={(e) =>
                            setCourseForm((p: any) => ({ ...p, gpxUrl: e.target.value }))
                          }
                          placeholder="URL file GPX"
                        />
                      </div>
                    </div>

                    <Separator />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Checkpoints</p>

                    <div className="flex flex-col gap-3">
                      {(courseForm.checkpoints as Checkpoint[] || []).map(
                        (cp: Checkpoint, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
                            <div className="grid flex-1 grid-cols-3 gap-2">
                              <Input
                                value={cp.key}
                                onChange={(e) => {
                                  const updated = [...(courseForm.checkpoints as Checkpoint[])];
                                  updated[idx] = { ...updated[idx], key: e.target.value };
                                  setCourseForm((p: any) => ({ ...p, checkpoints: updated }));
                                }}
                                placeholder="Key (VD: TM1)"
                                className="text-sm"
                              />
                              <Input
                                value={cp.name}
                                onChange={(e) => {
                                  const updated = [...(courseForm.checkpoints as Checkpoint[])];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  setCourseForm((p: any) => ({ ...p, checkpoints: updated }));
                                }}
                                placeholder="Tên (VD: CP1 - Suối Vàng)"
                                className="text-sm"
                              />
                              <Input
                                value={cp.distance ?? ""}
                                onChange={(e) => {
                                  const updated = [...(courseForm.checkpoints as Checkpoint[])];
                                  updated[idx] = { ...updated[idx], distance: e.target.value || undefined };
                                  setCourseForm((p: any) => ({ ...p, checkpoints: updated }));
                                }}
                                placeholder="Khoảng cách (VD: 10K)"
                                className="text-sm"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => {
                                const updated = (courseForm.checkpoints as Checkpoint[]).filter(
                                  (_: Checkpoint, i: number) => i !== idx
                                );
                                setCourseForm((p: any) => ({ ...p, checkpoints: updated }));
                              }}
                              title="Xóa checkpoint"
                            >
                              <Trash2 className="size-3 text-destructive" />
                            </Button>
                          </div>
                        )
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = [
                            ...(courseForm.checkpoints as Checkpoint[] || []),
                            { key: "", name: "", distance: "" },
                          ];
                          setCourseForm((p: any) => ({ ...p, checkpoints: updated }));
                        }}
                      >
                        <Plus className="size-4 mr-1" />
                        Thêm checkpoint
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleSaveCourse}
                      disabled={savingCourse || !courseForm.name}
                    >
                      {savingCourse ? "Đang lưu..." : "Lưu"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {!race.courses || race.courses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Chưa có cự ly nào. Nhấn &quot;Thêm&quot; để bắt đầu.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên</TableHead>
                      <TableHead className="hidden sm:table-cell">Khoảng cách</TableHead>
                      <TableHead className="hidden md:table-cell">Giờ xuất phát</TableHead>
                      <TableHead className="hidden lg:table-cell">Đường dẫn API</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {race.courses.map((course) => (
                      <TableRow key={course.courseId}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {course.imageUrl && (
                              <img src={course.imageUrl} alt="" className="size-8 rounded object-cover" />
                            )}
                            <div>
                              <div>{course.name}</div>
                              {course.startTime && (
                                <span className="text-xs text-muted-foreground">{course.startTime}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {course.distance || "-"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {course.startTime || "-"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[200px] truncate">
                          {course.apiUrl || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleExportCSV(course.courseId, course.name)}
                              title="Xuất CSV"
                            >
                              <Download className="size-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleForceSync(course.courseId)}
                              disabled={syncingCourseId === course.courseId}
                              title="Ép đồng bộ"
                            >
                              <RefreshCw
                                className={`size-3 ${
                                  syncingCourseId === course.courseId ? "animate-spin" : ""
                                }`}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleResetData(course.courseId)}
                              disabled={resettingCourseId === course.courseId}
                              title="Xóa dữ liệu"
                            >
                              <RotateCcw className="size-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => openEditCourse(course)}
                              title="Sửa"
                            >
                              <Pencil className="size-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleRemoveCourse(course.courseId)}
                              title="Xóa"
                            >
                              <Trash2 className="size-3 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={openAddCourse}>
                  <Plus className="size-4 mr-1" />
                  Thêm cự ly
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════ Branding Tab ════════════ */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Hình ảnh & Thương hiệu</CardTitle>
              <CardDescription>
                Logo, banner, ảnh đại diện và nhà tài trợ
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Logo */}
                <div className="flex flex-col gap-2">
                  <Label>Logo giải</Label>
                  <ImageUpload
                    value={editForm.logoUrl}
                    onChange={(url) =>
                      setEditForm((p: any) => ({ ...p, logoUrl: url }))
                    }
                    folder={`races/${raceId}/logos`}
                    token={token || undefined}
                    label="Tải logo"
                    previewHeight="h-24"
                  />
                </div>

                {/* Image (cover) */}
                <div className="flex flex-col gap-2">
                  <Label>Ảnh đại diện</Label>
                  <ImageUpload
                    value={editForm.imageUrl}
                    onChange={(url) =>
                      setEditForm((p: any) => ({ ...p, imageUrl: url }))
                    }
                    folder={`races/${raceId}/images`}
                    token={token || undefined}
                    label="Tải ảnh đại diện"
                    previewHeight="h-32"
                  />
                </div>

                {/* Banner */}
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>Banner (ảnh bìa trang giải)</Label>
                  <ImageUpload
                    value={editForm.bannerUrl}
                    onChange={(url) =>
                      setEditForm((p: any) => ({ ...p, bannerUrl: url }))
                    }
                    folder={`races/${raceId}/banners`}
                    token={token || undefined}
                    label="Tải banner"
                    previewHeight="h-40"
                  />
                </div>

                {/* Brand Color */}
                <div className="flex flex-col gap-2">
                  <Label>Màu thương hiệu</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editForm.brandColor || "#2563EB"}
                      onChange={(e) =>
                        setEditForm((p: any) => ({ ...p, brandColor: e.target.value }))
                      }
                      className="h-9 w-14 cursor-pointer rounded border bg-transparent"
                    />
                    <Input
                      value={editForm.brandColor ?? ""}
                      onChange={(e) =>
                        setEditForm((p: any) => ({ ...p, brandColor: e.target.value }))
                      }
                      placeholder="#2563EB"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Sponsor Banners */}
              <div className="flex flex-col gap-2">
                <Label>Banner nhà tài trợ</Label>
                <p className="text-xs text-muted-foreground">
                  Thêm logo/banner các nhà tài trợ hiển thị ở trang kết quả
                </p>
                <SponsorBanners
                  value={editForm.sponsorBanners || []}
                  onChange={(urls) =>
                    setEditForm((p: any) => ({ ...p, sponsorBanners: urls }))
                  }
                  folder={`races/${raceId}/sponsors`}
                  token={token || undefined}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveRace} disabled={saving}>
                  <Save className="size-4 mr-2" />
                  {saving ? "Đang lưu..." : "Lưu thương hiệu"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════ Features Tab ════════════ */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Tính năng</CardTitle>
              <CardDescription>
                Bật/tắt các tính năng cho giải
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {/* Feature Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">E-Certificate</Label>
                    <p className="text-sm text-muted-foreground">
                      Cho phép VĐV tải chứng nhận hoàn thành
                    </p>
                  </div>
                  <Switch
                    checked={editForm.enableEcert ?? false}
                    onCheckedChange={(checked) =>
                      setEditForm((p: any) => ({ ...p, enableEcert: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Khiếu nại kết quả</Label>
                    <p className="text-sm text-muted-foreground">
                      Cho phép VĐV gửi khiếu nại về kết quả
                    </p>
                  </div>
                  <Switch
                    checked={editForm.enableClaim ?? false}
                    onCheckedChange={(checked) =>
                      setEditForm((p: any) => ({ ...p, enableClaim: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Live Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Hiển thị kết quả realtime trong giải
                    </p>
                  </div>
                  <Switch
                    checked={editForm.enableLiveTracking ?? false}
                    onCheckedChange={(checked) =>
                      setEditForm((p: any) => ({ ...p, enableLiveTracking: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">5Pix (Ảnh giải chạy)</Label>
                    <p className="text-sm text-muted-foreground">
                      Tích hợp tìm ảnh VĐV từ 5Pix
                    </p>
                  </div>
                  <Switch
                    checked={editForm.enable5pix ?? false}
                    onCheckedChange={(checked) =>
                      setEditForm((p: any) => ({ ...p, enable5pix: checked }))
                    }
                  />
                </div>

                {editForm.enable5pix && (
                  <div className="flex flex-col gap-2 pl-4 border-l-2 border-primary/20">
                    <Label htmlFor="pix-url">5Pix Event URL</Label>
                    <Input
                      id="pix-url"
                      value={editForm.pixEventUrl ?? ""}
                      onChange={(e) =>
                        setEditForm((p: any) => ({ ...p, pixEventUrl: e.target.value }))
                      }
                      placeholder="https://5pix.vn/event/..."
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveRace} disabled={saving}>
                  <Save className="size-4 mr-2" />
                  {saving ? "Đang lưu..." : "Lưu tính năng"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════ Sponsors Tab ════════════ */}
        <TabsContent value="sponsors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Nhà tài trợ giải đấu</CardTitle>
                <CardDescription>Quản lý nhà tài trợ riêng cho giải này</CardDescription>
              </div>
              <Button onClick={openAddSponsor} size="sm">
                <Plus className="size-4 mr-1" /> Thêm
              </Button>
            </CardHeader>
            <CardContent>
              {loadingSponsors ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : raceSponsors.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Chưa có nhà tài trợ nào cho giải này
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Logo</TableHead>
                      <TableHead>Tên</TableHead>
                      <TableHead>Cấp độ</TableHead>
                      <TableHead>Thứ tự</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {raceSponsors.map(s => (
                      <TableRow key={s._id}>
                        <TableCell>
                          {s.logoUrl ? (
                            <img src={s.logoUrl} alt={s.name} className="h-8 w-auto max-w-[120px] object-contain" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>
                          <Badge className={
                            s.level === 'diamond' ? 'bg-purple-500/20 text-purple-400' :
                            s.level === 'gold' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-zinc-500/20 text-zinc-400'
                          }>
                            {s.level === 'diamond' ? 'Kim cương' : s.level === 'gold' ? 'Vàng' : 'Bạc'}
                          </Badge>
                        </TableCell>
                        <TableCell>{s.order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openEditSponsor(s)} title="Sửa">
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteSponsor(s._id)} title="Xóa">
                              <Trash2 className="size-4 text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Sponsor Dialog */}
          <Dialog open={sponsorDialogOpen} onOpenChange={(open) => { if (!open) setSponsorDialogOpen(false); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSponsor ? 'Sửa nhà tài trợ' : 'Thêm nhà tài trợ'}</DialogTitle>
                <DialogDescription>Logo sẽ hiển thị ở bảng xếp hạng giải đấu</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label>Tên nhà tài trợ *</Label>
                  <Input value={sponsorForm.name} onChange={e => setSponsorForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Adidas Vietnam" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Logo URL *</Label>
                  <ImageUpload
                    value={sponsorForm.logoUrl}
                    onChange={(url) => setSponsorForm(f => ({ ...f, logoUrl: url }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Website</Label>
                  <Input value={sponsorForm.website} onChange={e => setSponsorForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Cấp độ</Label>
                    <Select value={sponsorForm.level} onValueChange={v => setSponsorForm(f => ({ ...f, level: v || 'silver' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diamond">Kim cương</SelectItem>
                        <SelectItem value="gold">Vàng</SelectItem>
                        <SelectItem value="silver">Bạc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Thứ tự</Label>
                    <Input type="number" value={sponsorForm.order} onChange={e => setSponsorForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSponsorDialogOpen(false)}>Hủy</Button>
                <Button onClick={handleSaveSponsor} disabled={savingSponsor || !sponsorForm.name || !sponsorForm.logoUrl}>
                  {savingSponsor ? 'Đang lưu...' : 'Lưu'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
