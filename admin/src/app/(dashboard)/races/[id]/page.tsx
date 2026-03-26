"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, authHeaders } from "@/lib/api";
import type { components } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "lucide-react";

type RaceStatus = "pre_race" | "live" | "ended";

interface Course {
  courseId: string;
  name: string;
  distance?: string;
  distanceKm?: number;
  courseType?: string;
  apiUrl?: string;
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
  imageUrl?: string;
  logoUrl?: string;
  brandColor?: string;
  cacheTtlSeconds?: number;
  courses?: Course[];
}

function StatusBadge({ status }: { status: RaceStatus }) {
  const config: Record<RaceStatus, { label: string; className: string }> = {
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<components["schemas"]["UpdateRaceDto"]>>({});

  // Course dialog
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState<Partial<components["schemas"]["AddCourseDto"]>>({
    courseId: "",
    name: "",
    distance: "",
    apiUrl: "",
  });
  const [savingCourse, setSavingCourse] = useState(false);

  // Syncing state
  const [syncingCourseId, setSyncingCourseId] = useState<string | null>(null);
  const [resettingCourseId, setResettingCourseId] = useState<string | null>(null);

  const fetchRace = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data, response } = await api.GET("/api/races/{id}", {
        params: { path: { id: raceId } },
        ...authHeaders(token),
      });

      if (!response.ok) throw new Error("Race not found");

      const raceData = data as unknown as Race;
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
        imageUrl: raceData.imageUrl,
        logoUrl: raceData.logoUrl,
        brandColor: raceData.brandColor,
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

  async function handleSaveRace() {
    if (!token || !race) return;
    setSaving(true);
    try {
      const { error } = await api.PATCH("/api/races/{id}", {
        params: { path: { id: raceId } },
        body: {
          ...editForm,
          status: editForm.status || race.status,
          cacheTtlSeconds: editForm.cacheTtlSeconds ?? 60,
        },
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
      const { error } = await api.PATCH("/api/races/{id}/status", {
        params: { path: { id: raceId } },
        body: { status: newStatus },
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
        // Update existing course
        const { error } = await api.PATCH("/api/races/{id}/courses/{courseId}", {
          params: { path: { id: raceId, courseId: editingCourse.courseId } },
          body: {
            name: courseForm.name,
            distance: courseForm.distance,
            distanceKm: courseForm.distanceKm,
            courseType: courseForm.courseType,
            apiUrl: courseForm.apiUrl,
          },
          ...authHeaders(token),
        });
        if (error) throw error;
        toast.success("Cập nhật cự ly thành công!");
      } else {
        // Add new course
        const { error } = await api.POST("/api/races/{id}/courses", {
          params: { path: { id: raceId } },
          body: {
            courseId: courseForm.courseId || Date.now().toString(),
            name: courseForm.name,
            distance: courseForm.distance,
            distanceKm: courseForm.distanceKm,
            courseType: courseForm.courseType,
            apiUrl: courseForm.apiUrl,
          },
          ...authHeaders(token),
        });
        if (error) throw error;
        toast.success("Thêm cự ly thành công!");
      }
      setCourseDialogOpen(false);
      setEditingCourse(null);
      setCourseForm({ courseId: "", name: "", distance: "", apiUrl: "" });
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
      const { error } = await api.DELETE("/api/races/{id}/courses/{courseId}", {
        params: { path: { id: raceId, courseId } },
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
      const { error } = await api.POST(
        "/api/admin/races/{raceId}/courses/{courseId}/force-sync",
        {
          params: { path: { raceId, courseId } },
          ...authHeaders(token),
        }
      );
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
      const { error } = await api.POST(
        "/api/admin/races/{raceId}/courses/{courseId}/reset-data",
        {
          params: { path: { raceId, courseId } },
          ...authHeaders(token),
        }
      );
      if (error) throw error;
      toast.success("Đã xóa dữ liệu!");
    } catch {
      toast.error("Xóa dữ liệu thất bại");
    } finally {
      setResettingCourseId(null);
    }
  }

  function openEditCourse(course: Course) {
    setEditingCourse(course);
    setCourseForm({
      courseId: course.courseId,
      name: course.name,
      distance: course.distance,
      distanceKm: course.distanceKm,
      courseType: course.courseType,
      apiUrl: course.apiUrl,
    });
    setCourseDialogOpen(true);
  }

  function openAddCourse() {
    setEditingCourse(null);
    setCourseForm({ courseId: "", name: "", distance: "", apiUrl: "" });
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

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="courses">
            Cự ly ({race.courses?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="branding">Thương hiệu</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin giải chạy</CardTitle>
              <CardDescription>
                Cập nhật thông tin cơ bản của giải
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Status Controls */}
              <div className="flex flex-col gap-2">
                <Label>Vòng đời giải đấu</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={race.status === "pre_race" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleUpdateStatus("pre_race")}
                    disabled={race.status === "pre_race"}
                  >
                    Chuẩn bị
                  </Button>
                  <span className="self-center text-muted-foreground">→</span>
                  <Button
                    variant={race.status === "live" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleUpdateStatus("live")}
                    disabled={race.status === "live"}
                    className={race.status === "live" ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    Đang diễn ra
                  </Button>
                  <span className="self-center text-muted-foreground">→</span>
                  <Button
                    variant={race.status === "ended" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleUpdateStatus("ended")}
                    disabled={race.status === "ended"}
                  >
                    Đã kết thúc
                  </Button>
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
                      setEditForm((p) => ({ ...p, title: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-slug">Đường dẫn SEO</Label>
                  <Input
                    id="edit-slug"
                    value={editForm.slug ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, slug: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-type">Loại hình</Label>
                  <Input
                    id="edit-type"
                    value={editForm.raceType ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, raceType: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-province">Tỉnh/Thành</Label>
                  <Input
                    id="edit-province"
                    value={editForm.province ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, province: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-location">Địa điểm</Label>
                  <Input
                    id="edit-location"
                    value={editForm.location ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, location: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-organizer">Ban tổ chức</Label>
                  <Input
                    id="edit-organizer"
                    value={editForm.organizer ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, organizer: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-start">Ngày bắt đầu</Label>
                  <Input
                    id="edit-start"
                    type="datetime-local"
                    value={editForm.startDate?.slice(0, 16) ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        startDate: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : undefined,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-end">Ngày kết thúc</Label>
                  <Input
                    id="edit-end"
                    type="datetime-local"
                    value={editForm.endDate?.slice(0, 16) ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        endDate: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : undefined,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-ttl">Thời gian cache (giây)</Label>
                  <Input
                    id="edit-ttl"
                    type="number"
                    value={editForm.cacheTtlSeconds ?? 60}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        cacheTtlSeconds: parseInt(e.target.value) || 60,
                      }))
                    }
                  />
                </div>
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

        {/* Courses Tab */}
        <TabsContent value="courses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Cự ly</CardTitle>
                <CardDescription>
                  Quản lý các cự ly của giải
                </CardDescription>
              </div>
              <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
                <DialogTrigger render={<Button size="sm" />}>
                  <Plus className="size-4 mr-1" />
                  Thêm
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
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
                      <Label>Course ID *</Label>
                      <Input
                        value={courseForm.courseId ?? ""}
                        onChange={(e) =>
                          setCourseForm((p) => ({ ...p, courseId: e.target.value }))
                        }
                        placeholder="708"
                        disabled={!!editingCourse}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Tên cự ly *</Label>
                      <Input
                        value={courseForm.name ?? ""}
                        onChange={(e) =>
                          setCourseForm((p) => ({ ...p, name: e.target.value }))
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
                            setCourseForm((p) => ({ ...p, distance: e.target.value }))
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
                            setCourseForm((p) => ({
                              ...p,
                              distanceKm: parseFloat(e.target.value) || undefined,
                            }))
                          }
                          placeholder="42.195"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Loại cự ly</Label>
                      <Input
                        value={courseForm.courseType ?? ""}
                        onChange={(e) =>
                          setCourseForm((p) => ({ ...p, courseType: e.target.value }))
                        }
                        placeholder="road"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>API URL</Label>
                      <Input
                        value={courseForm.apiUrl ?? ""}
                        onChange={(e) =>
                          setCourseForm((p) => ({ ...p, apiUrl: e.target.value }))
                        }
                        placeholder="https://my.raceresult.com/api/results?contest=708"
                      />
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
                      <TableHead>ID</TableHead>
                      <TableHead>Tên</TableHead>
                      <TableHead className="hidden sm:table-cell">Khoảng cách</TableHead>
                      <TableHead className="hidden md:table-cell">Đường dẫn API</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {race.courses.map((course) => (
                      <TableRow key={course.courseId}>
                        <TableCell className="font-mono text-xs">
                          {course.courseId}
                        </TableCell>
                        <TableCell className="font-medium">
                          {course.name}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {course.distance || "-"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                          {course.apiUrl || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                handleForceSync(course.courseId)
                              }
                              disabled={syncingCourseId === course.courseId}
                              title="Ép đồng bộ"
                            >
                              <RefreshCw
                                className={`size-3 ${
                                  syncingCourseId === course.courseId
                                    ? "animate-spin"
                                    : ""
                                }`}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                handleResetData(course.courseId)
                              }
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
                              onClick={() =>
                                handleRemoveCourse(course.courseId)
                              }
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

              {/* Add course button (alternative) */}
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={openAddCourse}>
                  <Plus className="size-4 mr-1" />
                  Thêm cự ly
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Thương hiệu</CardTitle>
              <CardDescription>
                Logo, banner, và màu thương hiệu
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="brand-logo">Logo URL</Label>
                  <Input
                    id="brand-logo"
                    value={editForm.logoUrl ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, logoUrl: e.target.value }))
                    }
                    placeholder="https://example.com/logo.png"
                  />
                  {editForm.logoUrl && (
                    <img
                      src={editForm.logoUrl}
                      alt="Logo preview"
                      className="mt-2 h-16 w-auto rounded border bg-white object-contain p-1"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="brand-image">Banner URL</Label>
                  <Input
                    id="brand-image"
                    value={editForm.imageUrl ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, imageUrl: e.target.value }))
                    }
                    placeholder="https://example.com/banner.jpg"
                  />
                  {editForm.imageUrl && (
                    <img
                      src={editForm.imageUrl}
                      alt="Banner preview"
                      className="mt-2 h-24 w-auto rounded border object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="brand-color">Màu thương hiệu</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="brand-color"
                      type="color"
                      value={editForm.brandColor || "#FF5722"}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, brandColor: e.target.value }))
                      }
                      className="h-8 w-12 cursor-pointer rounded border bg-transparent"
                    />
                    <Input
                      value={editForm.brandColor ?? ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, brandColor: e.target.value }))
                      }
                      placeholder="#FF5722"
                      className="flex-1"
                    />
                  </div>
                </div>
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
      </Tabs>
    </div>
  );
}
