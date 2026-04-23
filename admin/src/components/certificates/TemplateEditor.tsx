"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Stage, Layer, Rect, Text, Image as KonvaImage, Line, Circle, Group, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Save,
  ZoomIn,
  ZoomOut,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Plus,
  Type,
  Square,
  ImagePlus,
  User as UserIcon,
} from "lucide-react";
import {
  type CertificateTemplate,
  type TemplateLayer,
  type ShapeType,
  type TextAlign,
  TEMPLATE_VARIABLES,
  FONT_FAMILIES,
  certificateRenderUrl,
  updateCertificateTemplate,
  uploadImage,
} from "@/lib/certificate-api";
import "@/lib/api";
import { racesControllerSearchRaces } from "@/lib/api-generated";

interface Props {
  template: CertificateTemplate;
  token: string;
}

const SAMPLE_DATA: Record<string, string> = {
  runner_name: "NGUYỄN VĂN A",
  bib: "1234",
  finish_time: "1:12:13",
  pace: "5:24",
  distance: "21K",
  nation: "Vietnam",
  gender_rank: "5",
  ag_rank: "2",
  overall_rank: "42",
  event_name: "VMM 2025",
  event_date: "2025-09-21",
};

function interpolate(text: string): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => SAMPLE_DATA[k] ?? `{${k}}`);
}

function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

// ─── Layer renderers (preview on canvas) ──────────────────────

function TextLayerNode({
  layer,
  isSelected,
  onSelect,
  onChange,
}: {
  layer: TemplateLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TemplateLayer>) => void;
}) {
  const ref = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && ref.current && trRef.current) {
      trRef.current.nodes([ref.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const display = layer.variable
    ? SAMPLE_DATA[layer.variable] ?? `{${layer.variable}}`
    : interpolate(layer.text ?? "");

  return (
    <>
      <Text
        ref={ref}
        x={layer.x}
        y={layer.y}
        width={layer.width}
        text={display}
        fontFamily={layer.font ?? "Inter"}
        fontSize={layer.size ?? 24}
        fontStyle={layer.fontWeight === "bold" ? "bold" : "normal"}
        fill={layer.color ?? "#111"}
        align={layer.textAlign ?? "left"}
        rotation={layer.rotation ?? 0}
        opacity={layer.opacity ?? 1}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          enabledAnchors={["middle-left", "middle-right"]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20) return oldBox;
            return newBox;
          }}
          onTransformEnd={() => {
            const node = ref.current;
            if (!node) return;
            const newWidth = Math.max(20, node.width() * node.scaleX());
            node.scaleX(1);
            node.scaleY(1);
            onChange({ width: newWidth, x: node.x(), y: node.y() });
          }}
        />
      )}
    </>
  );
}

function ImageLayerNode({
  layer,
  isSelected,
  onSelect,
  onChange,
}: {
  layer: TemplateLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TemplateLayer>) => void;
}) {
  const [img] = useImage(layer.imageUrl ?? "");
  const ref = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && ref.current && trRef.current) {
      trRef.current.nodes([ref.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        ref={ref}
        image={img}
        x={layer.x}
        y={layer.y}
        width={layer.width ?? 100}
        height={layer.height ?? 100}
        rotation={layer.rotation ?? 0}
        opacity={layer.opacity ?? 1}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          onTransformEnd={() => {
            const node = ref.current;
            if (!node) return;
            const w = Math.max(10, (node.width() ?? 100) * node.scaleX());
            const h = Math.max(10, (node.height() ?? 100) * node.scaleY());
            node.scaleX(1);
            node.scaleY(1);
            onChange({ width: w, height: h, x: node.x(), y: node.y() });
          }}
        />
      )}
    </>
  );
}

