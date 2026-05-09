'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePredictedRanks } from '../hooks/usePredictedRank';
import { PredictedRankInline } from './PredictedRankInline';

export function PredictedRankList({ raceId }: { raceId: string }) {
  const { data, isLoading } = usePredictedRanks(raceId);
  if (isLoading) return null;
  if (!data || data.items.length === 0) return null;
  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Predicted rank (Pattern A) · {data.total} VĐV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.items.map((it) => (
          <PredictedRankInline key={`${it.bib}-${it.courseId}`} item={it} />
        ))}
      </CardContent>
    </Card>
  );
}
