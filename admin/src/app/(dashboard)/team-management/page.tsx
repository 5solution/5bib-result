"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  listTeamEvents,
  createTeamEvent,
  deleteTeamEvent,
  type TeamEvent,
  type CreateEventInput,
} from "@/lib/team-api";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<TeamEvent["status"], string> = {
  draft: "bg-yellow-500/20 text-yellow-400",
  open: "bg-green-500/20 text-green-400",
  closed: "bg-zinc-500/20 text-zinc-400",
  completed: "bg-blue-500/20 text-blue-400",
};

const STATUS_LABELS: Record<TeamEvent["status"], string> = {
  draft: "Nháp",
  open: "Mở đăng ký",
  closed: "Đã đóng",
  completed: "Đã hoàn tất",
};

export default function TeamManagementPage(): React.ReactElement {
  const router = useRouter();
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [events, setEvents] = useState<TeamEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const result = await listTeamEvents(token);
      setEvents(result.data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function handleDelete(id: number): Promise<void> {
    if (!token) return;
    if (!confirm("Xóa sự kiện này? (chỉ cho sự kiện ở trạng thái nháp)")) return;
    try {
      await deleteTeamEvent(token, id);
      toast.success("Đã xóa");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý nhân sự</h1>
          <p className="text-sm text-muted-foreground">
            Tạo event, quản lý vai trò (Leader / Crew / TNV), xem danh sách đăng ký.
          </p>
        </div>
        <CreateEventDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {events === null ? (
        <Skeleton className="h-64" />
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Chưa có sự kiện nào. Tạo sự kiện đầu tiên ở nút trên.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên sự kiện</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày diễn ra</TableHead>
                <TableHead>Địa điểm</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/team-management/${e.id}/roles`}
                      className="underline-offset-2 hover:underline"
                    >
                      {e.event_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[e.status]}>
                      {STATUS_LABELS[e.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.event_start_date} → {e.event_end_date}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.location ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void handleDelete(e.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CreateEventDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { token } = useAuth();
  const [form, setForm] = useState<CreateEventInput>({
    event_name: "",
    location: "",
    checkin_radius_m: 500,
    event_start_date: "",
    event_end_date: "",
    registration_open: "",
    registration_close: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (!token) return;
    if (!form.event_name || !form.event_start_date || !form.event_end_date) {
      toast.error("Vui lòng điền đủ thông tin bắt buộc");
      return;
    }
    setSaving(true);
    try {
      await createTeamEvent(token, {
        ...form,
        registration_open: form.registration_open || new Date().toISOString(),
        registration_close:
          form.registration_close ||
          new Date(form.event_start_date).toISOString(),
      });
      toast.success("Đã tạo sự kiện");
      onCreated();
      setForm({
        event_name: "",
        location: "",
        checkin_radius_m: 500,
        event_start_date: "",
        event_end_date: "",
        registration_open: "",
        registration_close: "",
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 size-4" /> Sự kiện mới
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo sự kiện mới</DialogTitle>
          <DialogDescription>
            Sau khi tạo, thêm các vai trò (Leader / Crew / TNV) ở trang chi tiết.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tên sự kiện *</Label>
            <Input
              value={form.event_name}
              onChange={(e) => setForm({ ...form, event_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Địa điểm</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ngày bắt đầu *</Label>
              <Input
                type="date"
                value={form.event_start_date}
                onChange={(e) =>
                  setForm({ ...form, event_start_date: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Ngày kết thúc *</Label>
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
              <Label>Mở ĐK</Label>
              <Input
                type="datetime-local"
                value={form.registration_open}
                onChange={(e) =>
                  setForm({ ...form, registration_open: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Đóng ĐK</Label>
              <Input
                type="datetime-local"
                value={form.registration_close}
                onChange={(e) =>
                  setForm({ ...form, registration_close: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <Label>Bán kính GPS check-in (m)</Label>
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
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {saving ? "Đang lưu..." : "Tạo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
