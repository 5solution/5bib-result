'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useAuth, UserButton } from '@clerk/nextjs';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';

interface BackendUser {
  clerkId: string;
  sessionId: string;
  email: string | null;
  fullName: string | null;
  imageUrl: string | null;
  metadata: Record<string, unknown>;
}

export default function AccountPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [backendData, setBackendData] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const customAvatar =
    (backendData?.metadata as any)?.customAvatarUrl ||
    (user?.publicMetadata as any)?.customAvatarUrl;

  const fetchMe = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      setBackendData(json.data);
    } catch (e) {
      toast.error('Không tải được thông tin từ backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && user) fetchMe();
  }, [isLoaded, user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/users/me/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      toast.success('Avatar đã được cập nhật');
      await user?.reload();
      await fetchMe();
    } catch {
      toast.error('Upload thất bại');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!isLoaded) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Tài khoản</h1>
        <UserButton />
      </div>

      <div className="bg-white border border-[var(--5bib-border)] rounded-xl p-6">
        <div className="flex items-start gap-6">
          <div className="relative group">
            <img
              src={customAvatar || user?.imageUrl}
              alt=""
              className="w-24 h-24 rounded-full object-cover border-2 border-[var(--5bib-border)]"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
              aria-label="Upload avatar"
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleUpload}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-lg">{user?.fullName || '—'}</div>
            <div className="text-sm text-[var(--5bib-text-muted)]">
              {user?.primaryEmailAddress?.emailAddress}
            </div>
            {customAvatar && (
              <div className="text-xs text-blue-600 mt-2">
                ✓ Đang dùng avatar tùy chỉnh (lưu trên S3)
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[var(--5bib-border)] rounded-xl p-6">
        <h2 className="font-semibold mb-3">Phản hồi từ backend (protected)</h2>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : backendData ? (
          <pre className="text-xs bg-slate-50 p-4 rounded overflow-x-auto">
            {JSON.stringify(backendData, null, 2)}
          </pre>
        ) : (
          <div className="text-sm text-red-600">Không có dữ liệu</div>
        )}
      </div>
    </div>
  );
}
