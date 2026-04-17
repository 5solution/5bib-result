"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  listContractTemplates,
  createContractTemplate,
  updateContractTemplate,
  deleteContractTemplate,
  importDocxToHtml,
  type ContractTemplate,
} from "@/lib/team-api";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_VARIABLES = [
  "full_name",
  "email",
  "phone",
  "cccd",
  "role_name",
  "daily_rate",
  "working_days",
  "total_compensation",
  "event_name",
  "event_start_date",
  "event_end_date",
  "event_location",
  "signed_date",
];

const BLANK_TEMPLATE_HTML = `<h2>HỢP ĐỒNG CỘNG TÁC</h2>
<p>Họ tên: <strong>{{full_name}}</strong> — CCCD: {{cccd}}</p>
<p>Vai trò: {{role_name}} · Số ngày: {{working_days}} · Đơn giá: {{daily_rate}}đ/ngày</p>
<p>Tổng thù lao: <strong>{{total_compensation}}đ</strong></p>
<p>Sự kiện: {{event_name}} · {{event_start_date}} → {{event_end_date}} · {{event_location}}</p>
<p class="sig-block">Ngày ký: {{signed_date}}</p>`;

export default function ContractTemplatesPage(): React.ReactElement {
  const router = useRouter();
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [templates, setTemplates] = useState<ContractTemplate[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setTemplates(await listContractTemplates(token));
    } catch (err) {
      toast.error((err as Error).message);
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
    if (!confirm("Xóa template? Chỉ được xóa khi không role nào đang dùng.")) return;
    try {
      await deleteContractTemplate(token, id);
      toast.success("Đã xóa");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/team-management">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Quay lại
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Mẫu hợp đồng</h1>
        <div className="flex-1" />
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" /> Template mới
        </Button>
      </div>

      {templates === null ? (
        <Skeleton className="h-64" />
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Chưa có template nào. Tạo mới ở nút trên.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên template</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Người tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.template_name}</TableCell>
                  <TableCell className="text-sm">
                    {t.is_active ? "Đang dùng" : "Lưu trữ"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.variables.length} key
                  </TableCell>
                  <TableCell className="text-sm">{t.created_by}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(t);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void handleDelete(t.id);
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

      <EditDialog
        open={dialogOpen}
        onOpenChange={(v) => setDialogOpen(v)}
        template={editing}
        onSaved={() => {
          setDialogOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function EditDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ContractTemplate | null;
  onSaved: () => void;
}): React.ReactElement {
  const { token } = useAuth();
  const [name, setName] = useState(template?.template_name ?? "");
  const [html, setHtml] = useState(template?.content_html ?? BLANK_TEMPLATE_HTML);
  const [vars, setVars] = useState(
    (template?.variables ?? DEFAULT_VARIABLES).join(", "),
  );
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(template?.template_name ?? "");
    setHtml(template?.content_html ?? BLANK_TEMPLATE_HTML);
    setVars((template?.variables ?? DEFAULT_VARIABLES).join(", "));
  }, [open, template]);

  async function handleImport(file: File): Promise<void> {
    if (!token) return;
    setImporting(true);
    try {
      const { content_html, warnings } = await importDocxToHtml(token, file);
      setHtml(content_html);
      if (warnings.length > 0) {
        toast.warning(`Import DOCX có ${warnings.length} cảnh báo`);
      } else {
        toast.success("Đã import DOCX");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (!token) return;
    if (!name.trim() || html.trim().length < 10) {
      toast.error("Tên và nội dung HTML bắt buộc");
      return;
    }
    const variables = vars
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setSaving(true);
    try {
      if (template) {
        await updateContractTemplate(token, template.id, {
          template_name: name,
          content_html: html,
          variables,
        });
        toast.success("Đã cập nhật");
      } else {
        await createContractTemplate(token, {
          template_name: name,
          content_html: html,
          variables,
        });
        toast.success("Đã tạo template");
      }
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {template ? "Sửa template" : "Template mới"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tên template *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Nội dung HTML * (dùng placeholder {`{{key}}`})</Label>
            <Textarea
              rows={16}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="mt-2 flex items-center gap-2">
              <label
                htmlFor="docx-upload"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
              >
                <Upload className="size-4" />
                {importing ? "Đang import..." : "Import DOCX"}
              </label>
              <input
                id="docx-upload"
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImport(f);
                }}
              />
              <span className="text-xs text-muted-foreground">
                Max 5MB. Script/style/on-handlers bị strip.
              </span>
            </div>
          </div>
          <div>
            <Label>Variables (comma-separated)</Label>
            <Input value={vars} onChange={(e) => setVars(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Các key được thay thế khi render. Mặc định: {DEFAULT_VARIABLES.join(", ")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={() => {
              void handleSave();
            }}
            disabled={saving}
          >
            {saving ? "Đang lưu..." : "Lưu template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
