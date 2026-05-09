#!/usr/bin/env node
/**
 * Generate synthetic stress scenario: 3500 athletes 42KM với pace distribution
 * realistic + ~2% miss rate (70 athletes) random checkpoint miss để stress test
 * timing-alert detection.
 *
 * Output: scenarios/synthetic-3500.json
 *
 * Usage: npx ts-node generate-stress-3500.ts
 */

import * as fs from 'fs';
import * as path from 'path';

type Pace = 'elite' | 'fast' | 'mid' | 'slow';

const CHECKPOINTS_42KM = ['Start', 'TM1', 'TM2', 'TM3', 'Finish'];
const DISTANCES = [0, 10, 21, 32, 42.195];

/** Generate normal-distributed seconds-per-km via Box-Muller */
function randomPaceSecPerKm(profile: Pace): number {
  const profiles: Record<Pace, { mean: number; stdev: number }> = {
    elite: { mean: 250, stdev: 15 }, // 4:10/km marathoner — finish ~2:55
    fast: { mean: 320, stdev: 25 }, // 5:20/km — finish ~3:45
    mid: { mean: 420, stdev: 40 }, // 7:00/km — finish ~5:00
    slow: { mean: 540, stdev: 60 }, // 9:00/km — finish ~6:20
  };
  const cfg = profiles[profile];
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(180, Math.round(cfg.mean + z * cfg.stdev));
}

const AGE_GROUPS = [
  'Nam U18',
  'Nam 18-29',
  'Nam 30-39',
  'Nam 40-49',
  'Nam 50+',
  'Nữ U18',
  'Nữ 18-29',
  'Nữ 30-39',
  'Nữ 40-49',
  'Nữ 50+',
];

function pickAgeGroup(): string {
  // Realistic distribution — most Nam 30-39 + 40-49
  const r = Math.random();
  if (r < 0.25) return 'Nam 30-39';
  if (r < 0.45) return 'Nam 40-49';
  if (r < 0.55) return 'Nam 50+';
  if (r < 0.65) return 'Nam 18-29';
  if (r < 0.75) return 'Nữ 30-39';
  if (r < 0.85) return 'Nữ 40-49';
  if (r < 0.92) return 'Nữ 18-29';
  return AGE_GROUPS[Math.floor(Math.random() * AGE_GROUPS.length)];
}

function pickPaceProfile(): Pace {
  const r = Math.random();
  if (r < 0.005) return 'elite'; // ~0.5%
  if (r < 0.15) return 'fast'; // ~14.5%
  if (r < 0.7) return 'mid'; // ~55%
  return 'slow'; // ~30%
}

const N = 3500;
const MISS_TARGET_RATE = 0.02; // 2%
const missTargets = new Set<number>();
while (missTargets.size < Math.floor(N * MISS_TARGET_RATE)) {
  missTargets.add(Math.floor(Math.random() * N));
}

const athletes: unknown[] = [];

for (let i = 0; i < N; i++) {
  const bib = String(10000 + i);
  const ageGroup = pickAgeGroup();
  const gender = ageGroup.startsWith('Nam') ? 'Male' : 'Female';
  const pace = pickPaceProfile();
  const paceSecPerKm = randomPaceSecPerKm(pace);

  // Compute planned elapsed at each CP
  const plannedElapsed: Record<string, number | null> = {};
  for (let j = 0; j < CHECKPOINTS_42KM.length; j++) {
    plannedElapsed[CHECKPOINTS_42KM[j]] = Math.round(
      paceSecPerKm * DISTANCES[j],
    );
  }

  // 2% athletes miss: random pick checkpoint to "lose" (simulate mat fail)
  if (missTargets.has(i)) {
    // 60% miss Finish (most dangerous case — like BIB 98898)
    // 40% miss intermediate point
    const missFinish = Math.random() < 0.6;
    if (missFinish) {
      plannedElapsed.Finish = null;
    } else {
      const intermediates = ['TM1', 'TM2', 'TM3'];
      const missCp = intermediates[Math.floor(Math.random() * 3)];
      plannedElapsed[missCp] = null;
    }
  }

  athletes.push({
    bib,
    firstname: `R${bib}`,
    lastname: pace === 'elite' ? 'Elite' : pace === 'fast' ? 'Fast' : pace === 'mid' ? 'Mid' : 'Slow',
    contest: '42KM',
    category: ageGroup,
    gender,
    plannedElapsed,
  });
}

const scenario = {
  name: 'Stress 3500 athletes 42KM (~70 misses)',
  description:
    '3500 athletes pace distribution realistic, 2% miss rate (60% miss Finish, 40% miss intermediate). Test BE detection scale + projected rank performance.',
  raceStartIso: '2026-05-15T05:00:00+07:00',
  raceDurationSeconds: 25200, // 7h race window
  courses: {
    '42KM': CHECKPOINTS_42KM,
  },
  athletes,
};

const outPath = path.resolve(__dirname, 'synthetic-3500.json');
fs.writeFileSync(outPath, JSON.stringify(scenario, null, 2));
console.log(
  `Generated ${outPath} — ${athletes.length} athletes, ~${missTargets.size} misses`,
);
