'use client';

/**
 * F-018 BR-MI-25 — BIB lookup adapted from F-013 `useResultLookup.ts` pattern.
 * NOT extracted to shared lib (Manager judgment — too feature-specific).
 *
 * Inline form variant: input + autocomplete dropdown + denormalize athleteName
 * snapshot at incident-create time (BR-MI-25 — name doesn't change retroactively
 * if athlete DNFs).
 */
import { useEffect, useState } from 'react';
import { raceMasterDataAdminControllerGetAthlete } from '@/lib/api-generated/sdk.gen';

interface BibLookupResult {
  bib: string;
  name: string;
}

interface BibLookupAutocompleteProps {
  raceId: string;
  value: string;
  onChange: (bib: string, athleteName?: string) => void;
}

async function lookupBib(
  raceId: string,
  bib: string,
): Promise<BibLookupResult | null> {
  if (!bib.trim()) return null;
  // Reuse RaceMasterDataService Redis HSET via generated SDK.
  // Endpoint: GET /api/admin/races/{raceId}/master-data/athletes/{bibNumber}
  // Falls back to null (no-throw) for missing/malformed responses.
  const numericRaceId = Number(raceId);
  if (!Number.isFinite(numericRaceId)) return null;
  try {
    const res = await raceMasterDataAdminControllerGetAthlete({
      path: { raceId: numericRaceId, bibNumber: bib },
    });
    if (res.error || !res.data) return null;
    const athlete = res.data;
    const name = athlete.display_name ?? athlete.full_name ?? athlete.bib_name ?? null;
    const bibNumber = athlete.bib_number;
    if (!name || !bibNumber) return null;
    return { bib: bibNumber, name };
  } catch {
    return null;
  }
}

export function BibLookupAutocomplete({
  raceId,
  value,
  onChange,
}: BibLookupAutocompleteProps) {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!value.trim()) {
      setName(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const result = await lookupBib(raceId, value.trim());
      if (!cancelled) {
        setName(result?.name ?? null);
        if (result?.name) onChange(result.bib, result.name);
        setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [raceId, value, onChange]);

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nhập BIB"
        className="w-full rounded border border-stone-300 px-3 py-2 text-base"
      />
      {loading ? (
        <p className="mt-1 text-xs text-stone-500">Đang tra cứu...</p>
      ) : name ? (
        <p className="mt-1 text-xs text-green-700">
          Tìm thấy: <strong>{name}</strong>
        </p>
      ) : value.trim() ? (
        <p className="mt-1 text-xs text-stone-500">
          Không tìm thấy — sẽ lưu BIB nhập tay
        </p>
      ) : null}
    </div>
  );
}
