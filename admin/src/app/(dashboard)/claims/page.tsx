"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api"; // ensure client baseUrl is configured
import { authHeaders } from "@/lib/api";
import {
  adminControllerGetClaims,
  adminControllerResolveClaim,
} from "@/lib/api-generated";
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
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  resolutionNote?: string;
  resolvedBy?: string;
  autoUpdated?: boolean;
  created_at: string;
  createdAt?: string;
}

function ClaimStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "Chờ xử lý", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    approved: { label: "Chấp nhận", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    // legacy
    resolved: { label: "Chấp nhận", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    rejected: { label: "Từ chối", className: "bg-red-500/20 text-red-400 border-red-500/30" },
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

const STATUS_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "approved", label: "Chấp nhận" },
  { value: "rejected", label: "Từ chối" },
];

export default function ClaimsPage() {
  const { token } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");

  // Resolve dialog
  const [activeClaim, setActiveClaim] = useState<Claim | null>(null);
  const [resolveAction, setResolveAction] = useState<"approved" | "rejected">("approved");
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const fetchClaims = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data, error } = await adminControllerGetClaims({
        query: { page, pageSize: 20, status: statusFilter || undefined } as any,
        ...authHeaders(token),
      });

      if (error) throw error;

      const result = data as unknown as {
        data?: Claim[];
        pagination?: {
          page?: number;
          pageSize?: number;
          total?: number;
          totalPages?: number;
        };
      };

      const list = Array.isArray(result?.data) ? result.data : [];
      setClaims(list);
      setTotalPages(result?.pagination?.totalPages ?? 0);
    } catch {
      toast.error("Không thể tải danh sách khiếu nại");
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  function openResolve(claim: Claim, action: "approved" | "rejected") {
    setActiveClaim(claim);
    setResolveAction(action);
    setResolutionNote("");
  }

  async function handleResolve() {
    if (!token || !activeClaim) return;
    if (!resolutionNote.trim() || resolutionNote.trim().length < 5) {
      toast.error("Ghi chú giải quyết phải có ít nhất 5 ký tự");
      return;
    }
    setResolving(true);
    try {
      // Call new /resolve endpoint (BR-04)
      const res = await fetch(`/api/admin/claims/${activeClaim._id}/resolve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: resolveAction, resolutionNote: resolutionNote.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
          toast.error("Khiếu nại này đã được xử lý rồi");
        } else {
          throw new Error(err.message || "Lỗi xử lý khiếu nại");
        }
        return;
      }
      toast.success(
        resolveAction === "approved"
          ? "Đã chấp nhận và cập nhật kết quả!"
          : "Đã từ chối khiếu nại!"
      );
      setActiveClaim(null);
      fetchClaims();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Xử lý khiếu nại thất bại");
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

      {/* Status filter tabs */}
      <div className="flex gap-1 border border-zinc-700 rounded-lg p-1 w-fit">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {f.label}
          </button>
        ))}
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
                  <TableRow key={claim._id} className="cursor-pointer" onClick={() => openResolve(claim, claim.status === 'pending' ? 'approved' : claim.status as 'approved' | 'rejected')}>
                    <TableCell className="text-xs">
                      {formatDate(claim.created_at || claim.createdAt || '')}
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
                            onClick={(e) => { e.stopPropagation(); openResolve(claim, "approved"); }}
                            title="Chấp nhận"
                          >
                            <CheckCircle className="size-4 text-green-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => { e.stopPropagation(); openResolve(claim, "rejected"); }}
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {resolveAction === "approved"
                ? "✅ Chấp nhận & Cập nhật kết quả"
                : "❌ Từ chối khiếu nại"}
            </DialogTitle>
            <DialogDescription>
              {activeClaim && (
                <span>BIB: <strong>{activeClaim.bib}</strong> — {activeClaim.name}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          {activeClaim && (
            <div className="space-y-2 text-sm px-1 max-h-[40vh] overflow-y-auto">
              {activeClaim.phone && <p>📱 SĐT: <strong>{activeClaim.phone}</strong></p>}
              {activeClaim.email && <p>✉️ Email: {activeClaim.email}</p>}
              <p className="text-muted-foreground whitespace-pre-wrap">{activeClaim.description}</p>
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
              <Label htmlFor="resolution-note">
                Ghi chú giải quyết <span className="text-red-400">*</span>
                <span className="text-xs text-muted-foreground ml-1">(tối thiểu 5 ký tự)</span>
              </Label>
              <textarea
                id="resolution-note"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder={resolveAction === "approved" ? "Đã kiểm tra tracklog, xác nhận đúng..." : "Không đủ bằng chứng để xác nhận..."}
                rows={3}
                className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {resolutionNote.length > 0 && resolutionNote.length < 5 && (
                <p className="text-xs text-red-400">Cần thêm {5 - resolutionNote.length} ký tự nữa</p>
              )}
            </div>
            {resolveAction === "approved" && (
              <p className="text-xs text-amber-400 bg-amber-400/10 px-3 py-2 rounded-md">
                ⚠️ Khi chấp nhận, hệ thống sẽ tự động ghi log chỉnh sửa vào kết quả của VĐV.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveClaim(null)}>
              Hủy
            </Button>
            <Button
              variant={resolveAction === "approved" ? "default" : "destructive"}
              onClick={handleResolve}
              disabled={resolving || resolutionNote.trim().length < 5}
            >
              {resolving
                ? "Đang xử lý..."
                : resolveAction === "approved"
                  ? "Chấp nhận & Cập nhật"
                  : "Từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
