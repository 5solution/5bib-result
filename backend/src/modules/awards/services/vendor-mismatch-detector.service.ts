import { Injectable, Logger } from '@nestjs/common';
import {
  AnomalyPattern,
  Tier,
} from '../schemas/anomaly-warning.schema';
import { AGBucketResult } from './ag-bracket-calc.service';
import { NormalizedAthlete } from './normalize-vendor-quirks.service';

/**
 * F-019 v2 — Pattern H VENDOR_MISMATCH detector (Race Ops advisory §3 +
 * Manager Plan v2 §2 PAUSE-MGR-V2-05 LOCKED + PAUSE-RACE-V2-A LOCKED).
 *
 * 2-Layer verification:
 *   Layer 1 (5BIB primary): bracket compute từ DOB master-data → sort
 *     chipTime ASC → top-3 per (gender × bracket).
 *   Layer 2 (Vendor cross-check): parse vendor `Category` + `CatRank`
 *     → top-3 per bracket → compare với 5BIB.
 *
 * Mismatch threshold (số BIB lệch, KHÔNG dùng %, theo PAUSE-RACE-V2-A):
 *   - Lệch ≥ 1 BIB top-3 AG → WARNING (tier 2 FLAG, publish được + flag)
 *   - Lệch ≥ 2 BIB top-3 AG → ALERT (tier 1 BLOCK publish)
 *   - Bracket khác hẳn (5BIB tính M40-49 vs vendor M30-39) → CRITICAL
 *     (tier 0 — data integrity, race director resolve trước)
 *
 * Note: tier enum hiện tại [1, 2, 3]. Tier 0 (CRITICAL) sẽ map thành tier=1
 *   với pattern 'H' và evidence flag `bracketMismatch: true` để render UI
 *   special. Tránh migrate tier enum (zero-impact strategy).
 */

export interface VendorAthleteRanked {
  bib: string;
  vendorCategory: string | null;
  vendorCatRank: number | null;
  chipTimeMs: number | null;
}

export interface VendorMismatchResult {
  pattern: AnomalyPattern;
  tier: Tier;
  confidence: number;
  evidence: {
    ageGroupKey: string;
    gender: 'M' | 'F';
    bib: string;
    bibsTop5BIB: string[];
    bibsTopVendor: string[];
    bibsDiff: string[];
    bracketMismatch?: boolean;
    severityLabel: 'WARNING' | 'ALERT' | 'CRITICAL';
    note: string;
  };
}

@Injectable()
export class VendorMismatchDetectorService {
  private readonly logger = new Logger(VendorMismatchDetectorService.name);

