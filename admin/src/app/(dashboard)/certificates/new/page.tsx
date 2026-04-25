"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { racesControllerSearchRaces } from "@/lib/api-generated";
import {
  createCertificateTemplate,
  CANVAS_PRESETS,
  type CreateTemplateInput,
  type TemplateType,
} from "@/lib/certificate-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

interface RaceOption {
  id: string;
  title: string;
  courses: { courseId: string; name: string }[];
}

export default function NewTemplatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRaceId = searchParams.get("raceId") ?? "";

  const { token, isAuthenticated } = useAuth();
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [name, setName] = useState("");
  const [raceId, setRaceId] = useState<string>(initialRaceId);
  const [courseId, setCourseId] = useState<string>("");
  const [type, setType] = useState<TemplateType>("certificate");
  const [presetIdx, setPresetIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const loadRaces = useCallback(async () => {
    try {
      const res = await racesControllerSearchRaces({
        query: { pageSize: 200 },
      });
      const list = (res.data?.data?.list ?? []) as Array<Record<string, unknown>>;
      const mapped = list
        .map((r) => {
          const id = String(r.id ?? r._id ?? "");
          const coursesRaw = (r.courses ?? []) as Array<Record<string, unknown>>;
          return {
            id,
            title: String(r.title ?? "Untitled"),
            courses: coursesRaw
              .map((c) => ({
                courseId: String(c.courseId ?? c._id ?? ""),
                name: String(c.name ?? c.distance ?? "Course"),
              }))
              .filter((c) => c.courseId),
          };
        })
        .filter((r) => r.id);
      setRaces(mapped);
    } catch (err) {
      console.error("Failed to load races", err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadRaces();
  }, [isAuthenticated, loadRaces]);

  const selectedRace = races.find((r) => r.id === raceId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!name.trim() || !raceId) {
      toast.error("Cần điền tên và chọn giải");
      return;
    }
    setSubmitting(true);
    try {
      const preset = CANVAS_PRESETS[presetIdx];
      const input: CreateTemplateInput = {
        name: name.trim(),
        race_id: raceId,
        course_id: courseId || null,
        type,
        canvas: {
          width: preset.width,
          height: preset.height,
          backgroundColor: "#ffffff",
        },
        layers: [],
      };
      const created = await createCertificateTemplate(token, input);
      toast.success("Đã tạo template");
      router.push(`/certificates/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tạo template thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/certificates"
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Tạo Certificate Template</h1>
          <p className="text-sm text-muted-foreground">
            Sau khi tạo, bạn sẽ vào màn editor để thiết kế layout
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-xs font-medium">
            Tên template
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: VMM 2025 - Certificate 21K"
            required
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Giải đấu *</Label>
          <Select value={raceId} onValueChange={(v) => setRaceId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Chọn giải">
                {(val: string) =>
                  races.find((r) => r.id === val)?.title ??
                  (val ? "Đang tải..." : "Chọn giải")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {races.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">
            Cự ly (optional — để trống nếu áp dụng cho tất cả cự ly)
          </Label>
          <Select
            value={courseId || "__all__"}
            onValueChange={(v) =>
              setCourseId(!v || v === "__all__" ? "" : v)
            }
            disabled={!selectedRace || selectedRace.courses.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tất cả cự ly">
                {(val: string) => {
                  if (!val || val === "__all__") return "Tất cả cự ly";
                  return (
                    selectedRace?.courses.find((c) => c.courseId === val)
                      ?.name ?? val
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tất cả cự ly</SelectItem>
              {selectedRace?.courses.map((c) => (
                <SelectItem key={c.courseId} value={c.courseId}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Loại template</Label>
          <Select
            value={type}
            onValueChange={(v) => v && setType(v as TemplateType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(val: string) =>
                  val === "share_card"
                    ? "Share Card (typography-only, không cần ảnh)"
                    : "Certificate (giấy chứng nhận, có thể có ảnh VĐV)"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="certificate">
                Certificate (giấy chứng nhận, có thể có ảnh VĐV)
              </SelectItem>
              <SelectItem value="share_card">
                Share Card (typography-only, không cần ảnh)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Canvas size</Label>
          <Select
            value={String(presetIdx)}
            onValueChange={(v) => v && setPresetIdx(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(val: string) =>
                  CANVAS_PRESETS[Number(val)]?.label ?? "Chọn kích thước"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CANVAS_PRESETS.map((p, i) => (
                <SelectItem key={p.label} value={String(i)}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang tạo..." : "Tạo & mở editor"}
          </Button>
          <Link
            href="/certificates"
            className={buttonVariants({ variant: "outline" })}
          >
            Huỷ
          </Link>
        </div>
      </form>
    </div>
  );
}
