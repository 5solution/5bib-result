"use client";

/**
 * Admin: Edit Race Result
 * Route: /admin/races/[id]/results
 * PRD: Screen D — Admin Result Edit
 * Business Rules: BR-03 (audit trail), admin-only
 */

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { adminControllerGetAthleteDetail, adminControllerEditResult, type EditResultDto } from "@/lib/api-generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronLeft,
  Search,
  Clock,
  AlertTriangle,
  User,
  Trophy,
  Timer,
  PenLine,
  CheckCircle2,
  History,
} from "lucide-react";

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
  try { return new Date(iso).toLocaleString("vi-VN"); } catch { return iso; }
}

function InfoChip({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value || "—"}</span>
    </div>
  );
}

export default function EditResultPage() {
  const params = useParams();
  const raceId = params.id as string;
  const { token } = useAuth();

  const [bibInput, setBibInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<ResultDetail | null>(null);
  const [resultId, setResultId] = useState<string>("");

  const [chipTime, setChipTime] = useState("");
  const [gunTime, setGunTime] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [overallRank, setOverallRank] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const hasChanges =
    chipTime !== result?.ChipTime ||
    gunTime !== result?.GunTime ||
    name !== result?.Name ||
    status !== result?.TimingPoint ||
    (overallRank !== "" && overallRank !== result?.OverallRank);

  const handleSearch = useCallback(async () => {
    if (!bibInput.trim() || !token) return;
    setSearching(true);
    setResult(null);
    try {
      const { data, error } = await adminControllerGetAthleteDetail({
        path: { raceId, bib: bibInput.trim() },
        ...authHeaders(token),
      });
      if (error) throw error;
      const raw = (data as any)?.data ?? data;
      if (!raw) { toast.error("Không tìm thấy VĐV với BIB này"); return; }
      setResult(raw as ResultDetail);
      setResultId(raw._id || "");
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
    if (Object.keys(body).length <= 1) { toast.info("Không có thay đổi nào để lưu"); return; }

    setSaving(true);
    try {
      const { error } = await adminControllerEditResult({
        path: { resultId },
        body: body as EditResultDto,
        ...authHeaders(token),
      });
      if (error) throw new Error((error as any)?.message || "Lưu thất bại");
      toast.success("Đã lưu chỉnh sửa thành công!");
      await handleSearch();
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
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Quay lại
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-gray-900">Chỉnh sửa kết quả</h1>
          <p className="text-xs text-muted-foreground">Race ID: {raceId}</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            Tìm vận động viên
          </CardTitle>
          <CardDescription>Nhập số BIB để tải thông tin và chỉnh sửa kết quả</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={bibInput}
              onChange={(e) => setBibInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Nhập số BIB..."
              className="max-w-[200px] font-mono text-base"
            />
            <Button onClick={handleSearch} disabled={searching || !bibInput.trim()}>
              <Search className="size-4 mr-1.5" />
              {searching ? "Đang tìm..." : "Tìm kiếm"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searching && (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {result && (
        <>
          {/* Athlete info card */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="size-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">{result.Name}</h2>
                      {result.isManuallyEdited && (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                          style={{ background: "#fef3c7", color: "#b45309", borderColor: "#fcd34d" }}
                        >
                          Đã chỉnh sửa thủ công
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">BIB #{result.Bib} · {result.distance || result.course_id}</p>
                  </div>
                </div>
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                  style={
                    result.TimingPoint === "Finisher"
                      ? { background: "#dcfce7", color: "#15803d", borderColor: "#86efac" }
                      : result.TimingPoint === "DNF"
                      ? { background: "#fee2e2", color: "#b91c1c", borderColor: "#fca5a5" }
                      : { background: "#f3f4f6", color: "#6b7280", borderColor: "#d1d5db" }
                  }
                >
                  {result.TimingPoint}
                </span>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <InfoChip label="Chip Time" value={result.ChipTime} />
                <InfoChip label="Gun Time" value={result.GunTime} />
                <InfoChip label="Overall Rank" value={result.OverallRank ? `#${result.OverallRank}` : undefined} />
                <InfoChip label="Gender Rank" value={result.GenderRank ? `#${result.GenderRank}` : undefined} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                <InfoChip label="Giới tính" value={result.Gender} />
                <InfoChip label="Hạng mục" value={result.Category} />
                <InfoChip label="Cat Rank" value={result.CatRank ? `#${result.CatRank}` : undefined} />
              </div>
            </CardContent>
          </Card>

          {/* Edit form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PenLine className="size-4 text-muted-foreground" />
                Chỉnh sửa thông tin
              </CardTitle>
              <CardDescription>
                Chỉ các trường được thay đổi sẽ được ghi vào lịch sử
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name" className="flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" /> Họ tên
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={name !== result.Name ? "border-amber-400 bg-amber-50" : ""}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="flex items-center gap-1.5">
                    <Trophy className="size-3.5 text-muted-foreground" /> Trạng thái
                  </Label>
                  <Select value={status} onValueChange={(v) => setStatus(v ?? '')}>
                    <SelectTrigger className={status !== result.TimingPoint ? "border-amber-400 bg-amber-50" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="chip-time" className="flex items-center gap-1.5">
                    <Timer className="size-3.5 text-muted-foreground" />
                    Chip Time
                    <span className="text-xs text-muted-foreground">(HH:MM:SS)</span>
                  </Label>
                  <Input
                    id="chip-time"
                    value={chipTime}
                    onChange={(e) => setChipTime(e.target.value)}
                    placeholder="03:20:15"
                    className={`font-mono ${chipTime !== result.ChipTime ? "border-amber-400 bg-amber-50" : ""}`}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="gun-time" className="flex items-center gap-1.5">
                    <Timer className="size-3.5 text-muted-foreground" />
                    Gun Time
                    <span className="text-xs text-muted-foreground">(HH:MM:SS)</span>
                  </Label>
                  <Input
                    id="gun-time"
                    value={gunTime}
                    onChange={(e) => setGunTime(e.target.value)}
                    placeholder="03:20:28"
                    className={`font-mono ${gunTime !== result.GunTime ? "border-amber-400 bg-amber-50" : ""}`}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="overall-rank" className="flex items-center gap-1.5">
                    <Trophy className="size-3.5 text-muted-foreground" />
                    Overall Rank
                    <span className="text-xs text-amber-500 flex items-center gap-0.5">
                      <AlertTriangle className="size-3" /> Chỉ override khi cần
                    </span>
                  </Label>
                  <Input
                    id="overall-rank"
                    type="number"
                    value={overallRank}
                    onChange={(e) => setOverallRank(e.target.value)}
                    min={1}
                    className={`font-mono max-w-[160px] ${overallRank !== result.OverallRank ? "border-amber-400 bg-amber-50" : ""}`}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <Label htmlFor="reason" className="flex items-center gap-1.5">
                  <PenLine className="size-3.5 text-muted-foreground" />
                  Lý do chỉnh sửa
                  <span className="text-destructive">*</span>
                  <span className="text-xs text-muted-foreground">(tối thiểu 10 ký tự · BR-03)</span>
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: Lỗi timing system, thời gian chip bị ghi thừa 2 phút..."
                  rows={3}
                  className="resize-none"
                />
                <div className="flex items-center justify-between">
                  {reason.length > 0 && reason.length < 10 ? (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="size-3" />
                      Cần thêm {10 - reason.length} ký tự nữa
                    </p>
                  ) : reason.length >= 10 ? (
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Hợp lệ
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-muted-foreground">{reason.length} ký tự</span>
                </div>
              </div>

              {hasChanges && (
                <div className="rounded-lg border px-3 py-2 text-xs flex items-center gap-2" style={{ background: "#fef3c7", color: "#b45309", borderColor: "#fcd34d" }}>
                  <AlertTriangle className="size-3.5 flex-shrink-0" />
                  Có thay đổi chưa lưu — các trường được đánh dấu sẽ được ghi vào audit trail
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setResult(null)}>Hủy</Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || reason.trim().length < 10 || !hasChanges}
                >
                  {saving ? "Đang lưu..." : "Lưu chỉnh sửa"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Edit history */}
          {result.editHistory && result.editHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="size-4 text-muted-foreground" />
                  Lịch sử chỉnh sửa
                  <Badge className="ml-auto bg-muted text-muted-foreground text-xs">
                    {result.editHistory.length} lần
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...result.editHistory].reverse().map((entry, i) => (
                    <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{entry.editedBy}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(entry.editedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-amber-500">{entry.field}</span>
                        <span className="line-through text-destructive">{String(entry.oldValue ?? "—")}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-green-500">{String(entry.newValue ?? "—")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic">&ldquo;{entry.reason}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
