import { Injectable } from '@nestjs/common';
import { NormalizedAthlete } from './normalize-vendor-quirks.service';

/**
 * F-019 v2 — Independent ranking service (5BIB Official Race Referee).
 *
 * 5BIB tự sort + tự rank athletes — KHÔNG trust vendor `OverallRank`
 * (xem advisory v2 §1: vendor RaceResult `OverallRank: -1` sentinels +
 * vendor live rank ≠ final rank tại Boston Marathon 2014 + Comrades 2018).
 *
 * Logic:
 *  1. Filter `status === 'FIN'` (chỉ finishers — DSQ/DNF/CUT excluded).
 *  2. Filter `chipTimeMs > 0` (loại sentinel "00:00" / null).
 *  3. Sort `chipTimeMs ASC`.
 *  4. Assign rank 1-N (skip rank cho ex-aequo theo WA TR25).
 *
 * Tie-breaker (theo WA TR25):
 *   1. chipTimeMs ASC
 *   2. gunTimeMs ASC
 *   3. bibNumber ASC (numeric prefer, fallback string locale)
 */
export interface IndependentRanked {
  bib: string;
  name?: string;
  gender: 'M' | 'F' | null;
  rank5bib: number;
  chipTimeMs: number;
  gunTimeMs: number | null;
  vendorOverallRank?: number | null;
  /** True khi athlete tied (cùng chipTimeMs + gunTimeMs với athlete khác). */
  tied: boolean;
}

@Injectable()
export class IndependentRankingService {
  /**
   * Compute independent overall rank cho 1 course.
   *
   * Bypass vendor `OverallRank` hoàn toàn — 5BIB tự rank.
   * Vendor rank chỉ stash vào output cho VendorMismatchDetector compare.
   */
  rankCourse(
    athletes: NormalizedAthlete[],
    options: { vendorRanks?: Map<string, number | null> } = {},
  ): IndependentRanked[] {
    const eligible = athletes.filter(
      (a) =>
        a.status === 'FIN' &&
        a.chipTimeMs != null &&
        a.chipTimeMs > 0,
    );

    eligible.sort((a, b) => {
      const ct = (a.chipTimeMs ?? Infinity) - (b.chipTimeMs ?? Infinity);
      if (ct !== 0) return ct;
      const gt = (a.gunTimeMs ?? Infinity) - (b.gunTimeMs ?? Infinity);
      if (gt !== 0) return gt;
      const bibA = parseInt(a.bib, 10);
      const bibB = parseInt(b.bib, 10);
      if (!Number.isNaN(bibA) && !Number.isNaN(bibB)) return bibA - bibB;
      return a.bib.localeCompare(b.bib);
    });

    const ranked: IndependentRanked[] = [];
    let currentRank = 0;
    let lastTieKey: string | null = null;

    for (let i = 0; i < eligible.length; i++) {
      const a = eligible[i];
      const tieKey = `${a.chipTimeMs}-${a.gunTimeMs ?? ''}`;
      if (tieKey !== lastTieKey) {
        currentRank = i + 1;
        lastTieKey = tieKey;
      }
      ranked.push({
        bib: a.bib,
        name: a.name,
        gender: a.gender,
        rank5bib: currentRank,
        chipTimeMs: a.chipTimeMs!,
        gunTimeMs: a.gunTimeMs,
        vendorOverallRank: options.vendorRanks?.get(a.bib) ?? null,
        tied: false,
      });
    }

    // Back-fill `tied` flag.
    for (let i = 1; i < ranked.length; i++) {
      if (ranked[i].rank5bib === ranked[i - 1].rank5bib) {
        ranked[i].tied = true;
        ranked[i - 1].tied = true;
      }
    }

    return ranked;
  }

  /**
   * Filter ranked output by gender.
   * Used cho per-gender AG bracket compute.
   */
  filterByGender(
    ranked: IndependentRanked[],
    gender: 'M' | 'F',
  ): IndependentRanked[] {
    return ranked.filter((r) => r.gender === gender);
  }
}
