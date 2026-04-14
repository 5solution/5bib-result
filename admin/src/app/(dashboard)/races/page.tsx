"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api"; // ensure client baseUrl is configured
import { authHeaders } from "@/lib/api";
import {
  racesControllerSearchRaces,
  racesControllerCreateRace,
  racesControllerDeleteRace,
} from "@/lib/api-generated";
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
  DialogDescription,
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
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";

type RaceStatus = "draft" | "pre_race" | "live" | "ended";

interface Race {
  _id: string;
  title: string;
  slug: string;
  status: RaceStatus;
  raceType?: string;
  province?: string;
  courses?: Array<{ courseId: string; name: string }>;
  startDate?: string;
  endDate?: string;
}

function StatusBadge({ status }: { status: RaceStatus }) {
  const config: Record<RaceStatus, { label: string; className: string }> = {
    draft: {
      label: "Nháp",
      className: "bg-yellow-500/20 text-yellow-400",
    },
    pre_race: {
      label: "Chuẩn bị",
      className: "bg-blue-500/20 text-blue-400",
    },
    live: {
      label: "Đang diễn ra",
      className: "bg-green-500/20 text-green-400",
    },
    ended: {
      label: "Đã kết thúc",
      className: "bg-zinc-500/20 text-zinc-400",
    },
  };

  const c = config[status] || config.ended;

  return (
    <Badge className={`${c.className} text-sm px-3 py-1`}>
      {status === "live" && (
        <span className="mr-1.5 inline-block size-2.5 animate-pulse rounded-full bg-green-400" />
      )}
      {c.label}
    </Badge>
  );
}

export default function RacesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRace, setNewRace] = useState<Record<string, any>>({
    title: "",
    slug: "",
    status: "draft",
    raceType: "running",
    cacheTtlSeconds: 60,
  });

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRaces = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data, error } = await racesControllerSearchRaces({
        query: {
          title: search || undefined,
          status: statusFilter === "all" ? "all" : statusFilter,
          page,
          pageSize: 20,
        },
        ...authHeaders(token),
      });

      if (error) throw error;

      const result = data as unknown as {
        data?: {
          list?: Race[];
          totalPages?: number;
          totalItems?: number;
          currentPage?: number;
        };
      };

      setRaces(result?.data?.list ?? []);
      setTotalPages(result?.data?.totalPages ?? 0);
      setTotalItems(result?.data?.totalItems ?? 0);
    } catch {
      toast.error("Không thể tải danh sách giải");
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, page]);

  useEffect(() => {
    fetchRaces();
  }, [fetchRaces]);

  async function handleCreate() {
    if (!token || !newRace.title) return;
    setCreating(true);
    try {
      const slug =
        newRace.slug ||
        newRace.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      const { error } = await racesControllerCreateRace({
        body: {
          title: newRace.title,
          slug,
          status: newRace.status || "draft",
          raceType: newRace.raceType || "running",
          province: newRace.province,
          cacheTtlSeconds: newRace.cacheTtlSeconds ?? 60,
          enableEcert: false,
          enableClaim: false,
          enableLiveTracking: false,
          enable5pix: false,
        } as any,
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Tạo giải thành công!");
      setCreateOpen(false);
      setNewRace({
        title: "",
        slug: "",
        status: "draft",
        raceType: "running",
        cacheTtlSeconds: 60,
      });
      fetchRaces();
    } catch {
      toast.error("Tạo giải thất bại");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!token || !deleteId) return;
    setDeleting(true);
    try {
      const { error } = await racesControllerDeleteRace({
        path: { id: deleteId },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Đã xóa giải!");
      setDeleteId(null);
      fetchRaces();
    } catch {
      toast.error("Xóa giải thất bại");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Giải đấu</h1>
          <p className="text-base text-muted-foreground">
            {totalItems} giải chạy trong hệ thống
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="size-4 mr-2" />
            Tạo giải mới
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Tạo giải chạy mới</DialogTitle>
              <DialogDescription>
                Nhập thông tin cơ bản để tạo giải chạy
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="race-title">Tên giải *</Label>
                <Input
                  id="race-title"
                  value={newRace.title ?? ""}
                  onChange={(e) =>
                    setNewRace((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="Vietnam Mountain Marathon 2026"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="race-slug">Đường dẫn SEO</Label>
                <Input
                  id="race-slug"
                  value={newRace.slug ?? ""}
                  onChange={(e) =>
                    setNewRace((p) => ({ ...p, slug: e.target.value }))
                  }
                  placeholder="vietnam-mountain-marathon-2026"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Loại hình</Label>
                <Input
                  value={newRace.raceType ?? ""}
                  onChange={(e) =>
                    setNewRace((p) => ({ ...p, raceType: e.target.value }))
                  }
                  placeholder="running"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Tỉnh/Thành</Label>
                <Input
                  value={newRace.province ?? ""}
                  onChange={(e) =>
                    setNewRace((p) => ({ ...p, province: e.target.value }))
                  }
                  placeholder="Hà Nội"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={creating || !newRace.title}
              >
                {creating ? "Đang tạo..." : "Tạo giải"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm giải chạy..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-11 h-12 text-base"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val ?? "all");
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[200px] h-12 text-base">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="draft">Nháp</SelectItem>
            <SelectItem value="pre_race">Chuẩn bị</SelectItem>
            <SelectItem value="live">Đang diễn ra</SelectItem>
            <SelectItem value="ended">Đã kết thúc</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-base py-4">Tên giải</TableHead>
                <TableHead className="text-base py-4">Trạng thái</TableHead>
                <TableHead className="hidden md:table-cell text-base py-4">Loại</TableHead>
                <TableHead className="hidden lg:table-cell text-base py-4">Tỉnh</TableHead>
                <TableHead className="hidden sm:table-cell text-base py-4">Cự ly</TableHead>
                <TableHead className="text-right text-base py-4">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {races.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-base">
                    Không tìm thấy giải nào
                  </TableCell>
                </TableRow>
              ) : (
                races.map((race) => (
                  <TableRow key={race._id} className="text-base">
                    <TableCell className="font-semibold py-5">
                      <button
                        className="text-left hover:underline text-base"
                        onClick={() => router.push(`/races/${race._id}`)}
                      >
                        {race.title}
                      </button>
                    </TableCell>
                    <TableCell className="py-5">
                      <StatusBadge status={race.status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground py-5">
                      {race.raceType || "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground py-5">
                      {race.province || "-"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground py-5">
                      {race.courses?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right py-5">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => router.push(`/races/${race._id}`)}
                        >
                          <Pencil className="size-5" />
                        </Button>
                        <Dialog
                          open={deleteId === race._id}
                          onOpenChange={(open) =>
                            setDeleteId(open ? race._id : null)
                          }
                        >
                          <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                            <Trash2 className="size-5 text-destructive" />
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Xóa giải chạy</DialogTitle>
                              <DialogDescription>
                                Bạn có chắc muốn xóa &quot;{race.title}&quot;? Hành động này không thể hoàn tác.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setDeleteId(null)}
                              >
                                Hủy
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={deleting}
                              >
                                {deleting ? "Đang xóa..." : "Xóa"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Trang {page + 1}/{totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
