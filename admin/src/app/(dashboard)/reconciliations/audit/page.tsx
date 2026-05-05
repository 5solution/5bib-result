"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type AuditItem = {
  id: string;
  tenant_id: number;
  tenant_name: string;
  race_title: string;
  period_start: string;
  period_end: string;
  expected_period_start: string;
  expected_period_end: string;
  deviation_start_days: number;
  deviation_end_days: number;
};

type AuditResponse = {
  total: number;
  items: AuditItem[];
};

export default function ReconciliationAuditPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [hasRun, setHasRun] = useState(false);

  async function runAudit() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reconciliations/audit/period-boundary", {
        headers: authHeaders(token).headers,
      });
      if (!res.ok) throw new Error("Audit failed");
      const json = await res.json();
      setData(json.data ?? json);
      setHasRun(true);
    } catch {
      toast.error("Không thể chạy audit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Audit kỳ đối soát</CardTitle>
          <CardDescription>
            Tìm reconciliation có <code>period_start</code>/<code>period_end</code>{" "}
            không snap về ngày đầu / cuối tháng (FEATURE-003 BR-10). Read-only, không sửa data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Button onClick={runAudit} disabled={loading}>
              {loading ? "Đang chạy..." : "Chạy audit"}
            </Button>
          </div>

          {hasRun && data && data.total === 0 && (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm">
              <p className="text-2xl mb-2">🎉</p>
              <p className="font-medium">Không có reconciliation nào lệch month-boundary.</p>
              <p className="text-muted-foreground mt-1">
                Toàn bộ {data.total === 0 ? "" : data.total} bản ghi đều có period_start là ngày 01 và period_end là ngày cuối tháng tương ứng.
              </p>
            </div>
          )}

          {hasRun && data && data.total > 0 && (
            <div className="flex flex-col gap-3">
              <div className="text-sm">
                Phát hiện <span className="font-semibold">{data.total}</span> reconciliation có period lệch boundary.
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Race</TableHead>
                      <TableHead>Stored start</TableHead>
                      <TableHead>Expected start</TableHead>
                      <TableHead>Stored end</TableHead>
                      <TableHead>Expected end</TableHead>
                      <TableHead>Lệch</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">
                          <Link
                            className="text-blue-600 hover:underline"
                            href={`/reconciliations/${item.id}`}
                          >
                            {item.id.slice(-6)}
                          </Link>
                        </TableCell>
                        <TableCell>{item.tenant_name}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={item.race_title}>
                          {item.race_title}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.period_start}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.expected_period_start}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.period_end}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.expected_period_end}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {item.deviation_start_days !== 0 && (
                              <Badge variant="destructive">
                                start {item.deviation_start_days > 0 ? "+" : ""}
                                {item.deviation_start_days}d
                              </Badge>
                            )}
                            {item.deviation_end_days !== 0 && (
                              <Badge variant="destructive">
                                end {item.deviation_end_days > 0 ? "+" : ""}
                                {item.deviation_end_days}d
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
