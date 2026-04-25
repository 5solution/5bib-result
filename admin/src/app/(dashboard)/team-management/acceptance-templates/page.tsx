"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  listAcceptanceTemplates,
  createAcceptanceTemplate,
  updateAcceptanceTemplate,
  deleteAcceptanceTemplate,
  type AcceptanceTemplate,
  type AcceptanceTemplateInput,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Pencil, Eye, FileText } from "lucide-react";
import { toast } from "sonner";

/**
 * v2.0 — Acceptance (Biên bản nghiệm thu) template CRUD.
 *
 * Event-scoped or global (event_id = null → "Default" fallback). Exactly
 * one row can have is_default=true — the backend enforces this. Variables
 * shared with the contract template (full_name, cccd, ...) plus
 * acceptance-specific ones.
 *
 * Kept as a separate route instead of tabs inside /contract-templates to
 * avoid overloading that page and because the DOCX import flow there
 * doesn't apply here (acceptance templates are short and hand-authored).
 */

const ACCEPTANCE_VARIABLES = [
  "contract_number",
  "sign_date",
  "full_name",
  "birth_date",
  "cccd_number",
  "cccd_issue_date",
  "cccd_issue_place",
  "phone",
  "email",
  "address",
  "bank_account_number",
  "bank_name",
  "tax_code",
  "work_content",
  "work_location",
  "work_period",
  "unit_price",
  "unit_price_words",
  "acceptance_date",
  "acceptance_value",
  "acceptance_value_words",
  "event_name",
  "signature_image",
];

const PLACEHOLDER_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mOcvmLTfwAHogKtRzQQ5gAAAABJRU5ErkJggg==";

const SAMPLE_DATA: Record<string, string> = {
  contract_number: "001-5BIB-HDDV/CTV-5BIB",
  sign_date: "17/04/2026",
  full_name: "Nguyễn Văn Test",
  birth_date: "01/01/2000",
  cccd_number: "012345678901",
  cccd_issue_date: "15/03/2022",
  cccd_issue_place: "Cục CSQLHC về TTXH",
  phone: "0901234567",
  email: "test@example.com",
  address: "Hà Nội",
  bank_account_number: "0123456789",
  bank_name: "Vietcombank",
  tax_code: "012345678901",
  work_content: "Điều phối trạm check-in",
  work_location: "Hà Nội",
  work_period: "19/04/2026 → 20/04/2026",
  unit_price: "500,000",
  unit_price_words: "Năm trăm nghìn đồng",
  acceptance_date: "21/04/2026",
  acceptance_value: "1,000,000",
  acceptance_value_words: "Một triệu đồng",
  event_name: "Ha Noi Lô Lô Trail",
  signature_image: PLACEHOLDER_SIGNATURE,
};

const BLANK_ACCEPTANCE_HTML = `<h2>BIÊN BẢN NGHIỆM THU</h2>
<p>Số HĐ: <strong>{{contract_number}}</strong> — Ngày: {{acceptance_date}}</p>
<p>Bên B: {{full_name}} — CCCD: {{cccd_number}}</p>
<p>Nội dung công việc: {{work_content}}</p>
<p>Thời gian: {{work_period}} · Địa điểm: {{work_location}}</p>
<p>Giá trị nghiệm thu: <strong>{{acceptance_value}}đ</strong> ({{acceptance_value_words}})</p>
<p class="sig-block">
  Bên B ký: <br/>
  <img src="{{signature_image}}" style="max-width:220px;max-height:90px" alt="Chữ ký" />
</p>`;

