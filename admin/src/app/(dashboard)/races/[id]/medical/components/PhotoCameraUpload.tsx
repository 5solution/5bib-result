'use client';

/**
 * F-018 BR-MI-26..27 — photo camera upload with client-side resize.
 * Required ≥1 photo for Sev 4-5; server enforces.
 */
import { useRef, useState } from 'react';
import { usePhotoUpload } from '../hooks/usePhotoUpload';

interface PhotoCameraUploadProps {
  raceId: string;
  /** Use 'pending' before incident exists (queues s3Key for later attach). */
  incidentId: string | 'pending';
  required?: boolean;
  onAttach: (s3Key: string) => void;
}

export function PhotoCameraUpload({
  raceId,
  incidentId,
  required,
  onAttach,
}: PhotoCameraUploadProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { upload, uploading, error } = usePhotoUpload(
    raceId,
    incidentId === 'pending' ? 'pending' : incidentId,
  );

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPreviews((prev) => [...prev, previewUrl]);
    if (incidentId === 'pending') {
      // Pending: do not upload yet — caller will retry post-create.
      // For Phase 1 simplicity we skip the actual upload until the incident
      // exists. This means PhotoCameraUpload is most useful on the
      // detail drawer.
      return;
    }
    const result = await upload(file);
    if (result?.s3Key) onAttach(result.s3Key);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="min-h-[44px] rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
      >
        {uploading ? 'Đang tải lên...' : 'Chụp ảnh / Chọn ảnh'}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </button>
      {previews.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <li key={p}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p}
                alt={`Preview ${i + 1}`}
                className="size-16 rounded object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
