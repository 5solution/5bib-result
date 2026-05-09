'use client';

/**
 * F-018 BR-MI-27 — client-side resize photo before upload.
 * Target <2MB post-resize via canvas.toBlob({quality, maxWidth}).
 *
 * Two-phase upload:
 *  1. POST /:id/photo-upload-url → server returns 5min signed PUT URL + s3Key.
 *  2. PUT to S3 directly (no backend hop).
 *
 * Returns `{ s3Key }` for caller to attach to incident attachmentKeys.
 */

import { useState } from 'react';
import { PHOTO_RESIZE } from '../medical.constant';

interface UploadResult {
  s3Key: string;
  signedUrl: string;
}

async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (file.size <= PHOTO_RESIZE.maxBytesPostResize) {
      // Already small enough — skip resize.
      resolve(file);
      return;
    }
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(PHOTO_RESIZE.maxWidth / img.width, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objUrl);
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objUrl);
          if (!blob) {
            reject(new Error('canvas.toBlob returned null'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        PHOTO_RESIZE.quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Image load failed'));
    };
    img.src = objUrl;
  });
}

export function usePhotoUpload(raceId: string, incidentId: string) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<UploadResult | null> => {
    setUploading(true);
    setError(null);
    try {
      const blob = await resizeImage(file);
      const mime = blob.type || file.type || 'image/jpeg';

      // Step 1 — get signed PUT URL.
      // KEEP raw fetch: backend signUploadUrl declares body as inline
      // `{ mime: string }` (not a DTO with @ApiProperty), so the regenerated
      // SDK type resolves `body?: never` and rejects the mime payload at
      // compile-time. Backend Swagger fix needed before SDK can wrap this call.
      const presignRes = await fetch(
        `/api/admin/races/${encodeURIComponent(raceId)}/medical-incidents/${incidentId}/photo-upload-url`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ mime }),
        },
      );
      if (!presignRes.ok) {
        throw new Error(`Presign failed: HTTP ${presignRes.status}`);
      }
      const { signedUrl, s3Key } = (await presignRes.json()) as {
        signedUrl: string;
        s3Key: string;
      };

      // Step 2 — direct PUT to S3.
      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'content-type': mime },
        body: blob,
      });
      if (!putRes.ok) {
        throw new Error(`S3 PUT failed: HTTP ${putRes.status}`);
      }
      return { s3Key, signedUrl };
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error };
}
