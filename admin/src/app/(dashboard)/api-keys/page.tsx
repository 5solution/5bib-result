"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import "@/lib/api";
import {
  apiKeysAdminControllerList,
  apiKeysAdminControllerCreate,
  apiKeysAdminControllerUpdate,
  apiKeysAdminControllerRemove,
} from "@/lib/api-generated";
import type {
  ApiKeyResponseDto,
  CreateApiKeyDto,
  CreatedApiKeyDto,
} from "@/lib/api-generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/confirm-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Key,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

interface FormState {
  id: string | null;
  name: string;
  allowedOrigins: string;
  rateLimitPerMinute: number;
  isActive: boolean;
  notes: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  allowedOrigins: "",
  rateLimitPerMinute: 1000,
  isActive: true,
  notes: "",
};

export default function ApiKeysPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<ApiKeyResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  /** Newly created key — shown ONCE in modal, then never again. */
  const [revealed, setRevealed] = useState<CreatedApiKeyDto | null>(null);
  const [copiedFlash, setCopiedFlash] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiKeysAdminControllerList();
      setItems((res.data as ApiKeyResponseDto[]) ?? []);
    } catch (err) {
      toast.error("Không tải được danh sách: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (key: ApiKeyResponseDto) => {
    setForm({
      id: key.id,
      name: key.name,
      allowedOrigins: key.allowedOrigins.join("\n"),
      rateLimitPerMinute: key.rateLimitPerMinute,
      isActive: key.isActive,
      notes: key.notes,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Tên key không được trống");
      return;
    }
    setSubmitting(true);
    try {
      const allowedOrigins = form.allowedOrigins
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const body: CreateApiKeyDto = {
        name: form.name,
        allowedOrigins,
        rateLimitPerMinute: form.rateLimitPerMinute,
        isActive: form.isActive,
        notes: form.notes,
      };

      if (form.id) {
        await apiKeysAdminControllerUpdate({ path: { id: form.id }, body });
        toast.success("Đã cập nhật key");
        setFormOpen(false);
      } else {
        const res = await apiKeysAdminControllerCreate({ body });
        const created = res.data as CreatedApiKeyDto;
        // Close form, open reveal modal — must show fullKey ONCE.
        setFormOpen(false);
        setRevealed(created);
      }
      await load();
    } catch (err) {
      const e = err as { body?: { message?: string }; message?: string };
      toast.error(e.body?.message ?? e.message ?? "Lưu thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (key: ApiKeyResponseDto) => {
    const ok = await confirm({
      title: `Xóa key "${key.name}"?`,
      description:
        `Mọi consumer đang dùng key này (prefix: ${key.keyPrefix}…) sẽ bị chặn ngay lập tức. Hành động không thể hoàn tác.`,
      confirmText: "Xóa & revoke",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await apiKeysAdminControllerRemove({ path: { id: key.id } });
      toast.success("Đã revoke key");
      await load();
    } catch (err) {
      toast.error("Xóa thất bại: " + (err as Error).message);
    }
  };

  const handleToggleActive = async (key: ApiKeyResponseDto) => {
    try {
      await apiKeysAdminControllerUpdate({
        path: { id: key.id },
        body: { isActive: !key.isActive },
      });
      toast.success(key.isActive ? "Đã tạm khoá key" : "Đã kích hoạt lại key");
      await load();
    } catch (err) {
      toast.error("Toggle thất bại: " + (err as Error).message);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFlash(true);
      setTimeout(() => setCopiedFlash(false), 2000);
    } catch {
      toast.error("Không copy được — chọn text rồi Cmd+C thủ công");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Hệ thống</span>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-foreground">API Keys</span>
          </div>
          <h1 className="font-[var(--font-heading)] text-3xl font-black tracking-tight">
            <span className="mr-2">🔑</span>
            API Keys
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
            Cấp key cho 5bib.com / 5sport.vn / partner để gọi open API
            (<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/api/articles/latest</code>,
            {" "}<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/api/articles</code>,
            {" "}<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/api/article-categories</code>).
            Đặt key vào header <b>X-API-Key</b>. Detail bài viết
            (<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/api/articles/:slug</code>)
            vẫn open cho SEO bots.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          Tạo key mới
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] uppercase tracking-wider">Tên</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Prefix</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Origins</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Rate / phút</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Sử dụng</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Last used</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Trạng thái</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  <Key className="mx-auto mb-2 size-8 opacity-30" />
                  <div className="text-sm font-medium">Chưa có API key nào</div>
                  <div className="text-xs">
                    Cấp key đầu tiên cho 5bib.com homepage widget
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>
                    <div className="font-semibold">{key.name}</div>
                    {key.notes && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {key.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                      {key.keyPrefix}…
                    </code>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {key.allowedOrigins.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Mọi origin</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {key.allowedOrigins.slice(0, 2).map((o) => (
                          <Badge key={o} variant="secondary" className="font-mono text-[10px]">
                            {o.replace(/^https?:\/\//, "")}
                          </Badge>
                        ))}
                        {key.allowedOrigins.length > 2 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{key.allowedOrigins.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums">
                    {key.rateLimitPerMinute === 0 ? "∞" : key.rateLimitPerMinute.toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums">
                    {key.usageCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(key)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold"
                      title="Click để toggle"
                    >
                      <span
                        className={`size-2 rounded-full ${
                          key.isActive ? "bg-emerald-700" : "bg-muted-foreground"
                        }`}
                      />
                      <span
                        className={key.isActive ? "text-emerald-700" : "text-muted-foreground"}
                      >
                        {key.isActive ? "Active" : "Tạm khóa"}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(key)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(key)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Create / Edit form ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{form.id ? "Sửa API key" : "Tạo API key mới"}</DialogTitle>
              <DialogDescription>
                {form.id
                  ? "Đổi metadata. Key string không thể đổi — phải xóa + tạo mới nếu muốn rotate."
                  : "Sau khi bấm Tạo, full key sẽ hiển thị MỘT LẦN duy nhất. Lưu ngay vào nơi an toàn."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Tên *</Label>
                <Input
                  id="key-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="5bib.com homepage widget"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="key-origins">
                  Allowed origins (mỗi dòng 1 URL — bỏ trống = cho mọi origin)
                </Label>
                <Textarea
                  id="key-origins"
                  value={form.allowedOrigins}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, allowedOrigins: e.target.value }))
                  }
                  rows={3}
                  className="font-mono text-xs"
                  placeholder={"https://5bib.com\nhttps://www.5bib.com"}
                />
                <p className="text-[11px] text-muted-foreground">
                  Chỉ apply cho browser-side request. Server-side fetch (Next.js
                  Server Component) không gửi Origin → bỏ qua check.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="key-rate">Rate / phút</Label>
                  <Input
                    id="key-rate"
                    type="number"
                    min={0}
                    max={100_000}
                    value={form.rateLimitPerMinute}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        rateLimitPerMinute: Number(e.target.value) || 0,
                      }))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">0 = unlimited</p>
                </div>
                <div className="flex items-end">
                  <label className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
                    <span className="text-sm font-semibold">Active</span>
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="key-notes">
                  Ghi chú{" "}
                  <span className="font-normal text-muted-foreground">
                    ({form.notes.length}/500)
                  </span>
                </Label>
                <Textarea
                  id="key-notes"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value.slice(0, 500) }))
                  }
                  rows={2}
                  placeholder="VD: Cấp cho team marketing, expire 2027-Q1, contact: marketing@5bib.com"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={submitting}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Đang xử lý..." : form.id ? "Cập nhật" : "Tạo & hiển thị key"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Reveal new key modal (one-shot) ── */}
      <Dialog
        open={revealed !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevealed(null);
            setCopiedFlash(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-700" />
              Key tạo thành công — chỉ hiển thị MỘT LẦN
            </DialogTitle>
            <DialogDescription>
              Sao chép full key vào nơi an toàn (1Password / Notion encrypted /
              env vars). Sau khi đóng dialog, không thể xem lại được nữa — chỉ
              còn prefix.
            </DialogDescription>
          </DialogHeader>

          {revealed && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                <div className="mb-2 flex items-start gap-2 text-xs font-bold text-amber-900">
                  <AlertTriangle className="size-4 shrink-0" />
                  Chỉ admin tạo mới thấy full key. Lưu ngay TRƯỚC khi đóng dialog.
                </div>
                <div className="flex gap-2">
                  <code className="flex-1 break-all rounded-md bg-white px-3 py-2.5 font-mono text-[13px] leading-snug">
                    {revealed.fullKey}
                  </code>
                  <Button
                    type="button"
                    onClick={() => copyToClipboard(revealed.fullKey)}
                    className="shrink-0 gap-1.5"
                  >
                    {copiedFlash ? (
                      <>
                        <CheckCircle2 className="size-4" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" /> Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <div className="mb-2 font-bold">Cách sử dụng:</div>
                <pre className="overflow-x-auto rounded bg-card p-2 font-mono text-[11px] leading-relaxed">
                  {`curl https://result.5bib.com/api/articles/latest \\
  -H "X-API-Key: ${revealed.fullKey}"`}
                </pre>
                <div className="mt-3 grid gap-1.5 text-muted-foreground">
                  <div>
                    <span className="font-bold text-foreground">Server (Next.js):</span>{" "}
                    đặt key vào <code className="font-mono">process.env.ARTICLES_API_KEY</code>,
                    fetch trong Server Component → không leak ra client bundle.
                  </div>
                  <div>
                    <span className="font-bold text-foreground">Browser:</span> KHÔNG embed
                    key vào client JS — proxy qua Next.js Route Handler.
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setRevealed(null);
                setCopiedFlash(false);
              }}
            >
              Tôi đã lưu — đóng dialog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
