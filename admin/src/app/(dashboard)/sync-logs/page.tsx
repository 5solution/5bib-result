"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api"; // ensure client baseUrl is configured
import { authHeaders } from "@/lib/api";
import { adminControllerGetSyncLogs } from "@/lib/api-generated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

interface SyncLog {
  _id: string;
  raceId?: string;
  raceName?: string;
  courseId?: string;
  courseName?: string;
  status: "success" | "failed" | "running" | "pending";
  duration?: number;
  resultsCount?: number;
  error?: string;
  createdAt: string;
}

function SyncStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    success: { label: "Thành công", className: "bg-green-500/20 text-green-400" },
    failed: { label: "Thất bại", className: "bg-red-500/20 text-red-400" },
    running: { label: "Đang chạy", className: "bg-yellow-500/20 text-yellow-400" },
    pending: { label: "Chờ xử lý", className: "bg-yellow-500/20 text-yellow-400" },
  };
  const c = config[status] || { label: status, className: "bg-zinc-500/20 text-zinc-400" };
  return (
    <Badge className={c.className}>
      {status === "running" && (
        <span className="mr-1 inline-block size-2 animate-pulse rounded-full bg-yellow-400" />
      )}
      {c.label}
    </Badge>
  );
}

function formatDuration(ms?: number) {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
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

export default function SyncLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    try {
      const { data, error } = await adminControllerGetSyncLogs({
        query: { page, pageSize: 20 },
        ...authHeaders(token),
      });

      if (error) throw error;

      const result = data as unknown as {
        data?: {
          list?: SyncLog[];
          logs?: SyncLog[];
          totalPages?: number;
          totalItems?: number;
        };
        list?: SyncLog[];
        logs?: SyncLog[];
        totalPages?: number;
      };

      const list =
        result?.data?.list ||
        result?.data?.logs ||
        result?.list ||
        result?.logs ||
        [];
      setLogs(list);
      setTotalPages(result?.data?.totalPages ?? result?.totalPages ?? 0);
    } catch {
      // silent fail for auto-refresh
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 30s
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchLogs();
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLogs]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nhật ký đồng bộ</h1>
          <p className="text-sm text-muted-foreground">
            Lịch sử đồng bộ dữ liệu (tự động làm mới mỗi 30s)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchLogs();
          }}
        >
          <RefreshCw className="size-4 mr-2" />
          Làm mới
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
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
                <TableHead className="hidden md:table-cell">Cự ly</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="hidden lg:table-cell">Thời lượng</TableHead>
                <TableHead className="hidden lg:table-cell">Kết quả</TableHead>
                <TableHead className="hidden xl:table-cell">Lỗi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    Chưa có nhật ký nào
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell className="text-xs">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {log.raceName || log.raceId || "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {log.courseName || log.courseId || "-"}
                    </TableCell>
                    <TableCell>
                      <SyncStatusBadge status={log.status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {formatDuration(log.duration)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {log.resultsCount ?? "-"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell max-w-[200px] truncate text-destructive text-xs">
                      {log.error || "-"}
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
    </div>
  );
}
