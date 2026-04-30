'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  confirmChipImport,
  importChipMappingsPreview,
  type ImportPreviewResponseDto,
} from '@/lib/chip-verification-api';

interface Props {
  raceId: number;
}

export function CSVImportSection({ raceId }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreviewResponseDto | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);

  const previewMut = useMutation({
    mutationFn: (file: File) => importChipMappingsPreview(raceId, file),
    onSuccess: (data) => {
      setPreview(data);
      setConfirmedCount(null);
    },
    onError: () => {
      setPreview(null);
    },
  });

  const confirmMut = useMutation({
    mutationFn: (previewToken: string) =>
      confirmChipImport(raceId, previewToken),
    onSuccess: (data) => {
      setConfirmedCount(data.imported);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['chip-mappings', raceId] });
      queryClient.invalidateQueries({ queryKey: ['chip-stats', raceId] });
      queryClient.invalidateQueries({ queryKey: ['chip-config', raceId] });
    },
  });

  const onFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Vui lòng chọn file .csv');
      return;
    }
    setConfirmedCount(null);
    previewMut.mutate(file);
  };

  const blockingErrors = preview?.errors ?? [];
  const canConfirm =
    preview !== null && preview.valid > 0 && blockingErrors.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import CSV chip ↔ BIB</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {confirmedCount !== null && (
          <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
            ✅ Đã import {confirmedCount.toLocaleString('vi-VN')} mapping. Cache
            đang patch ngầm — refresh stats để verify.
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <p className="text-sm font-medium">
            Kéo thả file CSV vào đây hoặc
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => fileRef.current?.click()}
            disabled={previewMut.isPending}
          >
            {previewMut.isPending ? 'Đang phân tích...' : 'Chọn file'}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Format: chip_id, bib_number · Tối đa 5,000 dòng · 5MB
          </p>
        </div>

        {previewMut.isError && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {(previewMut.error as Error).message}
          </div>
        )}

        {preview && (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              <Stat label="Total rows" value={preview.totalRows} />
              <Stat label="Valid" value={preview.valid} accent="green" />
              <Stat label="To create" value={preview.toCreate} />
              <Stat label="To update" value={preview.toUpdate} />
              <Stat
                label="Soft-delete swaps"
                value={preview.swapDeletes}
                accent="amber"
              />
            </div>

            {preview.swapDeletes > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                ⚠️ {preview.swapDeletes} mapping cũ sẽ bị soft-delete khi confirm
                vì BIB được reassign sang chip khác. Đây là behavior mong muốn cho
                chip swap workflow.
              </div>
            )}

            {blockingErrors.length > 0 && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3">
                <p className="mb-2 text-sm font-semibold text-red-800">
                  {blockingErrors.length} dòng bị block (phải fix CSV):
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Row</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockingErrors.slice(0, 50).map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{e.row}</TableCell>
                        <TableCell className="text-xs">{e.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {blockingErrors.length > 50 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ...và {blockingErrors.length - 50} lỗi khác
                  </p>
                )}
              </div>
            )}

            {preview.warnings.length > 0 && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3">
                <p className="mb-2 text-sm font-semibold text-yellow-800">
                  {preview.warnings.length} cảnh báo (vẫn import):
                </p>
                <ul className="ml-4 list-disc space-y-1 text-xs">
                  {preview.warnings.slice(0, 30).map((w, i) => (
                    <li key={i}>
                      <span className="font-mono">
                        {w.row > 0 ? `Row ${w.row}: ` : ''}
                      </span>
                      {w.reason}
                    </li>
                  ))}
                  {preview.warnings.length > 30 && (
                    <li className="italic">
                      ...và {preview.warnings.length - 30} cảnh báo khác
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => confirmMut.mutate(preview.previewToken)}
                disabled={!canConfirm || confirmMut.isPending}
              >
                {confirmMut.isPending
                  ? 'Đang import...'
                  : `Confirm import ${preview.valid} mapping`}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreview(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                disabled={confirmMut.isPending}
              >
                Cancel
              </Button>
            </div>

            {confirmMut.isError && (
              <p className="text-sm text-red-600">
                {(confirmMut.error as Error).message}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'green' | 'amber';
}) {
  const color =
    accent === 'green'
      ? 'text-green-700'
      : accent === 'amber'
        ? 'text-amber-700'
        : 'text-foreground';
  return (
    <div className="rounded border bg-background p-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`text-xl font-bold ${color}`}>
        {value.toLocaleString('vi-VN')}
      </p>
    </div>
  );
}
