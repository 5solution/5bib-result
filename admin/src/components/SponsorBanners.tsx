"use client";

import { useState, useRef } from "react";
import { Plus, X, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface SponsorBannersProps {
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  token?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function SponsorBanners({
  value = [],
  onChange,
  folder = "races/sponsors",
  token,
}: SponsorBannersProps) {
  const [uploading, setUploading] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
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

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      const finalUrl = data?.url ?? data;
      if (!finalUrl) throw new Error("Upload failed");
      onChange([...value, finalUrl]);
      toast.success("Tải banner thành công!");
    } catch {
      toast.error("Tải banner thất bại");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddUrl = () => {
    if (manualUrl.trim()) {
      onChange([...value, manualUrl.trim()]);
      setManualUrl("");
    }
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Current banners */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {value.map((url, i) => (
            <div
              key={i}
              className="relative group rounded-lg border overflow-hidden h-20"
            >
              <img
                src={url}
                alt={`Sponsor ${i + 1}`}
                className="w-full h-full object-contain bg-white p-1"
              />
              <button
                onClick={() => handleRemove(i)}
                className="absolute top-1 right-1 size-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-3" />
              </button>
              <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1 rounded">
                #{i + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="flex gap-2">
        <Input
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          placeholder="Nhập URL hoặc tải ảnh lên"
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
        />
        {manualUrl && (
          <Button type="button" size="sm" variant="outline" onClick={handleAddUrl}>
            <Plus className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Tải lên
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
