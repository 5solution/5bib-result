'use client';
import { Button } from '@/components/ui/button';
import { PODIUM_STATES, type PodiumState } from '../awards.constant';
import { VN } from '../awards.microcopy';

interface Props {
  courseOptions: Array<{ courseId: string; name: string }>;
  selectedCourseId?: string;
  onCourseChange: (courseId: string | undefined) => void;
  selectedGender?: 'M' | 'F';
  onGenderChange: (g: 'M' | 'F' | undefined) => void;
  selectedState?: PodiumState;
  onStateChange: (s: PodiumState | undefined) => void;
}

export function FilterBar({
  courseOptions,
  selectedCourseId,
  onCourseChange,
  selectedGender,
  onGenderChange,
  selectedState,
  onStateChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-white p-2 text-xs">
      <span className="text-stone-500">Cự ly:</span>
      <Button
        size="sm"
        variant={!selectedCourseId ? 'default' : 'outline'}
        onClick={() => onCourseChange(undefined)}
      >
        Tất cả
      </Button>
      {courseOptions.map((c) => (
        <Button
          key={c.courseId}
          size="sm"
          variant={selectedCourseId === c.courseId ? 'default' : 'outline'}
          onClick={() => onCourseChange(c.courseId)}
        >
          {c.name}
        </Button>
      ))}

      <span className="ml-3 text-stone-500">Giới tính:</span>
      <Button
        size="sm"
        variant={!selectedGender ? 'default' : 'outline'}
        onClick={() => onGenderChange(undefined)}
      >
        Cả hai
      </Button>
      <Button
        size="sm"
        variant={selectedGender === 'M' ? 'default' : 'outline'}
        onClick={() => onGenderChange('M')}
      >
        Nam
      </Button>
      <Button
        size="sm"
        variant={selectedGender === 'F' ? 'default' : 'outline'}
        onClick={() => onGenderChange('F')}
      >
        Nữ
      </Button>

      <span className="ml-3 text-stone-500">Trạng thái:</span>
      <select
        className="rounded border border-stone-300 px-2 py-1 text-xs"
        value={selectedState ?? ''}
        onChange={(e) => onStateChange((e.target.value || undefined) as PodiumState | undefined)}
      >
        <option value="">Tất cả</option>
        {PODIUM_STATES.map((s) => (
          <option key={s} value={s}>
            {VN.STATE_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