function renderWithSample(html: string): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, keyRaw: string) => {
    const key = keyRaw.trim();
    const val = SAMPLE_DATA[key];
    if (val != null) return escapeHtml(val);
    return `<span style="background:#fee;color:#c00;padding:0 4px;border-radius:3px">{{${escapeHtml(
      key,
    )}}}</span>`;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function AcceptanceTemplatesPage(): React.ReactElement {
  const router = useRouter();
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [templates, setTemplates] = useState<AcceptanceTemplate[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcceptanceTemplate | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setTemplates(await listAcceptanceTemplates(token));
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
    if (
      !confirm("Xoá template? Chỉ xoá được khi không registration nào đang tham chiếu.")
    )
      return;
    try {
      await deleteAcceptanceTemplate(token, id);
      toast.success("Đã xoá");
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
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Mẫu biên bản nghiệm thu
        </h1>
        <Link href="/team-management/contract-templates">
          <Button variant="ghost" size="sm">
            <FileText className="mr-2 size-4" /> Mẫu hợp đồng
          </Button>
        </Link>
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

      <p className="text-sm text-muted-foreground">
        Mỗi event có thể có 1 template riêng. Nếu không có, hệ thống dùng
        template mặc định (<code>event_id = null, is_default = true</code>).
      </p>

      {templates === null ? (
        <Skeleton className="h-64" />
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Chưa có template nào.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Phạm vi</TableHead>
                <TableHead>Mặc định</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    {t.template_name}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.event_id == null ? (
                      <Badge variant="outline">Global</Badge>
                    ) : (
                      <Badge variant="outline">Event #{t.event_id}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.is_default ? (
                      <Badge className="bg-blue-500/20 text-blue-700">
                        Default
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.variables.length} key
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(t.updated_at).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Sửa"
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
                      title="Xoá"
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
  template: AcceptanceTemplate | null;
  onSaved: () => void;
}): React.ReactElement {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [html, setHtml] = useState("");
  const [vars, setVars] = useState("");
  const [eventIdStr, setEventIdStr] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(template?.template_name ?? "");
    setHtml(template?.content_html ?? BLANK_ACCEPTANCE_HTML);
    setVars((template?.variables ?? ACCEPTANCE_VARIABLES).join(", "));
    setEventIdStr(
      template?.event_id != null ? String(template.event_id) : "",
    );
    setIsDefault(template?.is_default ?? false);
  }, [open, template]);

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
    const body: AcceptanceTemplateInput = {
      template_name: name.trim(),
      content_html: html,
      variables,
      is_default: isDefault,
      event_id: eventIdStr.trim() ? Number(eventIdStr) : null,
    };
    setSaving(true);
    try {
      if (template) {
        await updateAcceptanceTemplate(token, template.id, body);
        toast.success("Đã cập nhật");
      } else {
        await createAcceptanceTemplate(token, body);
        toast.success("Đã tạo template");
      }
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const previewHtml = renderWithSample(html);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {template ? "Sửa template" : "Template mới"}
            </DialogTitle>
            <DialogDescription>
              Dùng placeholder {`{{key}}`}. HTML được sanitize ở backend.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Tên template *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label>Event ID (bỏ trống = global)</Label>
                <Input
                  value={eventIdStr}
                  onChange={(e) => setEventIdStr(e.target.value)}
                  placeholder="VD: 1"
                />
              </div>
            </div>
            <div>
              <Label>Nội dung HTML *</Label>
              <Textarea
                rows={16}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label>Variables (comma-separated)</Label>
              <Input value={vars} onChange={(e) => setVars(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                Các key được thay thế khi render biên bản.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <Label>Là template mặc định</Label>
                <p className="text-xs text-muted-foreground">
                  Chỉ có 1 template mặc định cho mỗi phạm vi (event hoặc
                  global). Bật cái này sẽ tự tắt cái cũ.
                </p>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-2 size-4" />
              Xem thử
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Xem thử với dữ liệu mẫu</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Placeholder màu đỏ là key không có trong dữ liệu mẫu — kiểm tra
            chính tả.
          </p>
          <iframe
            title="Preview acceptance template"
            className="h-[70vh] w-full rounded-md border bg-white"
            sandbox=""
            srcDoc={previewHtml}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
