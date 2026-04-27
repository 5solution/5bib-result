"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  listScheduleEmails,
  sendBulkScheduleEmail,
  type ScheduleEmailRoleSummary,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import ScheduleEmailConfigSheet from "./_config-sheet";

export default function ScheduleEmailsPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [rows, setRows] = useState<ScheduleEmailRoleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openRoleId, setOpenRoleId] = useState<number | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<ScheduleEmailRoleSummary | null>(
    null,
  );
  const [sendingBulk, setSendingBulk] = useState(false);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(eventId)) return;
    try {
      setError(null);
      const data = await listScheduleEmails(token, eventId);
      setRows(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, eventId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/sign-in");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleBulkConfirm(): Promise<void> {
    if (!bulkConfirm || !token) return;
    try {
      setSendingBulk(true);
      const res = await sendBulkScheduleEmail(
        token,
        eventId,
        bulkConfirm.role_id,
      );
      toast.success(
        `Đã gửi ${res.queued} email · bỏ qua ${res.skipped} thành viên chưa đủ điều kiện`,
      );
      setBulkConfirm(null);
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSendingBulk(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Email lịch trình</h1>
        <p className="text-sm text-muted-foreground">
          Gửi email chi tiết lịch trình vận hành theo từng vai trò. Chỉ gửi
          được cho thành viên đã ký hợp đồng (status ≥ <code>contract_signed</code>).
        </p>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {rows === null ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          Chưa có vai trò nào trong sự kiện này.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Vai trò</th>
                <th className="px-3 py-2">Thành viên đủ ĐK</th>
                <th className="px-3 py-2">Trạng thái cấu hình</th>
                <th className="px-3 py-2">Đã gửi</th>
                <th className="px-3 py-2">Lần gửi gần nhất</th>
                <th className="px-3 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.role_id} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.role_name}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.member_count_eligible}
                  </td>
                  <td className="px-3 py-2">
                    {r.config ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Đã cấu hình
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Chưa cấu hình
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {r.config
                      ? `${r.config.last_sent_count} / ${r.config.total_sent_count}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.config?.last_sent_at
                      ? new Date(r.config.last_sent_at).toLocaleString("vi-VN")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenRoleId(r.role_id)}
                      >
                        {r.config ? "Chỉnh sửa" : "Cấu hình"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          !r.config || r.member_count_eligible === 0
                        }
                        onClick={() => setBulkConfirm(r)}
                      >
                        Gửi cho {r.member_count_eligible} người
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openRoleId != null ? (
        <ScheduleEmailConfigSheet
          eventId={eventId}
          roleId={openRoleId}
          roleName={
            rows?.find((r) => r.role_id === openRoleId)?.role_name ?? "Vai trò"
          }
          eligibleCount={
            rows?.find((r) => r.role_id === openRoleId)
              ?.member_count_eligible ?? 0
          }
          onClose={() => {
            setOpenRoleId(null);
            void load();
          }}
        />
      ) : null}

      {bulkConfirm ? (
        <BulkConfirmDialog
          role={bulkConfirm}
          sending={sendingBulk}
          onCancel={() => setBulkConfirm(null)}
          onConfirm={handleBulkConfirm}
        />
      ) : null}
    </div>
  );
}

function BulkConfirmDialog({
  role,
  sending,
  onCancel,
  onConfirm,
}: {
  role: ScheduleEmailRoleSummary;
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): React.ReactElement {
  // Spec BR-SCH-02: eligible = contract_signed+. We only expose the count
  // — skipped members are surfaced in the success toast so the admin can
  // decide whether to chase contract signatures.
  return (
    <AlertDialog open onOpenChange={(v) => { if (!v && !sending) onCancel(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Gửi email lịch trình cho {role.role_name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block space-y-1.5 text-sm">
              <span className="block">
                → <strong>{role.member_count_eligible}</strong> thành viên đủ điều
                kiện nhận email
              </span>
              <span className="block text-muted-foreground">
                Thành viên chưa ký hợp đồng (status &lt; <code>contract_signed</code>)
                sẽ tự động bị bỏ qua.
              </span>
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={sending} onClick={onCancel}>
            Hủy
          </AlertDialogCancel>
          <AlertDialogAction disabled={sending} onClick={onConfirm}>
            {sending ? "Đang gửi..." : "Xác nhận gửi"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