function ShapeLayerNode({
  layer,
  isSelected,
  onSelect,
  onChange,
}: {
  layer: TemplateLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TemplateLayer>) => void;
}) {
  const w = layer.width ?? 100;
  const h = layer.height ?? 100;
  const refRect = useRef<Konva.Rect>(null);
  const refCircle = useRef<Konva.Circle>(null);
  const refLine = useRef<Konva.Line>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (!isSelected || !trRef.current) return;
    const node = refRect.current ?? refCircle.current ?? refLine.current;
    if (node) {
      trRef.current.nodes([node]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  if (layer.shape === "circle") {
    return (
      <>
        <Circle
          ref={refCircle}
          x={layer.x + w / 2}
          y={layer.y + h / 2}
          radius={Math.min(w, h) / 2}
          fill={layer.fillColor ?? "#3b82f6"}
          stroke={layer.strokeColor}
          strokeWidth={layer.strokeWidth ?? 0}
          opacity={layer.opacity ?? 1}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) =>
            onChange({ x: e.target.x() - w / 2, y: e.target.y() - h / 2 })
          }
        />
        {isSelected && <Transformer ref={trRef} />}
      </>
    );
  }

  if (layer.shape === "line") {
    return (
      <>
        <Line
          ref={refLine}
          points={[layer.x, layer.y, layer.x + w, layer.y]}
          stroke={layer.strokeColor ?? "#111"}
          strokeWidth={layer.strokeWidth ?? 2}
          opacity={layer.opacity ?? 1}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) =>
            onChange({ x: e.target.x() + layer.x, y: e.target.y() + layer.y })
          }
        />
        {isSelected && <Transformer ref={trRef} />}
      </>
    );
  }

  // rect / rounded_rect
  return (
    <>
      <Rect
        ref={refRect}
        x={layer.x}
        y={layer.y}
        width={w}
        height={h}
        fill={layer.fillColor ?? "#3b82f6"}
        stroke={layer.strokeColor}
        strokeWidth={layer.strokeWidth ?? 0}
        cornerRadius={layer.shape === "rounded_rect" ? layer.borderRadius ?? 12 : 0}
        opacity={layer.opacity ?? 1}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          onTransformEnd={() => {
            const node = refRect.current;
            if (!node) return;
            const w2 = Math.max(10, node.width() * node.scaleX());
            const h2 = Math.max(10, node.height() * node.scaleY());
            node.scaleX(1);
            node.scaleY(1);
            onChange({ width: w2, height: h2, x: node.x(), y: node.y() });
          }}
        />
      )}
    </>
  );
}

function PhotoAreaNode({
  layer,
  placeholderUrl,
  isSelected,
  onSelect,
  onChange,
}: {
  layer: TemplateLayer;
  placeholderUrl?: string | null;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TemplateLayer>) => void;
}) {
  const [img] = useImage(placeholderUrl ?? "");
  const w = layer.width ?? 200;
  const h = layer.height ?? 200;
  const trRef = useRef<Konva.Transformer>(null);
  const groupRef = useRef<Konva.Group>(null);

  useEffect(() => {
    if (isSelected && groupRef.current && trRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Group
        ref={groupRef}
        x={layer.x}
        y={layer.y}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
        clipFunc={(ctx) => {
          const r = layer.borderRadius ?? 0;
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.lineTo(w - r, 0);
          ctx.quadraticCurveTo(w, 0, w, r);
          ctx.lineTo(w, h - r);
          ctx.quadraticCurveTo(w, h, w - r, h);
          ctx.lineTo(r, h);
          ctx.quadraticCurveTo(0, h, 0, h - r);
          ctx.lineTo(0, r);
          ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.closePath();
        }}
      >
        <Rect width={w} height={h} fill="#e5e7eb" />
        {img && <KonvaImage image={img} width={w} height={h} />}
        {!img && (
          <Text
            x={0}
            y={h / 2 - 8}
            width={w}
            align="center"
            text="ẢNH VĐV"
            fontSize={14}
            fill="#6b7280"
          />
        )}
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          onTransformEnd={() => {
            const node = groupRef.current;
            if (!node) return;
            const sx = node.scaleX();
            const sy = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            onChange({
              width: Math.max(20, w * sx),
              height: Math.max(20, h * sy),
              x: node.x(),
              y: node.y(),
            });
          }}
        />
      )}
    </>
  );
}

