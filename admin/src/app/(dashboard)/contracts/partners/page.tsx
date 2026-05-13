"use client";

/**
 * F-024 Partner list page (BR-CM-10).
 *
 * Standalone CRUD — Partner Picker dialog only reused inside wizard.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, Plus, Trash2, Users } from "lucide-react";
import {
  deletePartner,
  listPartners,
  type PartnerView,
} from "@/lib/contracts-api";
import { useConfirm } from "@/components/confirm-dialog";
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { SearchInput } from "../_components/search-input";
import { EmptyState } from "../_components/empty-state";
import { PartnerImportDialog } from "../_components/partner-import-dialog";

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function PartnersPage() {
  const router = useRouter();
  const confirm = useConfirm();
  // F-029 BR-HD-30 — page-level RBAC gate.
  const { isStaff, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<PartnerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const debouncedQ = useDebounced(q, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPartners({
        q: debouncedQ.trim() || undefined,
        limit: 50,
      });
      setItems(res.items);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(p: PartnerView) {
    const ok = await confirm({
      title: "Xoá đối tác?",
      description: `Xoá đối tác "${p.entityName}"? Hành động này không thể hoàn tác.`,
      confirmText: "Xoá",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deletePartner(p._id);
      toast.success("Đã xoá");
      load();
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    }
  }

  if (authLoading) return null;
  if (!isStaff) return <RestrictedAccess />;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Đối tác hợp đồng
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="size-4" /> Import Excel
          </Button>
          <Button onClick={() => router.push("/contracts/partners/new")}>
            <Plus className="size-4" /> Thêm đối tác
          </Button>
        </div>
      </div>

      <PartnerImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          setImportOpen(false);
          load();
        }}
      />

      <div className="max-w-md">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm theo tên / MST"
          ariaLabel="Tìm đối tác"
        />
      </div>

      <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên đối tác</TableHead>
              <TableHead>MST</TableHead>
              <TableHead>Đại diện</TableHead>
              <TableHead>Điện thoại</TableHead>
              <TableHead>Email</TableHead>
              <TableHead aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-0">
                  <EmptyState
                    icon={Users}
                    title="Chưa có đối tác nào"
                    description={
                      q
                        ? "Không tìm thấy đối tác khớp tìm kiếm."
                        : "Tạo đối tác đầu tiên để bắt đầu quản lý hợp đồng."
                    }
                    cta={
                      !q && (
                        <Button
                          onClick={() => router.push("/contracts/partners/new")}
                        >
                          <Plus className="size-4" /> Thêm đối tác
                        </Button>
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.map((p) => (
                <TableRow
                  key={p._id}
                  className="cursor-pointer hover:bg-[#FAF8F5]"
                  onClick={() => router.push(`/contracts/partners/${p._id}`)}
                >
                  <TableCell className="font-medium">{p.entityName}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.taxId || "—"}
                  </TableCell>
                  <TableCell>{p.representative || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.phone || "—"}
                  </TableCell>
                  <TableCell>{p.email || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p);
                      }}
                      aria-label={`Xoá ${p.entityName}`}
                    >
                      <Trash2 className="size-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
