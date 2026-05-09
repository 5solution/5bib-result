'use client';
import { Button } from '@/components/ui/button';
import { usePodiumPdfExport } from '../hooks/usePodiumPdfExport';
import { PDF_BATCH_WARNING_THRESHOLD } from '../awards.constant';
import { VN } from '../awards.microcopy';

interface Props {
  raceId: string;
  podiumId: string;
  totalPodiumsForBatch?: number;
}

export function PodiumPdfExportButton({ raceId, podiumId, totalPodiumsForBatch = 1 }: Props) {
  const mut = usePodiumPdfExport(raceId);
  const showBatchWarning = totalPodiumsForBatch > PDF_BATCH_WARNING_THRESHOLD;
  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={mut.isPending}
        onClick={async () => {
          if (
            showBatchWarning &&
            !confirm(VN.PDF_BATCH_WARNING(totalPodiumsForBatch))
          ) {
            return;
          }
          const r = await mut.mutateAsync({ podiumId });
          if (r.signedUrl) {
            window.open(r.signedUrl, '_blank', 'noopener,noreferrer');
          }
        }}
      >
        {mut.isPending ? VN.TOAST_PDF_GENERATING : VN.EXPORT_PDF_BUTTON}
      </Button>
      {mut.error && (
        <div className="text-xs text-red-700">{(mut.error as Error).message}</div>
      )}
    </div>
  );
}
