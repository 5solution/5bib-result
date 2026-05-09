/**
 * RaceResult Simple API response item shape.
 *
 * Extracted from `race-result.service.ts` inline interface (Phase 0 refactor)
 * để share giữa race-result + timing-alert modules. Cả 2 đều consume cùng
 * 1 RaceResult API endpoint.
 *
 * Vendor format đã observed (xem CLAUDE.md "Vendor RaceResult.com Quirks"):
 * - `TimingPoint` case mixed (5KM = "Finish", 10/21/42KM = "FINISH")
 * - Live `OverallRank` được vendor đẩy tại checkpoint, KHÔNG chỉ Finish
 * - Root `Pace` field unreliable cho finishers — must compute từ chipTime/distance
 * - "-1" sentinel cho rank chưa đạt
 * - `Bib` có thể = 0 → fallback parse từ Certificate URL
 *
 * KHÔNG THÊM field mới ở đây nếu RR vendor không trả — extend sang
 * derived shape trong service consumer thay vì pollute interface upstream.
 */
export interface RaceResultApiItem {
  Bib: number;
  Name: string;
  OverallRank: number;
  GenderRank: number;
  CatRank: number;
  Gender: string;
  Category: string;
  ChipTime: string;
  GunTime: string;
  TimingPoint: string;
  Pace: string;
  Certi: string;
  Certificate: string;
  OverallRanks: string;
  GenderRanks: string;
  Chiptimes: string;
  Guntimes: string;
  Paces: string;
  TODs: string;
  Sectors: string;
  OverrankLive: number;
  Gap: string;
  Nationality: string;
  Nation: string;
  Member?: string;
  Started?: number;
  Finished?: number;
  DNF?: number;
  // Optional extra fields RR pushes inconsistently — Timing Alert dùng
  // Firstname/Lastname (RR Simple API trả 1 trong 2 hoặc cả 2):
  Firstname?: string;
  Lastname?: string;
  Contest?: string;
}
