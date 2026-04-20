'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useUser, useAuth, UserButton } from '@clerk/nextjs';
import { toast } from 'sonner';
import {
  Camera,
  Loader2,
  Star,
  ChevronRight,
  Mail,
  Phone,
  Calendar,
  Shield,
  ExternalLink,
  Award,
  Heart,
} from 'lucide-react';
import { useStarredList, useToggleStar } from '@/lib/hooks/use-athlete-stars';

export default function AccountPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const customAvatar = (user?.publicMetadata as any)?.customAvatarUrl as
    | string
    | undefined;

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
      toast.success('Avatar đã được cập nhật');
      await user?.reload();
    } catch {
      toast.error('Upload thất bại');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!isLoaded || !user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const displayName = user.fullName || user.username || user.firstName || 'Bạn';
  const email = user.primaryEmailAddress?.emailAddress;
  const phone = user.primaryPhoneNumber?.phoneNumber;
  const joinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
      {/* ─── Profile banner ─── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 text-white shadow-xl">
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay bg-cover bg-center"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1600&q=60)',
          }}
        />
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-5 md:gap-7">
          {/* Avatar with upload */}
          <div className="relative group shrink-0">
            <img
              src={customAvatar || user.imageUrl}
              alt={displayName}
              className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover ring-4 ring-white/20 shadow-lg"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
              aria-label="Đổi avatar"
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
            {customAvatar && (
              <span className="absolute -bottom-1 -right-1 bg-cyan-400 text-slate-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow">
                S3
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              {displayName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-blue-100/90">
              {email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {email}
                </span>
              )}
              {phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {phone}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {user.primaryEmailAddress?.verification?.status === 'verified' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[11px] font-semibold">
                  <Shield className="w-3 h-3" /> Email xác thực
                </span>
              )}
              {joinDate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-blue-100 border border-white/20 text-[11px] font-semibold">
                  <Calendar className="w-3 h-3" /> Tham gia {joinDate}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 self-start">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-9 h-9 ring-2 ring-white/30',
                },
              }}
            />
          </div>
        </div>
      </section>

      {/* ─── Stats + Quick actions ─── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StarCountCard />
        <StatCard icon={Award} label="Kết quả đã lưu" value="—" subtle />
        <StatCard icon={Calendar} label="Giải đã theo dõi" value="—" subtle />
        <StatCard icon={Shield} label="Huy hiệu" value="—" subtle />
      </section>

      {/* ─── Starred athletes ─── */}
      <StarredAthletesSection />
    </div>
  );
}

/* ─── Stat card ─── */

function StatCard({
  icon: Icon,
  label,
  value,
  subtle = false,
}: {
  icon: any;
  label: string;
  value: string | number;
  subtle?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        subtle
          ? 'bg-slate-50 border-slate-200'
          : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div
        className={`text-2xl font-black mt-1.5 ${
          subtle ? 'text-slate-400' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StarCountCard() {
  const { data } = useStarredList(1, 1);
  return (
    <div className="rounded-xl p-4 border bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
      <div className="flex items-center gap-2 text-amber-700 text-[11px] font-semibold uppercase tracking-wider">
        <Star className="w-3.5 h-3.5" fill="currentColor" />
        VĐV theo dõi
      </div>
      <div className="text-2xl font-black mt-1.5 text-amber-900">
        {data?.total ?? 0}
      </div>
    </div>
  );
}

/* ─── Starred athletes section ─── */

function StarredAthletesSection() {
  const { data, isLoading } = useStarredList(1, 50);
  const items = data?.data ?? [];

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <header className="px-5 md:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-bold flex items-center gap-2 text-slate-900">
          <Star className="w-5 h-5 text-amber-500" fill="currentColor" />
          Vận động viên đã theo dõi
          {data?.total !== undefined && data.total > 0 && (
            <span className="text-sm text-slate-400 font-normal">
              · {data.total}
            </span>
          )}
        </h2>
      </header>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <Star className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            Chưa có vận động viên nào
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Vào trang bảng xếp hạng của 1 giải, click icon ⭐ ở mỗi vận động
            viên để theo dõi họ.
          </p>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Xem lịch sự kiện <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((s) => (
            <StarredRow key={s._id} star={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function StarredRow({
  star,
}: {
  star: {
    _id: string;
    raceId: string;
    courseId: string;
    bib: string;
    athleteName: string;
    athleteGender: string;
    athleteCategory: string;
    raceName: string;
    raceSlug: string;
    courseName: string;
  };
}) {
  const toggle = useToggleStar(star.raceId, star.courseId);

  const formatName = (name: string) =>
    name
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const genderLabel =
    star.athleteGender === 'Male'
      ? 'Nam'
      : star.athleteGender === 'Female'
        ? 'Nữ'
        : star.athleteGender;

  return (
    <div className="px-5 md:px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
      <button
        type="button"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate({ bib: star.bib, isStarred: true })}
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-amber-500 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition-colors"
        title="Bỏ theo dõi"
        aria-label="Bỏ theo dõi"
      >
        <Star className="w-5 h-5" fill="currentColor" />
      </button>

      <Link
        href={`/races/${star.raceSlug}/${star.bib}`}
        className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-slate-900 truncate">
            {formatName(star.athleteName || '')}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono font-bold">
            BIB {star.bib}
          </span>
          {genderLabel && (
            <span className="text-[10px] text-slate-500 font-medium">
              {genderLabel}
              {star.athleteCategory && ` · ${star.athleteCategory}`}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 truncate mt-0.5">
          {star.raceName} <span className="text-slate-300">·</span>{' '}
          {star.courseName}
        </div>
      </Link>

      <Link
        href={`/races/${star.raceSlug}/ranking/${star.courseId}`}
        className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
        title="Xem bảng xếp hạng"
      >
        <ExternalLink className="w-4 h-4" />
      </Link>
    </div>
  );
}
