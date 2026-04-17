"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { exportPaymentReport } from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function ExportPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    download_url: string;
    row_count: number;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  async function handleExport(): Promise<void> {
    if (!token) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await exportPaymentReport(token, eventId);
      setResult(r);
      // Auto-open the download
      window.open(r.download_url, "_blank");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-bold">Xuất báo cáo thanh toán</h2>
        <p className="text-sm text-muted-foreground mt-1">
          File .xlsx bao gồm tất cả người đã được duyệt (status=approved). Cột:
          Họ tên, CCCD, SĐT, Email, Vai trò, Size áo, Ngày công, Đơn giá,
          Thành tiền, Ký HĐ, Check-in, Trạng thái TT. Link tải có hạn 10 phút.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            void handleExport();
          }}
          disabled={busy}
        >
          <Download className="mr-2 size-4" />
          {busy ? "Đang tạo file..." : "Tạo & tải báo cáo"}
        </Button>
      </div>

      {result ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm">
          <p className="font-medium text-green-800">
            Đã xuất {result.row_count} dòng.
          </p>
          <p className="text-green-700 mt-1">
            Nếu trình duyệt chặn popup, bấm link sau để tải:{" "}
            <a
              href={result.download_url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Tải file
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
