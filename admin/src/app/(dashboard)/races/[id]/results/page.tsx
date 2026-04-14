"use client";

/**
 * Admin: Edit Race Result
 * Route: /admin/races/[id]/results
 * PRD: Screen D — Admin Result Edit
 * Business Rules: BR-03 (audit trail), admin-only
 */

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { raceResultControllerGetAthleteDetail } from "@/lib/api-generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, Search, Clock, AlertTriangle } from "lucide-react";

interface EditHistoryEntry {
  editedBy: string;
  editedAt: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

interface ResultDetail {
  _id?: string;
  Bib: string;
  Name: string;
  ChipTime: string;
  GunTime: string;
  TimingPoint: string;
  OverallRank: string;
  GenderRank: string;
  CatRank: string;
  Gender: string;
  Category: string;
  distance: string;
  race_id: string;
  course_id: string;
  editHistory?: EditHistoryEntry[];
  isManuallyEdited?: boolean;
}

const STATUS_OPTIONS = ["Finisher", "DNF", "DNS", "DSQ"];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

export default function EditResultPage() {
  const params = useParams();
  const raceId = params.id as string;
  const router = useRouter();
  const { token } = useAuth();

  const [bibInput, setBibInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<ResultDetail | null>(null);
  const [resultId, setResultId] = useState<string>("");

  // Form fields
  const [chipTime, setChipTime] = useState("");
  const [gunTime, setGunTime] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [overallRank, setOverallRank] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!bibInput.trim() || !token) return;
    setSearching(true);
    setResult(null);
    try {
      const { data, error } = await raceResultControllerGetAthleteDetail({
        path: { raceId, bib: bibInput.trim() },
        ...authHeaders(token),
      });
      if (error) throw error;
      const raw = (data as any)?.data ?? data;
      if (!raw) {
        toast.error("Không tìm thấy VĐV với BIB này");
        return;
      }
      setResult(raw as ResultDetail);
      setResultId(raw._id || "");
      // Pre-fill form
      setChipTime(raw.ChipTime || "");
      setGunTime(raw.GunTime || "");
      setName(raw.Name || "");
      setStatus(raw.TimingPoint || "Finisher");
      setOverallRank(raw.OverallRank || "");
      setReason("");
    } catch {
      toast.error("Không thể tải kết quả VĐV");
    } finally {
      setSearching(false);
    }
  }, [bibInput, raceId, token]);

  const handleSave = async () => {
    if (!resultId || !token) return;
    if (!reason.trim() || reason.trim().length < 10) {
      toast.error("Lý do chỉnh sửa phải có ít nhất 10 ký tự (BR-03)");
      return;
    }

    const body: Record<string, unknown> = { reason: reason.trim() };
    if (chipTime !== result?.ChipTime) body.chipTime = chipTime;
    if (gunTime !== result?.GunTime) body.gunTime = gunTime;
    if (name !== result?.Name) body.name = name;
    if (status !== result?.TimingPoint) body.status = status;
    if (overallRank && overallRank !== result?.OverallRank) body.overallRank = Number(overallRank);

    if (Object.keys(body).length <= 1) {
      toast.info("Không có thay đổi nào để lưu");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/race-results/${resultId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Lưu thất bại");
      }
      const updated = await res.json();
      toast.success("Đã lưu chỉnh sửa thành công!");
      // Re-fetch to show updated audit trail
      setResult(updated.updatedResult || result);
      setReason("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/races/${raceId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white transition-colors"
        >
          <ChevronLeft className="size-4" />
          Quay lại
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Chỉnh sửa kết quả</h1>
          <p className="text-sm text-muted-foreground">Race ID: {raceId}</p>
        </div>
      </div>

      {/* Search by BIB */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
        <Label className="text-sm font-semibold mb-2 block">Tìm VĐV theo BIB</Label>
        <div className="flex gap-2">
          <Input
            value={bibInput}
            onChange={(e) => setBibInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Nhập số BIB..."
            className="max-w-xs"
          />
          <Button onClick={handleSearch} disabled={searching || !bibInput.trim()}>
            <Search className="size-4 mr-1.5" />
            {searching ? "Đang tìm..." : "Tìm kiếm"}
          </Button>
        </div>
      </div>

      {searching && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      )}

      {result && (
        <>
          {/* Result form */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">
                Sửa kết quả: BIB #{result.Bib} — {result.Name}
              </h2>
              {result.isManuallyEdited && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  Đã chỉnh sửa thủ công
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Họ tên</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="status">Trạng thái</Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="chip-time">
                  Chip Time
                  <span className="text-xs text-muted-foreground ml-1">(HH:MM:SS)</span>
                </Label>
                <Input
                  id="chip-time"
                  value={chipTime}
                  onChange={(e) => setChipTime(e.target.value)}
                  placeholder="03:20:15"
                  className="font-mono"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="gun-time">
                  Gun Time
                  <span className="text-xs text-muted-foreground ml-1">(HH:MM:SS)</span>
                </Label>
                <Input
                  id="gun-time"
                  value={gunTime}
                  onChange={(e) => setGunTime(e.target.value)}
                  placeholder="03:20:28"
                  className="font-mono"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="overall-rank" className="flex items-center gap-1.5">
                  Overall Rank
                  <span className="text-xs text-amber-400">(⚠️ Chỉ override khi cần)</span>
                </Label>
                <Input
                  id="overall-rank"
                  type="number"
                  value={overallRank}
                  onChange={(e) => setOverallRank(e.target.value)}
                  min={1}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reason" className="flex items-center gap-1">
                Lý do chỉnh sửa <span className="text-red-400">*</span>
                <span className="text-xs text-muted-foreground">(tối thiểu 10 ký tự, BR-03)</span>
              </Label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Lỗi timing system, thời gian chip bị ghi thừa 2 phút..."
                rows={3}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-600 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {reason.length > 0 && reason.length < 10 && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Cần thêm {10 - reason.length} ký tự nữa
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-700">
              <Button variant="outline" onClick={() => setResult(null)}>
                Hủy
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || reason.trim().length < 10}
              >
                {saving ? "Đang lưu..." : "💾 Lưu chỉnh sửa"}
              </Button>
            </div>
          </div>

          {/* Edit history (BR-03) */}
          {result.editHistory && result.editHistory.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="size-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Lịch sử chỉnh sửa</h3>
              </div>
              <div className="space-y-3">
                {[...result.editHistory].reverse().map((entry, i) => (
                  <div key={i} className="text-xs border border-zinc-700 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-300">{entry.editedBy}</span>
                      <span className="text-muted-foreground">{formatDate(entry.editedAt)}</span>
                    </div>
                    <p className="text-zinc-400">
                      <span className="text-amber-400 font-mono">{entry.field}</span>
                      {": "}
                      <span className="line-through text-red-400">{String(entry.oldValue ?? "—")}</span>
                      {" → "}
                      <span className="text-green-400">{String(entry.newValue ?? "—")}</span>
                    </p>
                    <p className="italic text-muted-foreground">&ldquo;{entry.reason}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