// ─── Main Editor ──────────────────────────────────────────────

interface RaceOption {
  id: string;
  title: string;
  courses: { courseId: string; name: string }[];
}

export default function TemplateEditor({ template, token }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<CertificateTemplate>(template);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(0.5);
  const [saving, setSaving] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [previewBib, setPreviewBib] = useState("");
  const [races, setRaces] = useState<RaceOption[]>([]);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const imgFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    racesControllerSearchRaces({ query: { pageSize: 200 } })
      .then((res) => {
        if (cancelled) return;
        const list = (res.data?.data?.list ?? []) as Array<
          Record<string, unknown>
        >;
        const mapped: RaceOption[] = list
          .map((r) => {
            const id = String(r.id ?? r._id ?? "");
            const coursesRaw = (r.courses ?? []) as Array<
              Record<string, unknown>
            >;
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
      })
      .catch((err) => console.error("Failed to load races", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRace = races.find((r) => r.id === draft.race_id);

  const stageWidth = draft.canvas.width * zoom;
  const stageHeight = draft.canvas.height * zoom;

  const selected = selectedIdx !== null ? draft.layers[selectedIdx] : null;

  function updateLayer(idx: number, patch: Partial<TemplateLayer>) {
    setDraft((prev) => {
      const layers = prev.layers.slice();
      layers[idx] = { ...layers[idx], ...patch };
      return { ...prev, layers };
    });
  }

  function addLayer(layer: TemplateLayer) {
    setDraft((prev) => ({ ...prev, layers: [...prev.layers, layer] }));
    setSelectedIdx(draft.layers.length);
  }

  function deleteLayer(idx: number) {
    setDraft((prev) => ({
      ...prev,
      layers: prev.layers.filter((_, i) => i !== idx),
    }));
    if (selectedIdx === idx) setSelectedIdx(null);
  }

  function moveLayer(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= draft.layers.length) return;
    setDraft((prev) => {
      const layers = prev.layers.slice();
      [layers[idx], layers[newIdx]] = [layers[newIdx], layers[idx]];
      return { ...prev, layers };
    });
    setSelectedIdx(newIdx);
  }

  function addText(variable?: string) {
    const layer: TemplateLayer = {
      type: "text",
      x: 50,
      y: 50,
      width: 600,
      variable,
      text: variable ? undefined : "Text mới",
      font: "Be Vietnam Pro",
      size: 36,
      color: "#111111",
      textAlign: "left",
      fontWeight: "normal",
    };
    addLayer(layer);
  }

  function addShape(shape: ShapeType) {
    const layer: TemplateLayer = {
      type: "shape",
      shape,
      x: 100,
      y: 100,
      width: shape === "line" ? 200 : 200,
      height: shape === "line" ? 0 : 100,
      fillColor: "#3b82f6",
      strokeColor: "#1e40af",
      strokeWidth: shape === "line" ? 4 : 0,
      borderRadius: shape === "rounded_rect" ? 16 : 0,
    };
    addLayer(layer);
  }

  function addImage() {
    imgFileRef.current?.click();
  }

  async function handleBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File phải là ảnh");
      return;
    }
    setBgUploading(true);
    try {
      const url = await uploadImage(token, file);
      // Read dimensions to optionally match canvas aspect ratio
      const dims = await readImageDimensions(file);
      setDraft((prev) => ({
        ...prev,
        canvas: {
          ...prev.canvas,
          backgroundImageUrl: url,
          // If canvas is default portrait but uploaded bg is landscape, auto-resize
          ...(dims && dims.width > dims.height && prev.canvas.width < prev.canvas.height
            ? { width: 1600, height: Math.round((1600 * dims.height) / dims.width) }
            : {}),
        },
      }));
      toast.success("Đã upload ảnh nền");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload thất bại");
    } finally {
      setBgUploading(false);
    }
  }

  async function handleImageLayerFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File phải là ảnh");
      return;
    }
    setImgUploading(true);
    try {
      const url = await uploadImage(token, file);
      const dims = await readImageDimensions(file);
      const maxDim = 300;
      const ratio = dims ? dims.width / dims.height : 1;
      const w = ratio >= 1 ? maxDim : Math.round(maxDim * ratio);
      const h = ratio >= 1 ? Math.round(maxDim / ratio) : maxDim;
      addLayer({
        type: "image",
        imageUrl: url,
        x: 50,
        y: 50,
        width: w,
        height: h,
      });
      toast.success("Đã thêm ảnh");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload thất bại");
    } finally {
      setImgUploading(false);
    }
  }

  function addPhotoArea() {
    if (draft.type === "share_card") {
      toast.error("Share Card không hỗ trợ photo area");
      return;
    }
    addLayer({
      type: "photo",
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      borderRadius: 150,
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateCertificateTemplate(token, draft.id, {
        name: draft.name,
        race_id: draft.race_id,
        course_id: draft.course_id ?? null,
        canvas: draft.canvas,
        layers: draft.layers,
        photo_area: draft.photo_area,
        placeholder_photo_url: draft.placeholder_photo_url,
        photo_behind_background: draft.photo_behind_background ?? false,
      });
      toast.success("Đã lưu template");
      router.push("/certificates");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu thất bại");
      setSaving(false);
    }
  }

  function openRenderPreview() {
    if (!previewBib.trim()) {
      toast.error("Nhập BIB để preview render thật");
      return;
    }
    const url = certificateRenderUrl(
      draft.race_id,
      previewBib.trim(),
      draft.type,
      draft.course_id ?? undefined,
    );
    window.open(url, "_blank");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2 flex-wrap">
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="max-w-xs"
          placeholder="Tên template"
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Giải:</span>
          <Select
            value={draft.race_id}
            onValueChange={(v) =>
              v && setDraft({ ...draft, race_id: v, course_id: null })
            }
          >
            <SelectTrigger className="h-8 w-[260px] text-xs">
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
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Cự ly:</span>
          <Select
            value={draft.course_id ?? "__all__"}
            onValueChange={(v) =>
              setDraft({
                ...draft,
                course_id: !v || v === "__all__" ? null : v,
              })
            }
            disabled={!selectedRace || selectedRace.courses.length === 0}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
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
        <span className="text-xs text-muted-foreground">
          {draft.canvas.width}×{draft.canvas.height} · {draft.layers.length}{" "}
          layers
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="text-xs w-10 text-center">{(zoom * 100).toFixed(0)}%</span>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Input
            placeholder="BIB để preview"
            value={previewBib}
            onChange={(e) => setPreviewBib(e.target.value)}
            className="w-32"
          />
          <Button size="sm" variant="outline" onClick={openRenderPreview}>
            <Eye className="size-4" /> Preview
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="size-4" /> {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: tools */}
        <div className="w-56 shrink-0 overflow-y-auto border-r bg-card p-3 space-y-3">
          <div>
            <Label className="text-xs font-medium mb-2 block">Thêm layer</Label>
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant="outline" onClick={() => addText()}>
                <Type className="size-3.5" /> Text
              </Button>
              <Button size="sm" variant="outline" onClick={addImage}>
                <ImagePlus className="size-3.5" /> Ảnh
              </Button>
              <Button size="sm" variant="outline" onClick={() => addShape("rect")}>
                <Square className="size-3.5" /> Rect
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addShape("rounded_rect")}
              >
                <Square className="size-3.5" /> Round
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addShape("circle")}
              >
                <Plus className="size-3.5" /> Circle
              </Button>
              <Button size="sm" variant="outline" onClick={() => addShape("line")}>
                <Plus className="size-3.5" /> Line
              </Button>
              {draft.type === "certificate" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="col-span-2"
                  onClick={addPhotoArea}
                >
                  <UserIcon className="size-3.5" /> Ảnh VĐV
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-xs font-medium mb-2 block">
              Variables (click để thêm)
            </Label>
            <div className="space-y-1">
              {TEMPLATE_VARIABLES.map((v) => (
                <Button
                  key={v.key}
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start text-xs"
                  onClick={() => addText(v.key)}
                >
                  {`{${v.key}}`} — {v.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs font-medium">Background</Label>
            <Input
              type="color"
              value={draft.canvas.backgroundColor ?? "#ffffff"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  canvas: { ...draft.canvas, backgroundColor: e.target.value },
                })
              }
              className="h-8"
            />

            <input
              ref={bgFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBgFile}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              disabled={bgUploading}
              onClick={() => bgFileRef.current?.click()}
            >
              <ImagePlus className="size-3.5" />
              {bgUploading
                ? "Đang upload..."
                : draft.canvas.backgroundImageUrl
                  ? "Thay ảnh nền"
                  : "Upload ảnh nền"}
            </Button>

            {draft.canvas.backgroundImageUrl && (
              <div className="flex items-center gap-1">
                <Input
                  value={draft.canvas.backgroundImageUrl}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      canvas: {
                        ...draft.canvas,
                        backgroundImageUrl: e.target.value || undefined,
                      },
                    })
                  }
                  className="text-xs flex-1 min-w-0"
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      canvas: {
                        ...draft.canvas,
                        backgroundImageUrl: undefined,
                      },
                    })
                  }
                  title="Xóa ảnh nền"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            )}

            {/* Hidden input for image-layer upload — triggered from addImage() */}
            <input
              ref={imgFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageLayerFile}
            />
            {imgUploading && (
              <p className="text-xs text-muted-foreground">
                Đang upload ảnh layer...
              </p>
            )}

            {draft.canvas.backgroundImageUrl && (
              <label className="flex items-start gap-2 rounded border bg-muted/30 p-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.photo_behind_background ?? false}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      photo_behind_background: e.target.checked,
                    })
                  }
                />
                <span className="leading-snug">
                  <span className="font-medium">Ảnh VĐV xuống dưới khung</span>
                  <span className="block text-muted-foreground">
                    Dùng khi ảnh nền là PNG trong suốt có ô chừa sẵn cho ảnh
                    runner (VD: khung VMM). Ảnh JPG sẽ không hiện.
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Center: canvas */}
        <div className="flex-1 overflow-auto bg-muted/30 p-6 flex items-start justify-center">
          <div
            className="shadow-lg bg-white"
            style={{ width: stageWidth, height: stageHeight }}
          >
            <Stage
              width={stageWidth}
              height={stageHeight}
              scaleX={zoom}
              scaleY={zoom}
              onClick={(e) => {
                if (e.target === e.target.getStage()) setSelectedIdx(null);
              }}
            >
              <Layer>
                <BackgroundColorNode canvas={draft.canvas} />
                {(() => {
                  const behind = draft.photo_behind_background === true;
                  const nodes = draft.layers.map((layer, idx) => {
                    const onSelect = () => setSelectedIdx(idx);
                    const onChange = (patch: Partial<TemplateLayer>) =>
                      updateLayer(idx, patch);
                    const isSel = selectedIdx === idx;
                    if (layer.type === "text")
                      return (
                        <TextLayerNode
                          key={idx}
                          layer={layer}
                          isSelected={isSel}
                          onSelect={onSelect}
                          onChange={onChange}
                        />
                      );
                    if (layer.type === "image")
                      return (
                        <ImageLayerNode
                          key={idx}
                          layer={layer}
                          isSelected={isSel}
                          onSelect={onSelect}
                          onChange={onChange}
                        />
                      );
                    if (layer.type === "shape")
                      return (
                        <ShapeLayerNode
                          key={idx}
                          layer={layer}
                          isSelected={isSel}
                          onSelect={onSelect}
                          onChange={onChange}
                        />
                      );
                    if (layer.type === "photo")
                      return (
                        <PhotoAreaNode
                          key={idx}
                          layer={layer}
                          placeholderUrl={draft.placeholder_photo_url}
                          isSelected={isSel}
                          onSelect={onSelect}
                          onChange={onChange}
                        />
                      );
                    return null;
                  });
                  if (!behind) {
                    // Default: bg image → all layers
                    return (
                      <>
                        <BackgroundImageNode canvas={draft.canvas} />
                        {nodes}
                      </>
                    );
                  }
                  // Behind mode: photo-type layers → bg image → non-photo layers
                  const photoNodes = draft.layers
                    .map((l, i) => (l.type === "photo" ? nodes[i] : null))
                    .filter(Boolean);
                  const otherNodes = draft.layers
                    .map((l, i) => (l.type === "photo" ? null : nodes[i]))
                    .filter(Boolean);
                  return (
                    <>
                      {photoNodes}
                      <BackgroundImageNode canvas={draft.canvas} />
                      {otherNodes}
                    </>
                  );
                })()}
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Right: layers + properties */}
        <div className="w-72 shrink-0 border-l bg-card overflow-hidden flex flex-col">
          <Tabs defaultValue="props" className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid grid-cols-2 m-2">
              <TabsTrigger value="props">Properties</TabsTrigger>
              <TabsTrigger value="layers">Layers</TabsTrigger>
            </TabsList>

            <TabsContent value="props" className="flex-1 overflow-y-auto p-3 space-y-3">
              {selected ? (
                <PropertiesPanel
                  layer={selected}
                  onChange={(patch) => updateLayer(selectedIdx!, patch)}
                  onDelete={() => deleteLayer(selectedIdx!)}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Click một layer trên canvas để chỉnh
                </p>
              )}
            </TabsContent>

            <TabsContent value="layers" className="flex-1 overflow-y-auto p-3 space-y-1">
              {draft.layers.length === 0 && (
                <p className="text-xs text-muted-foreground">Chưa có layer</p>
              )}
              {draft.layers.map((l, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs cursor-pointer ${
                    selectedIdx === idx
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => setSelectedIdx(idx)}
                >
                  <span className="flex-1 truncate">
                    {layerLabel(l)}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(idx, -1);
                    }}
                  >
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(idx, 1);
                    }}
                  >
                    <ArrowDown className="size-3" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLayer(idx);
                    }}
                  >
                    <Trash2 className="size-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function layerLabel(l: TemplateLayer): string {
  if (l.type === "text") {
    return l.variable ? `T: {${l.variable}}` : `T: ${(l.text ?? "").slice(0, 16)}`;
  }
  if (l.type === "image") return `Img: ${(l.imageUrl ?? "").slice(0, 18)}`;
  if (l.type === "shape") return `Shape: ${l.shape}`;
  if (l.type === "photo") return "Ảnh VĐV";
  return l.type;
}