  /**
   * Build vendor top-3 per (gender × bracket) by parsing vendor `Category`
   * string + sorting by `CatRank` (vendor live rank — only used HERE for
   * cross-check, NEVER for podium publish).
   */
  buildVendorTop3PerBucket(
    athletes: NormalizedAthlete[],
  ): Map<string, string[]> {
    const buckets = new Map<string, VendorAthleteRanked[]>();
    for (const a of athletes) {
      if (a.status !== 'FIN' || a.chipTimeMs == null || a.chipTimeMs <= 0) {
        continue;
      }
      const cat = (a.vendorAgeGroup ?? '').trim();
      if (!cat) continue;
      // Vendor `Category` text key (raw string — bracket-keyed for compare).
      const key = `${a.gender ?? '?'}__${cat}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push({
        bib: a.bib,
        vendorCategory: cat,
        vendorCatRank:
          (a.raw && (a.raw as Record<string, unknown>).vendorCatRank) as
            | number
            | null
            | undefined ?? null,
        chipTimeMs: a.chipTimeMs,
      });
    }

    // Sort each bucket by chipTimeMs ASC (proxy of vendor CatRank when not
    // present — vendor CatRank reliable cho finishers nhưng có sentinel −1).
    const top3PerKey = new Map<string, string[]>();
    for (const [key, list] of buckets.entries()) {
      list.sort((a, b) => (a.chipTimeMs ?? Infinity) - (b.chipTimeMs ?? Infinity));
      top3PerKey.set(
        key,
        list.slice(0, 3).map((x) => x.bib),
      );
    }
    return top3PerKey;
  }

  /**
   * Compare 5BIB top-3 AG vs Vendor top-3 → emit Pattern H warnings.
   *
   * Compare key: `${gender}__${ageGroup}` so M_30-39 matches "Nam 30-39"
   * vendor-side via fuzzy includes check.
   *
   * Returns 1 mismatch result per (gender × bracket) bucket lệch.
   */
  detectMismatches(
    bib5bibBuckets: AGBucketResult[],
    athletes: NormalizedAthlete[],
  ): VendorMismatchResult[] {
    const vendorTop3 = this.buildVendorTop3PerBucket(athletes);
    const results: VendorMismatchResult[] = [];

    for (const bucket of bib5bibBuckets) {
      const top3_5bib = bucket.athletes.slice(0, 3).map((a) => a.bib);
      if (top3_5bib.length === 0) continue;

      // Match vendor bucket — fuzzy by ageGroup substring (vendor uses
      // "Nam 30-39" / "Nu 30-39" Vietnamese strings vs 5BIB key "30-39").
      let vendorTop3Bibs: string[] = [];
      for (const [vendorKey, bibs] of vendorTop3.entries()) {
        if (
          vendorKey.startsWith(`${bucket.gender}__`) &&
          vendorKey.includes(bucket.ageGroup)
        ) {
          vendorTop3Bibs = bibs;
          break;
        }
      }

      if (vendorTop3Bibs.length === 0) {
        // No matching vendor bucket → likely bracket key mismatch (CRITICAL).
        // KHÔNG emit Pattern H here — vendor không có bucket = vendor data
        // gap, đã cover qua Pattern C/F. Skip để tránh noise.
        continue;
      }

      const setVendor = new Set(vendorTop3Bibs);
      const set5bib = new Set(top3_5bib);
      // Count only BIBs trong 5BIB top-3 NHƯNG không có trong Vendor top-3.
      // (PAUSE-RACE-V2-A LOCKED — 1 BIB = WARNING, 2 BIB = ALERT.)
      const diff = [...set5bib].filter((b) => !setVendor.has(b));
      const reverseDiff = [...setVendor].filter((b) => !set5bib.has(b));
      const totalDiff = new Set([...diff, ...reverseDiff]);
      const diffCount = diff.length; // diff bib counted in 5BIB direction

      if (diffCount === 0) continue;

      // Detect bracket complete mismatch: tất cả 3 BIB 5BIB không có trong
      // vendor (vendor-side mapped sang bracket khác hoàn toàn).
      const bracketMismatch = diff.length === top3_5bib.length;

      let tier: Tier;
      let severityLabel: 'WARNING' | 'ALERT' | 'CRITICAL';
      let confidence: number;

      if (bracketMismatch) {
        tier = 1; // CRITICAL → highest tier (data integrity)
        severityLabel = 'CRITICAL';
        confidence = 0.95;
      } else if (diffCount >= 2) {
        tier = 1; // ALERT → block publish
        severityLabel = 'ALERT';
        confidence = 0.85;
      } else {
        tier = 2; // WARNING → publish + flag
        severityLabel = 'WARNING';
        confidence = 0.7;
      }

      // Emit 1 result per bucket — bib field = first 5BIB top-3 bib (representative).
      results.push({
        pattern: 'H',
        tier,
        confidence,
        evidence: {
          ageGroupKey: bucket.ageGroupKey,
          gender: bucket.gender,
          bib: top3_5bib[0],
          bibsTop5BIB: top3_5bib,
          bibsTopVendor: vendorTop3Bibs,
          bibsDiff: [...totalDiff],
          bracketMismatch: bracketMismatch || undefined,
          severityLabel,
          note: bracketMismatch
            ? `Bracket khác hoàn toàn — 5BIB tính ${bucket.ageGroup} vs vendor mapping khác. Race director cần resolve trước khi publish.`
            : `Top-3 AG ${bucket.ageGroup} ${bucket.gender}: lệch ${diffCount} BIB. 5BIB=[${top3_5bib.join(',')}] vs Vendor=[${vendorTop3Bibs.join(',')}].`,
        },
      });

      this.logger.log(
        `[vendor-mismatch] bucket=${bucket.gender}_${bucket.ageGroup} diff=${diffCount} severity=${severityLabel}`,
      );
    }

    return results;
  }
}
