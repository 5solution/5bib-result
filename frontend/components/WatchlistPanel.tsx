'use client';

/**
 * F-11 Watchlist Panel — slide-in drawer listing every starred runner.
 *
 * Accessible from navbar Star icon. Groups runners by race.
 * Signed-out ↔ signed-in both supported via useStarredList hook.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { X, Star, Trophy, ExternalLink, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  useStarredList,
  useToggleStar,
  type AthleteStarRecord,
} from '@/lib/hooks/use-athlete-stars';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function WatchlistPanel({ open, onClose }: Props) {
  const { data, isLoading } = useStarredList(1, 100);
  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc key closes the panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Group by race for readability
  const byRace = new Map<string, AthleteStarRecord[]>();
  for (const it of items) {
    const arr = byRace.get(it.raceSlug || it.raceId) || [];
    arr.push(it);
    byRace.set(it.raceSlug || it.raceId, arr);
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Danh sách vận động viên theo dõi"
        className="relative bg-white w-full sm:w-[400px] max-w-full h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Star
              className="w-5 h-5 text-amber-500"
              fill="currentColor"
              aria-hidden
            />
            <h2 className="font-bold text-slate-900">VĐV đã theo dõi</h2>
            {total > 0 && (
              <span className="text-sm text-slate-400 font-normal">
                · {total}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-blue-600" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState onClose={onClose} />
          ) : (
            <div className="divide-y divide-slate-100">
              {Array.from(byRace.entries()).map(([slugOrId, races]) => (
                <div key={slugOrId} className="py-2">
                  <div className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {races[0]?.raceName || slugOrId}
                  </div>
                  {races.map((r) => (
                    <WatchlistRow key={r._id} star={r} onClose={onClose} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <footer className="px-5 py-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            Tap ⭐ bên cạnh VĐV để bỏ theo dõi
          </footer>
        )}
      </aside>
    </div>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
        <Star className="w-6 h-6 text-amber-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">
        Chưa theo dõi VĐV nào
      </p>
      <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
        Vào bảng xếp hạng của 1 giải, click icon ⭐ cạnh VĐV để thêm vào danh
        sách theo dõi.
      </p>
      <Link
        href="/calendar"
        onClick={onClose}
        className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        Xem lịch sự kiện
      </Link>
    </div>
  );
}

function WatchlistRow({
  star,
  onClose,
}: {
  star: AthleteStarRecord;
  onClose: () => void;
}) {
  const toggle = useToggleStar(star.raceId, star.courseId);

  const formatName = (name: string) =>
    name
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const genderLabel =
    star.athleteGender === 'Male'
      ? 'Nam'
      : star.athleteGender === 'Female'
        ? 'Nữ'
        : star.athleteGender;

  return (
    <div className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
      <button
        type="button"
        disabled={toggle.isPending}
        onClick={() =>
          toggle.mutate(
            { bib: star.bib, isStarred: true },
            {
              onSuccess: () =>
                toast.success('Đã bỏ theo dõi', { duration: 2000 }),
            },
          )
        }
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-amber-500 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition-colors"
        title="Bỏ theo dõi"
        aria-label="Bỏ theo dõi"
      >
        <Star className="w-4 h-4" fill="currentColor" />
      </button>

      <Link
        href={`/races/${star.raceSlug}/${star.bib}`}
        onClick={onClose}
        className="flex-1 min-w-0"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-slate-900 truncate">
            {star.athleteName ? formatName(star.athleteName) : `BIB ${star.bib}`}
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono font-bold">
            {star.bib}
          </span>
        </div>
        <div className="text-xs text-slate-500 truncate mt-0.5">
          {[star.courseName, genderLabel, star.athleteCategory]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </Link>

      <Link
        href={`/races/${star.raceSlug}/ranking/${star.courseId}`}
        onClick={onClose}
        className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
        aria-label="Xem bảng xếp hạng"
        title="Xem bảng xếp hạng"
      >
        <Trophy className="w-4 h-4" />
      </Link>
    </div>
  );
}
