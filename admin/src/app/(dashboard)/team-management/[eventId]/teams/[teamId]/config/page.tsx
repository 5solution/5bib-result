"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getTeamCategory,
  updateTeamCategory,
  deleteTeamCategory,
  type TeamCategory,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";

// v1.8 — Team config tab. Edit name/slug/color/sort_order/description + delete.
// Delete returns 409 if team still has stations or supply_plan rows attached.

interface FormState {
  name: string;
  slug: string;
  color: string;
  sort_order: number;
  description: string;
}

function teamToForm(t: TeamCategory): FormState {
  return {
    name: t.name,
    slug: t.slug,
    color: t.color,
    sort_order: t.sort_order,
    description: t.description ?? "",
  };
}

export default function TeamConfigPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string; teamId: string }>();
  const eventId = params.eventId;
  const teamId = Number(params.teamId);
  const { token } = useAuth();

  const [team, setTeam] = useState<TeamCategory | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(teamId)) return;
    try {
      const t = await getTeamCategory(token, teamId);
      setTeam(t);
      setForm(teamToForm(t));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [token, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(): Promise<void> {
    if (!token || !team || !form) return;
    if (!form.name.trim()) {
      toast.error("Tên team bắt buộc");
      return;
    }
    setSaving(true);
    try {
      await updateTeamCategory(token, team.id, {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        color: form.color,
        sort_order: form.sort_order,
        description: form.description.trim() || null,
      });
      toast.success("Đã lưu cấu hình");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!token || !team) return;
    if (
      !confirm(
        `Xoá team "${team.name}"? Roles thuộc team sẽ tự unlink. Không xoá được nếu còn trạm hoặc kế hoạch vật tư.`,
      )
    )
      return;
    setDeleting(true);
    try {
      await deleteTeamCategory(token, team.id);
      toast.success("Đã xoá team");
      router.push(`/team-management/${eventId}/teams`);
    } catch (err) {
      toast.error((err as Error).message);
      setDeleting(false);
    }
  }

  if (!form || !team) return <Skeleton className="h-64" />;

  const slugLocked = team.role_count > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-display text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Settings className="size-5 text-gray-400" />
          Cấu hình team
        </h2>
        <p className="text-xs text-gray-500">
          Sửa tên, màu, slug, mô tả. Slug không sửa được nếu đã có role thuộc
          team.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Tên team *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <Label>
            Slug {slugLocked ? "(khoá — có role đang dùng)" : ""}
          </Label>
          <Input
            value={form.slug}
            disabled={slugLocked}
            onChange={(e) =>
              setForm({ ...form, slug: e.target.value.toLowerCase() })
            }
            className="font-mono text-sm"
          />
        </div>
        <div>
          <Label>Màu chủ đạo</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="h-10 w-20 p-1"
            />
            <Input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="flex-1 font-mono text-sm"
            />
          </div>
        </div>
        <div>
          <Label>Thứ tự hiển thị</Label>
          <Input
            type="number"
            value={form.sort_order}
            onChange={(e) =>
              setForm({ ...form, sort_order: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <Label>Mô tả</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
          />
        </div>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 bg-white border-t py-3">
        <Button variant="ghost" onClick={() => setForm(teamToForm(team))}>
          Reset
        </Button>
        <Button disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-red-900">Vùng nguy hiểm</h3>
        <p className="text-xs text-red-800">
          Xoá team sẽ unlink mọi role thuộc team (role sẽ không còn thuộc team
          nào). Không xoá được nếu team còn trạm hoặc kế hoạch vật tư.
        </p>
        <Button
          variant="outline"
          className="border-red-500 text-red-700 hover:bg-red-100"
          disabled={deleting}
          onClick={() => void handleDelete()}
        >
          <Trash2 className="mr-2 size-4" />
          {deleting ? "Đang xoá..." : "Xoá team"}
        </Button>
      </div>
    </div>
  );
}
