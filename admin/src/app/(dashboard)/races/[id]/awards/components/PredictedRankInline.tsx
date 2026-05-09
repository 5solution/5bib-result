'use client';
import { Badge } from '@/components/ui/badge';
import type { PredictedRankItem } from '../awards.types';
import { VN } from '../awards.microcopy';

export function PredictedRankInline({ item }: { item: PredictedRankItem }) {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs">
      <div className="font-semibold text-blue-800">
        {VN.PREDICTED_RANK_BANNER(item.predictedRank, `${item.gender === 'M' ? 'Nam' : 'Nữ'} ${item.ageGroup}`)}
      </div>
      <div className="mt-1 text-blue-700">
        BIB {item.bib} · {item.name ?? '?'} · estFinish {Math.round(item.estimatedFinishSec / 60)} phút
      </div>
      <div className="mt-1 text-stone-600">
        {VN.PREDICTED_RANK_ERROR_NOTE(item.errorMarginMin)}
      </div>
      <div className="mt-1">
        <Badge variant="outline" className="border-blue-300 bg-white text-blue-800">
          confidence {item.confidence.toFixed(2)}
        </Badge>
      </div>
    </div>
  );
}