// ─── Background Nodes ─────────────────────────────────────────

function BackgroundColorNode({
  canvas,
}: {
  canvas: CertificateTemplate["canvas"];
}) {
  return (
    <Rect
      x={0}
      y={0}
      width={canvas.width}
      height={canvas.height}
      fill={canvas.backgroundColor ?? "#ffffff"}
      listening={false}
    />
  );
}

function BackgroundImageNode({
  canvas,
}: {
  canvas: CertificateTemplate["canvas"];
}) {
  const [bg, bgStatus] = useImage(canvas.backgroundImageUrl ?? "");
  useEffect(() => {
    if (bgStatus === "failed" && canvas.backgroundImageUrl) {
      console.error(
        "[cert] background image failed to load:",
        canvas.backgroundImageUrl,
      );
    }
  }, [bgStatus, canvas.backgroundImageUrl]);
  if (!bg) return null;
  return (
    <KonvaImage
      image={bg}
      x={0}
      y={0}
      width={canvas.width}
      height={canvas.height}
      listening={false}
    />
  );
}

// ─── Properties Panel ─────────────────────────────────────────

function PropertiesPanel({
  layer,
  onChange,
  onDelete,
}: {
  layer: TemplateLayer;
  onChange: (patch: Partial<TemplateLayer>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <NumField label="X" value={layer.x} onChange={(v) => onChange({ x: v })} />
        <NumField label="Y" value={layer.y} onChange={(v) => onChange({ y: v })} />
        <NumField
          label="W"
          value={layer.width ?? 0}
          onChange={(v) => onChange({ width: v })}
        />
        <NumField
          label="H"
          value={layer.height ?? 0}
          onChange={(v) => onChange({ height: v })}
        />
        <NumField
          label="Rotation"
          value={layer.rotation ?? 0}
          onChange={(v) => onChange({ rotation: v })}
        />
        <NumField
          label="Opacity"
          value={layer.opacity ?? 1}
          step={0.1}
          onChange={(v) => onChange({ opacity: v })}
        />
      </div>

      {layer.type === "text" && (
        <>
          <Separator />
          <div className="space-y-2">
            {layer.variable ? (
              <div>
                <Label className="text-xs">Variable</Label>
                <p className="text-xs font-mono mt-1 px-2 py-1 bg-muted rounded">
                  {`{${layer.variable}}`}
                </p>
              </div>
            ) : (
              <div>
                <Label className="text-xs">Text</Label>
                <Textarea
                  value={layer.text ?? ""}
                  onChange={(e) => onChange({ text: e.target.value })}
                  rows={2}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Font</Label>
                <Select
                  value={layer.font ?? "Inter"}
                  onValueChange={(v) => onChange({ font: v ?? undefined })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumField
                label="Size"
                value={layer.size ?? 24}
                onChange={(v) => onChange({ size: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Color</Label>
                <Input
                  type="color"
                  value={layer.color ?? "#111111"}
                  onChange={(e) => onChange({ color: e.target.value })}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Align</Label>
                <Select
                  value={layer.textAlign ?? "left"}
                  onValueChange={(v) =>
                    v && onChange({ textAlign: v as TextAlign })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Weight</Label>
              <Select
                value={layer.fontWeight ?? "normal"}
                onValueChange={(v) =>
                  onChange({ fontWeight: v ?? undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}

      {layer.type === "image" && (
        <>
          <Separator />
          <div>
            <Label className="text-xs">Image URL</Label>
            <Input
              value={layer.imageUrl ?? ""}
              onChange={(e) => onChange({ imageUrl: e.target.value })}
              className="text-xs"
            />
          </div>
        </>
      )}

      {layer.type === "shape" && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fill</Label>
              <Input
                type="color"
                value={layer.fillColor ?? "#3b82f6"}
                onChange={(e) => onChange({ fillColor: e.target.value })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Stroke</Label>
              <Input
                type="color"
                value={layer.strokeColor ?? "#000000"}
                onChange={(e) => onChange({ strokeColor: e.target.value })}
                className="h-8"
              />
            </div>
            <NumField
              label="Stroke W"
              value={layer.strokeWidth ?? 0}
              onChange={(v) => onChange({ strokeWidth: v })}
            />
            {layer.shape === "rounded_rect" && (
              <NumField
                label="Radius"
                value={layer.borderRadius ?? 0}
                onChange={(v) => onChange({ borderRadius: v })}
              />
            )}
          </div>
        </>
      )}

      {layer.type === "photo" && (
        <>
          <Separator />
          <NumField
            label="Border Radius"
            value={layer.borderRadius ?? 0}
            onChange={(v) => onChange({ borderRadius: v })}
          />
          <p className="text-xs text-muted-foreground">
            Ảnh thật của VĐV sẽ được fit cover khi render. Bạn có thể set
            placeholder ở backend.
          </p>
        </>
      )}

      <Separator />
      <Button
        variant="destructive"
        size="sm"
        className="w-full"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" /> Xoá layer
      </Button>
    </div>
  );
}

function NumField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8"
      />
    </div>
  );
}
