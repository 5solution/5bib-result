"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  listTeamCategories,
  createTeamCategory,
  type TeamCategory,
  type CreateTeamCategoryInput,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users as UsersIcon, MapPin, Package } from "lucide-react";
import { toast } from "sonner";

// v1.8 — Team (category) list page. Teams group roles + own stations + supply.
// Click a card → /teams/:teamId → sub-tabs (overview / roles / stations / supply / config).

export default function TeamsPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [teams, setTeams] = useState<TeamCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setTeams(await listTeamCategories(token, eventId));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, eventId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            Team — Sự kiện #{eventId}
          </h1>
          <p className="text-sm text-gray-500">
            Team là nhóm trên vai trò — mỗi Team chứa Leader/Crew/TNV và sở hữu
            trạm + kế hoạch vật tư.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" /> Tạo team mới
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {teams === null ? (
        <Skeleton className="h-64" />
      ) : teams.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <UsersIcon className="mx-auto size-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">
            Chưa có team nào. Tạo team đầu tiên để gom các vai trò lại.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" /> Tạo team mới
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/team-management/${eventId}/teams/${t.id}`}
              className="rounded-xl border bg-white p-4 space-y-3 card-hover block"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="inline-block size-4 rounded-full mt-1 flex-shrink-0"
                  style={{ background: t.color }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-base truncate">{t.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">{t.slug}</p>
                </div>
              </div>
              {t.description ? (
                <p className="text-xs text-gray-600 line-clamp-2">
                  {t.description}
                </p>
              ) : null}
              <div className="flex items-center gap-3 text-xs text-gray-600 border-t pt-2">
                <span
                  className="inline-flex items-center gap-1"
                  title="Số vai trò"
                >
                  <UsersIcon className="size-3.5 text-gray-400" />
                  {t.role_count} vai trò
                </span>
                <span
                  className="inline-flex items-center gap-1"
                  title="Số trạm"
                >
                  <MapPin className="size-3.5 text-gray-400" />
                  {t.station_count} trạm
                </span>
                <span
                  className="inline-flex items-center gap-1"
                  title="Số mục trong kế hoạch vật tư"
                >
                  <Package className="size-3.5 text-gray-400" />
                  {t.supply_plan_count} vật tư
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateTeamDialog
        eventId={eventId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function CreateTeamDialog({
  eventId,
  open,
  onOpenChange,
  onCreated,
}: {
  eventId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}): React.ReactElement {
  const { token } = useAuth();
  const [form, setForm] = useState<CreateTeamCategoryInput>({
    name: "",
    color: "#3B82F6",
    sort_order: 0,
    description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: "",
        color: "#3B82F6",
        sort_order: 0,
        description: "",
      });
    }
  }, [open]);

  async function handleSubmit(): Promise<void> {
    if (!token) return;
    if (!form.name.trim()) {
      toast.error("Tên team bắt buộc");
      return;
    }
    setSaving(true);
    try {
      await createTeamCategory(token, eventId, {
        ...form,
        description: form.description?.trim() || null,
      });
      toast.success("Đã tạo team");
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo team mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tên team *</Label>
            <Input
              placeholder="VD: Team Nước / Team Y Tế / Team Hậu Cần"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Slug tự sinh từ tên (team-nuoc, team-y-te...). Có thể sửa sau tại
              tab Cấu hình của team.
            </p>
          </div>
          <div>
            <Label>Màu chủ đạo</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={form.color ?? "#3B82F6"}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-20 p-1"
              />
              <Input
                value={form.color ?? ""}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="#3B82F6"
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <Label>Thứ tự hiển thị</Label>
            <Input
              type="number"
              value={form.sort_order ?? 0}
              onChange={(e) =>
                setForm({ ...form, sort_order: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label>Mô tả</Label>
            <Textarea
              placeholder="Mô tả ngắn về team này..."
              value={form.description ?? ""}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
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
            {saving ? "Đang tạo..." : "Tạo team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
