export interface RaceResult {
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
}

export interface RaceResultDocument extends RaceResult {
  race_id: number;
  course_id: string;
  distance: string;
  synced_at: Date;
}

export interface RaceConfig {
  race_id: number;
  distance: string;
  course_id: string;
  api_url: string;
}
