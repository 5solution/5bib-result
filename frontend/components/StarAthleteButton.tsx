'use client';

import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { useToggleStar } from '@/lib/hooks/use-athlete-stars';

interface Props {
  raceId: string;
  courseId: string;
  bib: string;
  isStarred: boolean;
  size?: 'sm' | 'md';
  athlete?: {
    name?: string;
    raceName?: string;
    raceSlug?: string;
    courseName?: string;
    gender?: string;
    category?: string;
  };
}

/**
 * Star toggle — localStorage when signed-out, backend when signed-in.
 * Works the same either way; the hook routes storage automatically.
 */
export default function StarAthleteButton({
  raceId,
  courseId,
  bib,
  isStarred,
  size = 'md',
  athlete,
}: Props) {
  const toggle = useToggleStar(raceId, courseId);

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const btnSize = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const base = `${btnSize} rounded-full flex items-center justify-center transition-all active:scale-90`;

  return (
    <button
      type="button"
      disabled={toggle.isPending}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle.mutate(
          {
            bib,
            isStarred,
            athlete: athlete
              ? {
                  name: athlete.name,
                  raceName: athlete.raceName,
                  raceSlug: athlete.raceSlug,
                  courseName: athlete.courseName,
                  athleteGender: athlete.gender,
                  athleteCategory: athlete.category,
                }
              : undefined,
          },
          {
            onSuccess: () => {
              const label = athlete?.name || `BIB ${bib}`;
              toast.success(
                isStarred
                  ? `Đã bỏ theo dõi ${label}`
                  : `Đã thêm ${label} vào danh sách theo dõi`,
                { duration: 2000 },
              );
            },
            onError: (err: Error & { code?: string }) => {
              if (err.code === 'race-limit') {
                toast.error(
                  'Đã đạt giới hạn 20 VĐV cho giải này. Xoá bớt để tiếp tục.',
                );
              } else if (err.code === 'total-limit') {
                toast.error(
                  'Watchlist đầy (100/100). Xoá bớt để tiếp tục theo dõi.',
                );
              } else {
                toast.error('Không thể cập nhật. Thử lại sau.');
              }
            },
          },
        );
      }}
      aria-label={isStarred ? 'Bỏ theo dõi' : 'Theo dõi'}
      className={`${base} ${
        isStarred
          ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
          : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'
      } disabled:opacity-50`}
      title={isStarred ? 'Bỏ theo dõi' : 'Theo dõi VĐV này'}
    >
      <Star
        className={`${iconSize} transition-transform ${
          toggle.isPending ? '' : 'hover:scale-110'
        }`}
        fill={isStarred ? 'currentColor' : 'none'}
      />
    </button>
  );
}
