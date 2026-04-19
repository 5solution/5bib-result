"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { racesControllerSearchRaces } from "@/lib/api-generated";
import {
  listCertificateTemplates,
  deleteCertificateTemplate,
  type CertificateTemplate,
  type TemplateType,
} from "@/lib/certificate-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";

interface RaceOption {
  id: string;
  title: string;
}

const TYPE_BADGE: Record<
  TemplateType,
  { label: string; bg: string; text: string; border: string }
> = {
  certificate: {
    label: "Certificate",
    bg: "#dbeafe",
    text: "#1d4ed8",
    border: "#bfdbfe",
  },
  share_card: {
    label: "Share Card",
    bg: "#ede9fe",
    text: "#6d28d9",
    border: "#c4b5fd",
  },
};

function TypeBadge({ type }: { type: TemplateType }) {
  const c = TYPE_BADGE[type];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      {c.label}
    </span>
  );
}

export default function CertificatesPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [templates, setTemplates] = useState<CertificateTemplate[] | null>(
    null,
  );
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [raceFilter, setRaceFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<TemplateType | "">("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRaces = useCallback(async () => {
    try {
      const res = await racesControllerSearchRaces({
        query: { pageSize: 200 },
      });
      const list = (res.data?.data?.list ?? []) as Array<Record<string, unknown>>;
      const mapped = list
        .map((r) => ({
          id: String(r.id ?? r._id ?? ""),
          title: String(r.title ?? "Untitled"),
        }))
        .filter((r) => r.id);
      setRaces(mapped);
    } catch (err) {
      console.error("Failed to load races", err);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await listCertificateTemplates(token, {
        raceId: raceFilter || undefined,
        type: typeFilter || undefined,
        pageSize: 100,
      });
      setTemplates(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setTemplates([]);
    }
  }, [token, raceFilter, typeFilter]);

  useEffect(() => {
    if (isAuthenticated) loadRaces();
  }, [isAuthenticated, loadRaces]);

  useEffect(() => {
    if (isAuthenticated) loadTemplates();
  }, [isAuthenticated, loadTemplates]);

  async function handleDelete() {
    if (!token || !deleteId) return;
    setDeleting(true);
    try {
      await deleteCertificateTemplate(token, deleteId);
      toast.success("Đã xóa template");
      setDeleteId(null);
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa thất bại");
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading) return null;
  if (!isAuthenticated) return null;

  const filtered = (templates ?? []).filter((t) =>
    search ? t.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const raceMap = new Map(races.map((r) => [r.id, r.title]));
  const deleteTarget = deleteId
    ? (templates ?? []).find((t) => t._id === deleteId) ?? null
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Certificate Templates</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý mẫu certificate &amp; share card (v1.1 — song song với tính
            năng cũ, không thay thế)
          </p>
        </div>
        <Link href="/certificates/new" className={buttonVariants()}>
          <Plus className="size-4" />
          Tạo template
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label className="text-xs font-medium">Tìm theo tên</Label>
          <Input
            placeholder="Nhập tên template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs font-medium">Giải đấu</Label>
          <Select
            value={raceFilter || "__all__"}
            onValueChange={(v) =>
              setRaceFilter(!v || v === "__all__" ? "" : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tất cả</SelectItem>
              {races.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium">Loại</Label>
          <Select
            value={typeFilter || "__all__"}
            onValueChange={(v) =>
              setTypeFilter(!v || v === "__all__" ? "" : (v as TemplateType))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tất cả</SelectItem>
              <SelectItem value="certificate">Certificate</SelectItem>
              <SelectItem value="share_card">Share Card</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Giải</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Canvas</TableHead>
              <TableHead>Layers</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates === null &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {templates !== null && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  Chưa có template nào
                </TableCell>
              </TableRow>
            )}

            {filtered.map((t) => (
              <TableRow key={t._id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {raceMap.get(t.race_id) ?? t.race_id}
                </TableCell>
                <TableCell>
                  <TypeBadge type={t.type} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {t.canvas.width}×{t.canvas.height}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {t.layers.length}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/certificates/${t._id}`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "icon-sm",
                      })}
                    >
                      <Pencil className="size-3.5" />
                    </Link>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(t._id)
                          .then(() => toast.success("Đã copy template ID"))
                      }
                      title="Copy ID"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setDeleteId(t._id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa certificate template</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa &quot;{deleteTarget?.name ?? "template này"}
              &quot;? Hành động không thể hoàn tác. Nếu template đang được race
              config dùng, hệ thống sẽ chặn và báo lỗi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
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
  );
}
