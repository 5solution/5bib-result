"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api"; // ensure client baseUrl is configured
import { authHeaders } from "@/lib/api";
import {
  sponsorsControllerFindAll,
  sponsorsControllerCreate,
  sponsorsControllerUpdate,
  sponsorsControllerRemove,
  uploadControllerUploadFile,
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
import { Plus, Pencil, Trash2, Upload } from "lucide-react";

type SponsorLevel = "silver" | "gold" | "diamond";

interface Sponsor {
  _id: string;
  name: string;
  logoUrl: string;
  website?: string;
  level: SponsorLevel;
  order: number;
  isActive: boolean;
}

function LevelBadge({ level }: { level: SponsorLevel }) {
  const config: Record<SponsorLevel, { label: string; className: string }> = {
    diamond: {
      label: "Diamond",
      className: "bg-purple-500/20 text-purple-400",
    },
    gold: {
      label: "Gold",
      className: "bg-amber-500/20 text-amber-400",
    },
    silver: {
      label: "Silver",
      className: "bg-zinc-500/20 text-zinc-400",
    },
  };

  const c = config[level] || config.silver;

  return <Badge className={c.className}>{c.label}</Badge>;
}

function LogoUploadButton({
  value,
  onChange,
  token,
}: {
  value: string;
  onChange: (url: string) => void;
  token: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const { data, error } = await uploadControllerUploadFile({
        body: { file },
        ...authHeaders(token),
      });

      if (error) throw error;
      const result = data as any;
      onChange(result?.url || result?.data?.url || "");
      toast.success("Tải logo thành công!");
    } catch {
      toast.error("Tải logo thất bại");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://s3.amazonaws.com/bucket/logo.png"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4 mr-1" />
          {uploading ? "..." : "Tải lên"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {value && (
        <img
          src={value}
          alt="Logo preview"
          className="h-10 w-auto rounded border object-contain bg-white p-1"
        />
      )}
    </div>
  );
}

const emptySponsor: Partial<{ name: string; logoUrl: string; website: string; level: string; order: number }> = {
  name: "",
  logoUrl: "",
  website: "",
  level: "silver",
  order: 0,
};

export default function SponsorsPage() {
  const { token } = useAuth();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSponsor, setNewSponsor] =
    useState<Partial<{ name: string; logoUrl: string; website: string; level: string; order: number }>>({
      ...emptySponsor,
    });

  // Edit dialog
  const [editSponsor, setEditSponsor] = useState<Sponsor | null>(null);
  const [editForm, setEditForm] =
    useState<Partial<{ name: string; logoUrl: string; website: string; level: string; order: number; isActive: boolean }>>({});
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSponsors = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data, error } = await sponsorsControllerFindAll({
        ...authHeaders(token),
      });

      if (error) throw error;
      const result = data as unknown as { data?: Sponsor[] };
      setSponsors(result?.data ?? []);
    } catch {
      toast.error("Không thể tải danh sách nhà tài trợ");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  async function handleCreate() {
    if (!token || !newSponsor.name || !newSponsor.logoUrl) return;
    setCreating(true);
    try {
      const { error } = await sponsorsControllerCreate({
        body: {
          name: newSponsor.name!,
          logoUrl: newSponsor.logoUrl!,
          website: newSponsor.website || undefined,
          level: (newSponsor.level || "silver") as any,
          order: newSponsor.order ?? 0,
          isActive: true,
        },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Tạo nhà tài trợ thành công!");
      setCreateOpen(false);
      setNewSponsor({ ...emptySponsor });
      fetchSponsors();
    } catch {
      toast.error("Tạo nhà tài trợ thất bại");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(sponsor: Sponsor) {
    setEditSponsor(sponsor);
    setEditForm({
      name: sponsor.name,
      logoUrl: sponsor.logoUrl,
      website: sponsor.website || "",
      level: sponsor.level,
      order: sponsor.order,
      isActive: sponsor.isActive,
    });
  }

  async function handleEdit() {
    if (!token || !editSponsor) return;
    setSaving(true);
    try {
      const { error } = await sponsorsControllerUpdate({
        path: { id: editSponsor._id },
        body: {
          name: editForm.name,
          logoUrl: editForm.logoUrl,
          website: editForm.website || undefined,
          level: (editForm.level || "silver") as any,
          order: editForm.order ?? 0,
          isActive: editForm.isActive ?? true,
        },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Cập nhật nhà tài trợ thành công!");
      setEditSponsor(null);
      fetchSponsors();
    } catch {
      toast.error("Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !deleteId) return;
    setDeleting(true);
    try {
      const { error } = await sponsorsControllerRemove({
        path: { id: deleteId },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Đã xóa nhà tài trợ!");
      setDeleteId(null);
      fetchSponsors();
    } catch {
      toast.error("Xóa nhà tài trợ thất bại");
    } finally {
      setDeleting(false);
    }
  }

  const deleteSponsor = sponsors.find((s) => s._id === deleteId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nhà tài trợ</h1>
          <p className="text-sm text-muted-foreground">
            {sponsors.length} nhà tài trợ trong hệ thống
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="size-4 mr-2" />
            Thêm nhà tài trợ
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Thêm nhà tài trợ mới</DialogTitle>
              <DialogDescription>
                Nhập thông tin nhà tài trợ
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sponsor-name">Tên *</Label>
                <Input
                  id="sponsor-name"
                  value={newSponsor.name ?? ""}
                  onChange={(e) =>
                    setNewSponsor((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Adidas"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Logo *</Label>
                <LogoUploadButton
                  value={newSponsor.logoUrl ?? ""}
                  onChange={(url) =>
                    setNewSponsor((p) => ({ ...p, logoUrl: url }))
                  }
                  token={token}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Website</Label>
                <Input
                  value={newSponsor.website ?? ""}
                  onChange={(e) =>
                    setNewSponsor((p) => ({ ...p, website: e.target.value }))
                  }
                  placeholder="https://adidas.com"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Hạng</Label>
                <Select
                  value={newSponsor.level ?? "silver"}
                  onValueChange={(val) =>
                    setNewSponsor((p) => ({
                      ...p,
                      level: val as SponsorLevel,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn hạng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diamond">Diamond</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Thứ tự hiển thị</Label>
                <Input
                  type="number"
                  value={newSponsor.order ?? 0}
                  onChange={(e) =>
                    setNewSponsor((p) => ({
                      ...p,
                      order: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={
                  creating || !newSponsor.name || !newSponsor.logoUrl
                }
              >
                {creating ? "Đang tạo..." : "Thêm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Logo</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Hạng</TableHead>
              <TableHead className="hidden md:table-cell">Website</TableHead>
              <TableHead className="hidden sm:table-cell">Thứ tự</TableHead>
              <TableHead className="hidden sm:table-cell">
                Trạng thái
              </TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sponsors.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  Chưa có nhà tài trợ nào
                </TableCell>
              </TableRow>
            ) : (
              sponsors.map((sponsor) => (
                <TableRow key={sponsor._id}>
                  <TableCell>
                    {sponsor.logoUrl ? (
                      <img
                        src={sponsor.logoUrl}
                        alt={sponsor.name}
                        className="h-8 w-12 rounded border object-contain bg-white p-0.5"
                      />
                    ) : (
                      <div className="h-8 w-12 rounded border bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {sponsor.name}
                  </TableCell>
                  <TableCell>
                    <LevelBadge level={sponsor.level} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {sponsor.website ? (
                      <a
                        href={sponsor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {sponsor.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {sponsor.order}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge
                      className={
                        sponsor.isActive
                          ? "bg-green-500/20 text-green-400"
                          : "bg-zinc-500/20 text-zinc-400"
                      }
                    >
                      {sponsor.isActive ? "Hoạt động" : "Ẩn"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(sponsor)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Dialog
                        open={deleteId === sponsor._id}
                        onOpenChange={(open) =>
                          setDeleteId(open ? sponsor._id : null)
                        }
                      >
                        <DialogTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" />
                          }
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Xóa nhà tài trợ</DialogTitle>
                            <DialogDescription>
                              Bạn có chắc muốn xóa &quot;{sponsor.name}
                              &quot;? Nhà tài trợ sẽ bị ẩn khỏi hệ thống.
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
      )}

      {/* Edit Dialog */}
      <Dialog
        open={editSponsor !== null}
        onOpenChange={(open) => {
          if (!open) setEditSponsor(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa nhà tài trợ</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin nhà tài trợ
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Tên *</Label>
              <Input
                value={editForm.name ?? ""}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Adidas"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Logo *</Label>
              <LogoUploadButton
                value={editForm.logoUrl ?? ""}
                onChange={(url) =>
                  setEditForm((p) => ({ ...p, logoUrl: url }))
                }
                token={token}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Website</Label>
              <Input
                value={editForm.website ?? ""}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, website: e.target.value }))
                }
                placeholder="https://adidas.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Hạng</Label>
              <Select
                value={editForm.level ?? "silver"}
                onValueChange={(val) =>
                  setEditForm((p) => ({
                    ...p,
                    level: val as SponsorLevel,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn hạng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diamond">Diamond</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Thứ tự hiển thị</Label>
              <Input
                type="number"
                value={editForm.order ?? 0}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    order: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>Trạng thái</Label>
              <Select
                value={editForm.isActive ? "active" : "inactive"}
                onValueChange={(val) =>
                  setEditForm((p) => ({
                    ...p,
                    isActive: val === "active",
                  }))
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Hoạt động</SelectItem>
                  <SelectItem value="inactive">Ẩn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSponsor(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleEdit}
              disabled={saving || !editForm.name || !editForm.logoUrl}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
