'use client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAnomalyWarnings } from '../hooks/useAnomalyWarnings';
import { VN } from '../awards.microcopy';

interface Props {
  raceId: string;
  courseId?: string;
  onOpenDrawer: () => void;
}

/**
 * F-019 sticky banner top of awards tab. Surfaces 3-tier counts.
 * Click → open drawer (Surface 3).
 */
export function AnomalyWarningsBanner({ raceId, courseId, onOpenDrawer }: Props) {
  const { data, isLoading } = useAnomalyWarnings(raceId, { courseId });
  if (isLoading || !data) {
    return null;
  }
  const c1 = data.countsByTier['1'] ?? 0;
  const c2 = data.countsByTier['2'] ?? 0;
  const c3 = data.countsByTier['3'] ?? 0;
  const tone =
    c1 > 0
      ? 'border-red-300 bg-red-50'
      : c2 > 0
      ? 'border-amber-300 bg-amber-50'
      : 'border-stone-200 bg-stone-50';
  return (
    <div className={`sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-md border ${tone} p-3 text-sm`}>
      <span className="font-semibold">Cảnh báo bất thường:</span>
      <Badge variant="outline" className="border-red-300 bg-red-100 text-red-800">
        {c1} {VN.BANNER_BLOCK_PREFIX}
      </Badge>
      <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
        {c2} {VN.BANNER_FLAG_PREFIX}
      </Badge>
      <Badge variant="outline" className="border-stone-300 bg-stone-100 text-stone-700">
        {c3} {VN.BANNER_INFO_PREFIX}
      </Badge>
      <Button
        size="sm"
        variant={c1 > 0 ? 'destructive' : 'outline'}
        onClick={onOpenDrawer}
        className="ml-auto"
      >
        {VN.BANNER_OPEN_DRAWER}
      </Button>
    </div>
  );
}
