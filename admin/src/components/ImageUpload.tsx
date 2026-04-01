"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  token?: string;
  label?: string;
  previewHeight?: string;
  accept?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function ImageUpload({
  value,
  onChange,
  folder = "images",
  token,
  label = "Tải ảnh lên",
  previewHeight = "h-32",
  accept = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!token) {
        toast.error("Chưa đăng nhập");
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const res = await fetch(`${API_URL}/api/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Upload failed");
        }

        const data = await res.json();
        const url = data?.url ?? data;
        if (!url) throw new Error("Upload failed");
        onChange(url);
        toast.success("Tải ảnh thành công!");
      } catch (err: any) {
        toast.error(err.message || "Tải ảnh thất bại");
      } finally {
        setUploading(false);
      }
    },
    [token, folder, onChange]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleRemove = () => {
    onChange("");
  };

  return (
    <div className="flex flex-col gap-2">
      {/* URL Input (manual entry also supported) */}
      <div className="flex gap-2">
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="URL ảnh hoặc kéo thả bên dưới"
          className="flex-1"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            title="Xóa ảnh"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Drop zone / Preview */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`
          relative rounded-lg border-2 border-dashed transition-all cursor-pointer
          ${
            dragOver
              ? "border-primary bg-primary/5"
              : value
              ? "border-border"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }
          ${previewHeight} flex items-center justify-center overflow-hidden
        `}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <span className="text-xs">Đang tải lên...</span>
          </div>
        ) : value ? (
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-contain bg-white p-1"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="size-8 opacity-40" />
            <span className="text-xs">{label}</span>
            <span className="text-[10px] opacity-60">
              Kéo thả hoặc nhấn để chọn
            </span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
