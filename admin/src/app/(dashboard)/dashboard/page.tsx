"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, authHeaders } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trophy, Radio, Users, FileWarning, RefreshCw, Trash2 } from "lucide-react";

interface DashboardStats {
  totalRaces: number;
  liveRaces: number;
  totalResults: number;
  pendingClaims: number;
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch races to get counts
      const [racesRes, claimsRes] = await Promise.all([
        api.GET("/api/races", {
          params: { query: { pageSize: 1 } },
          ...authHeaders(token),
        }),
        api.GET("/api/admin/claims", {
          params: { query: { pageSize: 1 } },
          ...authHeaders(token),
        }),
      ]);

      const racesData = racesRes.data as unknown as {
        data?: { totalItems?: number; list?: Array<{ status?: string }> };
      };

      // Fetch live races separately
      const liveRes = await api.GET("/api/races", {
        params: { query: { status: "live", pageSize: 1 } },
        ...authHeaders(token),
      });
      const liveData = liveRes.data as unknown as {
        data?: { totalItems?: number };
      };

      const claimsData = claimsRes.data as unknown as {
        data?: { totalItems?: number };
      };

      setStats({
        totalRaces: racesData?.data?.totalItems ?? 0,
        liveRaces: liveData?.data?.totalItems ?? 0,
        totalResults: 0, // Results count not directly available from API
        pendingClaims: claimsData?.data?.totalItems ?? 0,
      });
    } catch {
      toast.error("Không thể tải dữ liệu tổng quan");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function handleSyncAll() {
    if (!token) return;
    setSyncing(true);
    try {
      const { error } = await api.POST("/api/race-results/sync", {
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Đồng bộ thành công!");
      fetchStats();
    } catch {
      toast.error("Đồng bộ thất bại");
    } finally {
      setSyncing(false);
    }
  }

  const summaryCards = [
    {
      title: "Tổng số giải",
      value: stats?.totalRaces ?? 0,
      description: "Tổng số giải chạy trong hệ thống",
      icon: Trophy,
    },
    {
      title: "Giải đang diễn ra",
      value: stats?.liveRaces ?? 0,
      description: "Giải đang live",
      icon: Radio,
      highlight: true,
    },
    {
      title: "Tổng kết quả",
      value: stats?.totalResults ?? 0,
      description: "Tổng số kết quả đã import",
      icon: Users,
    },
    {
      title: "Khiếu nại chờ xử lý",
      value: stats?.pendingClaims ?? 0,
      description: "Số yêu cầu cần giải quyết",
      icon: FileWarning,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tổng quan</h1>
          <p className="text-sm text-muted-foreground">
            Tổng quan hệ thống 5BIB Result
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{card.title}</CardDescription>
              <card.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{card.value}</span>
                  {card.highlight && card.value > 0 && (
                    <Badge className="bg-green-500/20 text-green-400">
                      <span className="mr-1 inline-block size-2 animate-pulse rounded-full bg-green-400" />
                      Live
                    </Badge>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Thao tác nhanh</CardTitle>
          <CardDescription>
            Các thao tác quản lý hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={handleSyncAll} disabled={syncing}>
            <RefreshCw className={`size-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Đang đồng bộ..." : "Đồng bộ tất cả"}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (!token) return;
              try {
                // Purge cache requires a courseId, we use "all" as a placeholder
                await api.POST("/api/admin/cache/purge/{courseId}", {
                  params: { path: { courseId: "all" } },
                  ...authHeaders(token),
                });
                toast.success("Đã xóa bộ nhớ đệm!");
              } catch {
                toast.error("Xóa bộ nhớ đệm thất bại");
              }
            }}
          >
            <Trash2 className="size-4 mr-2" />
            Xóa bộ nhớ đệm
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
