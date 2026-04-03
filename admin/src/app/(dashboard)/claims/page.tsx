"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, authHeaders } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";

interface Claim {
  _id: string;
  raceId: string;
  raceName?: string;
  courseId: string;
  bib: string;
  name: string;
  email: string;
  phone?: string;
  description: string;
  attachments?: string[];
  status: "pending" | "resolved" | "rejected";
  adminNote?: string;
  createdAt: string;
}

function ClaimStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "Chờ xử lý", className: "bg-yellow-500/20 text-yellow-400" },
    resolved: { label: "Đã xử lý", className: "bg-green-500/20 text-green-400" },
    rejected: { label: "Từ chối", className: "bg-red-500/20 text-red-400" },
  };
  const c = config[status] || { label: status, className: "bg-zinc-500/20 text-zinc-400" };
  return <Badge className={c.className}>{c.label}</Badge>;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ClaimsPage() {
  const { token } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Resolve dialog
  const [activeClaim, setActiveClaim] = useState<Claim | null>(null);
  const [resolveAction, setResolveAction] = useState<"resolved" | "rejected">("resolved");
  const [adminNote, setAdminNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const fetchClaims = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await api.GET("/api/admin/claims", {
        params: { query: { page, pageSize: 20 } },
        ...authHeaders(token),
      });

      const result = data as unknown as {
        data?: {
          list?: Claim[];
          claims?: Claim[];
          totalPages?: number;
          totalItems?: number;
        };
        list?: Claim[];
        claims?: Claim[];
        totalPages?: number;
      };

      const list =
        result?.data?.list ||
        result?.data?.claims ||
        result?.list ||
        result?.claims ||
        [];
      setClaims(list);
      setTotalPages(result?.data?.totalPages ?? result?.totalPages ?? 0);
    } catch {
      toast.error("Không thể tải danh sách khiếu nại");
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  function openResolve(claim: Claim, action: "resolved" | "rejected") {
    setActiveClaim(claim);
    setResolveAction(action);
    setAdminNote("");
  }

  async function handleResolve() {
    if (!token || !activeClaim) return;
    setResolving(true);
    try {
      const { error } = await api.PATCH("/api/admin/claims/{id}", {
        params: { path: { id: activeClaim._id } },
        body: {
          status: resolveAction,
          adminNote: adminNote || undefined,
        },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success(
        resolveAction === "resolved"
          ? "Đã xử lý khiếu nại!"
          : "Đã từ chối khiếu nại!"
      );
      setActiveClaim(null);
      fetchClaims();
    } catch {
      toast.error("Xử lý khiếu nại thất bại");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Khiếu nại</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý yêu cầu chỉnh sửa kết quả thi đấu
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead className="hidden sm:table-cell">Giải</TableHead>
                <TableHead>Số BIB</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead className="hidden md:table-cell">Mô tả</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    Không có khiếu nại nào
                  </TableCell>
                </TableRow>
              ) : (
                claims.map((claim) => (
                  <TableRow key={claim._id} className="cursor-pointer" onClick={() => openResolve(claim, claim.status === 'pending' ? 'resolved' : claim.status as any)}>
                    <TableCell className="text-xs">
                      {formatDate(claim.createdAt)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {claim.raceName || claim.raceId}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {claim.bib}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{claim.name}</p>
                        {claim.phone && (
                          <p className="text-xs text-muted-foreground">📱 {claim.phone}</p>
                        )}
                        {claim.email && (
                          <p className="text-xs text-muted-foreground">{claim.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground">
                      {claim.description}
                    </TableCell>
                    <TableCell>
                      <ClaimStatusBadge status={claim.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {claim.status === "pending" ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openResolve(claim, "resolved")}
                            title="Xử lý"
                          >
                            <CheckCircle className="size-4 text-green-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openResolve(claim, "rejected")}
                            title="Từ chối"
                          >
                            <XCircle className="size-4 text-red-400" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {claim.adminNote || "-"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Trang {page}/{totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Resolve/Reject Dialog */}
      <Dialog
        open={!!activeClaim}
        onOpenChange={(open) => !open && setActiveClaim(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveAction === "resolved" ? "Xử lý khiếu nại" : "Từ chối khiếu nại"}
            </DialogTitle>
            <DialogDescription>
              {activeClaim && (
                <>BIB: <strong>{activeClaim.bib}</strong> — {activeClaim.name}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {activeClaim && (
            <div className="space-y-2 text-sm px-1">
              {activeClaim.phone && <p>📱 SĐT: <strong>{activeClaim.phone}</strong></p>}
              {activeClaim.email && <p>✉️ Email: {activeClaim.email}</p>}
              <p className="text-muted-foreground">{activeClaim.description}</p>
              {activeClaim.attachments && activeClaim.attachments.length > 0 && (
                <div className="pt-1">
                  <p className="font-medium mb-1">📎 Tệp đính kèm ({activeClaim.attachments.length}):</p>
                  <div className="grid grid-cols-2 gap-2">
                    {activeClaim.attachments.map((url, i) => {
                      const ext = url.split('.').pop()?.toLowerCase() || '';
                      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
                      const filename = url.split('/').pop() || `File ${i + 1}`;
                      return isImage ? (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-zinc-700 hover:border-blue-500 transition-colors">
                          <img src={url} alt={filename} className="w-full h-32 object-cover" />
                          <p className="text-[10px] text-muted-foreground p-1 truncate">{filename}</p>
                        </a>
                      ) : (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-lg border border-zinc-700 hover:border-blue-500 transition-colors">
                          <span className="text-lg">{['gpx', 'kml', 'kmz', 'fit', 'tcx'].includes(ext) ? '🗺️' : '📄'}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{filename}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{ext}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-note">Ghi chú admin</Label>
              <Input
                id="admin-note"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Nhập ghi chú..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveClaim(null)}>
              Hủy
            </Button>
            <Button
              variant={resolveAction === "resolved" ? "default" : "destructive"}
              onClick={handleResolve}
              disabled={resolving}
            >
              {resolving
                ? "Đang xử lý..."
                : resolveAction === "resolved"
                  ? "Xử lý"
                  : "Từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
