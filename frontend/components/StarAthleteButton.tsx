'use client';

import { Star } from 'lucide-react';
import { useAuth, SignInButton } from '@clerk/nextjs';
import { useToggleStar } from '@/lib/hooks/use-athlete-stars';

interface Props {
  raceId: string;
  courseId: string;
  bib: string;
  isStarred: boolean;
  size?: 'sm' | 'md';
}

export default function StarAthleteButton({
  raceId,
  courseId,
  bib,
  isStarred,
  size = 'md',
}: Props) {
  const { isSignedIn } = useAuth();
  const toggle = useToggleStar(raceId, courseId);

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const btnSize = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';

  const base = `${btnSize} rounded-full flex items-center justify-center transition-all`;

  if (!isSignedIn) {
    // Chưa login → click sẽ mở modal Clerk
    return (
      <SignInButton mode="modal">
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Đăng nhập để theo dõi"
          className={`${base} text-slate-300 hover:text-amber-500 hover:bg-amber-50`}
          title="Đăng nhập để theo dõi vận động viên"
        >
          <Star className={iconSize} />
        </button>
      </SignInButton>
    );
  }

  return (
    <button
      type="button"
      disabled={toggle.isPending}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle.mutate({ bib, isStarred });
      }}
      aria-label={isStarred ? 'Bỏ theo dõi' : 'Theo dõi'}
      className={`${base} ${
        isStarred
          ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
          : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'
      } disabled:opacity-50`}
    >
      <Star className={iconSize} fill={isStarred ? 'currentColor' : 'none'} />
    </button>
  );
}
