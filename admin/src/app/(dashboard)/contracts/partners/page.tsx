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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  deletePartner,
  listPartners,
  type PartnerView,
} from "@/lib/contracts-api";

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
  const [items, setItems] = useState<PartnerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
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
    if (!confirm(`Xoá đối tác "${p.entityName}"?`)) return;
    try {
      await deletePartner(p._id);
      toast.success("Đã xoá");
      load();
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Đối tác hợp đồng
        </h1>
        <Button onClick={() => router.push("/contracts/partners/new")}>
          <Plus className="size-4" /> Thêm đối tác
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted,#78716C)]" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên / MST"
          className="pl-8"
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
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-[var(--text-muted,#78716C)]"
                >
                  Chưa có đối tác nào — bấm "Thêm đối tác" để bắt đầu
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
