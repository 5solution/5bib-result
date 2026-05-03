#!/usr/bin/env node
/**
 * Timing Miss Alert — RaceResult API Simulator
 *
 * Standalone HTTP server mô phỏng RaceResult Simple API endpoint.
 * Cho phép test Timing Alert system end-to-end mà KHÔNG cần real race ongoing.
 *
 * Usage:
 *   npx ts-node backend/scripts/timing-alert-simulator/simulator.ts \
 *     --scenario=scenarios/synthetic-3500.json \
 *     --speed=60 \
 *     --port=8090
 *
 *   # Sau đó set BE env:
 *   #   RACERESULT_API_BASE_URL=http://localhost:8090
 *   # POST timing-alert config với rr_event_id="sim-event"
 *   # rr_api_keys.{course}=ANYTHING (sim ignores key, chỉ check event ID + course)
 *
 * Speedup factor:
 *   --speed=1   → real-time (1s sim = 1s wall-clock) — long test
 *   --speed=60  → 1 phút sim = 1 giây wall-clock — quick smoke (3h race ≈ 3 phút)
 *   --speed=600 → 10 phút sim = 1 giây — stress test alerts trigger nhanh
 *
 * Scenario JSON shape: xem `scenarios/_schema.md`.
 *
 * KHÔNG dùng cho production. Standalone chạy bên cạnh BE dev (port khác).
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';

// ─────────── Types ───────────

interface PlannedAthlete {
  bib: string;
  firstname?: string;
  lastname?: string;
  name?: string;
  contest: string;
  category: string; // age group "Nam 40-49"
  gender: string;
  /**
   * Map checkpoint key → planned elapsed seconds from race start.
   * VD: { Start: 0, TM1: 3000, TM2: 7200, Finish: 16200 }
   * Athlete sẽ "xuất hiện" tại checkpoint khi simTime ≥ planned elapsed.
   *
   * Đặt giá trị `null` cho 1 checkpoint = athlete miss point đó (mat fail
   * hoặc DNF). Scenario "BIB 98898" set Finish=null → simulator KHÔNG đẩy
   * Finish vào Chiptimes JSON → BE timing-alert flag CRITICAL.
   */
  plannedElapsed: Record<string, number | null>;
}

interface Scenario {
  /** Scenario name + description */
  name: string;
  description: string;
  /** Race day start ISO (sim t=0). Real time hoặc fake. */
  raceStartIso: string;
  /** Total race duration seconds — sim sẽ tự stop sau khoảng này. */
  raceDurationSeconds: number;
  /** Map course_name → ordered checkpoint keys */
  courses: Record<string, string[]>;
  /** Athletes list */
  athletes: PlannedAthlete[];
}

interface SimState {
  scenario: Scenario;
  startWallClockMs: number;
  speedFactor: number;
  /** Sim seconds elapsed = (now - startWallClock) * speedFactor */
  getSimSeconds(): number;
  isRaceEnded(): boolean;
}

// ─────────── Args parsing ───────────

function parseArgs(): { scenario: string; speed: number; port: number } {
  const args = process.argv.slice(2);
  const get = (key: string, fallback?: string): string | undefined => {
    const arg = args.find((a) => a.startsWith(`--${key}=`));
    if (arg) return arg.split('=')[1];
    return fallback;
  };
  const scenario = get('scenario');
  if (!scenario) {
    console.error(
      'Missing --scenario=path. Try --scenario=scenarios/synthetic-3500.json',
    );
    process.exit(1);
  }
  return {
    scenario,
    speed: Number(get('speed', '60')),
    port: Number(get('port', '8090')),
  };
}

// ─────────── Scenario loader ───────────

function loadScenario(scenarioPath: string): Scenario {
  // Try resolve cả từ cwd (cli convenience) lẫn từ __dirname (sub-folder
  // shorthand). Path absolute → dùng nguyên xi.
  const candidates = path.isAbsolute(scenarioPath)
    ? [scenarioPath]
    : [
        path.resolve(process.cwd(), scenarioPath),
        path.resolve(__dirname, scenarioPath),
        path.resolve(__dirname, 'scenarios', path.basename(scenarioPath)),
      ];
  const absPath = candidates.find((p) => fs.existsSync(p));
  if (!absPath) {
    throw new Error(
      `Scenario not found. Tried: ${candidates.join(', ')}`,
    );
  }
  const raw = fs.readFileSync(absPath, 'utf8');
  const scenario = JSON.parse(raw) as Scenario;

  // Validation
  if (!scenario.athletes || scenario.athletes.length === 0) {
    throw new Error(`Scenario ${absPath}: athletes empty`);
  }
  if (!scenario.courses || Object.keys(scenario.courses).length === 0) {
    throw new Error(`Scenario ${absPath}: courses empty`);
  }
  return scenario;
}

// ─────────── RR API response shape ───────────

/**
 * Build RR Simple API response cho 1 course tại 1 thời điểm sim.
 *
 * Mỗi athlete:
 * - Filter những checkpoint planned elapsed ≤ simSeconds (đã "qua" point đó)
 * - null planned → KHÔNG bao giờ xuất hiện trong Chiptimes (= miss)
 * - Build Chiptimes JSON string giống real RR API format
 * - Format time elapsed → "HH:MM:SS"
 */
function buildRrResponse(
  state: SimState,
  courseName: string,
): unknown[] {
  const simSeconds = state.getSimSeconds();
  const athletes = state.scenario.athletes.filter(
    (a) => a.contest === courseName,
  );
  const courseCheckpoints = state.scenario.courses[courseName] ?? [];

  return athletes.map((athlete) => {
    const chiptimes: Record<string, string> = {};
    let lastSeenPoint = '';
    let overallRank = -1;

    for (const cpKey of courseCheckpoints) {
      const planned = athlete.plannedElapsed[cpKey];
      if (planned === null || planned === undefined) {
        // null = athlete MISS this point (DNF / mat failure)
        chiptimes[cpKey] = '';
        continue;
      }
      if (simSeconds >= planned) {
        chiptimes[cpKey] = secondsToHms(planned);
        lastSeenPoint = cpKey;
        // Mock overall rank: 1-based by planned finish time within course
        // (simplified — real RR has more nuance)
      } else {
        chiptimes[cpKey] = '';
      }
    }

    // Compute overall rank — count athletes có planned Finish ≤ this athlete's Finish
    const myFinish = athlete.plannedElapsed.Finish;
    if (myFinish !== null && myFinish !== undefined && simSeconds >= myFinish) {
      overallRank = athletes.filter((other) => {
        const o = other.plannedElapsed.Finish;
        return o !== null && o !== undefined && o > 0 && o < myFinish;
      }).length + 1;
    }

    return {
      Bib: parseInt(athlete.bib, 10) || 0,
      Name:
        athlete.name ??
        `${athlete.firstname ?? ''} ${athlete.lastname ?? ''}`.trim(),
      Firstname: athlete.firstname ?? '',
      Lastname: athlete.lastname ?? '',
      Contest: athlete.contest,
      Category: athlete.category,
      Gender: athlete.gender,
      OverallRank: overallRank,
      GenderRank: -1,
      CatRank: -1,
      ChipTime: chiptimes.Finish || '',
      GunTime: chiptimes.Finish || '',
      TimingPoint: lastSeenPoint || 'Start',
      Pace: '',
      Certi: '',
      Certificate: '',
      OverallRanks: '{}',
      GenderRanks: '{}',
      Chiptimes: JSON.stringify(chiptimes),
      Guntimes: JSON.stringify(chiptimes),
      Paces: '{}',
      TODs: '{}',
      Sectors: '{}',
      OverrankLive: -1,
      Gap: '',
      Nationality: 'VN',
      Nation: 'Vietnam',
    };
  });
}

function secondsToHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────── HTTP server ───────────

function startServer(state: SimState, port: number): void {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Sim-Seconds', String(state.getSimSeconds()));
    res.setHeader('X-Sim-Speed', String(state.speedFactor));

    // Pattern RR Simple API: /{eventId}/{apiKey}[?course=X]
    // Hoặc /sim/course/{course} cho test convenience
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (url.pathname === '/sim/status') {
      // Debug endpoint — sim state JSON
      res.writeHead(200);
      res.end(
        JSON.stringify(
          {
            scenario: state.scenario.name,
            description: state.scenario.description,
            sim_seconds: state.getSimSeconds(),
            sim_seconds_hms: secondsToHms(state.getSimSeconds()),
            race_duration: state.scenario.raceDurationSeconds,
            speed_factor: state.speedFactor,
            ended: state.isRaceEnded(),
            courses: Object.keys(state.scenario.courses),
            total_athletes: state.scenario.athletes.length,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (url.pathname === '/sim/reset') {
      // Reset sim clock to 0
      (state as { startWallClockMs: number }).startWallClockMs = Date.now();
      res.writeHead(200);
      res.end(JSON.stringify({ reset: true, sim_seconds: 0 }));
      return;
    }

    // RR Simple API pattern: /{eventId}/{apiKey}[?course=X]
    // Course resolution priority:
    //   1. ?course=X query param (explicit)
    //   2. Last path segment matching course name
    //   3. Single course scenario → auto-pick that one (convenience cho test)
    const courseFromQuery = url.searchParams.get('course');
    const courseFromPath = pathParts[pathParts.length - 1] ?? '';
    const availableCourses = Object.keys(state.scenario.courses);

    let courseName = '';
    if (courseFromQuery && state.scenario.courses[courseFromQuery]) {
      courseName = courseFromQuery;
    } else if (state.scenario.courses[courseFromPath]) {
      courseName = courseFromPath;
    } else if (availableCourses.length === 1) {
      // Convenience: BE poll service builds URL như `/eventId/apiKey` —
      // KHÔNG có ?course query. Nếu scenario có 1 course duy nhất, auto pick.
      courseName = availableCourses[0];
    }

    if (!courseName) {
      res.writeHead(404);
      res.end(
        JSON.stringify({
          error: `No course resolved. Path=${url.pathname}, query.course=${courseFromQuery}. Available: ${availableCourses.join(', ')}`,
        }),
      );
      return;
    }

    const response = buildRrResponse(state, courseName);
    res.writeHead(200);
    res.end(JSON.stringify(response));
  });

  server.listen(port, () => {
    console.log(`\n🎮 Timing Alert Simulator listening on port ${port}`);
    console.log(`   Scenario: ${state.scenario.name}`);
    console.log(`   ${state.scenario.description}`);
    console.log(
      `   Speed: ${state.speedFactor}x (race ${secondsToHms(state.scenario.raceDurationSeconds)} → wall-clock ${secondsToHms(state.scenario.raceDurationSeconds / state.speedFactor)})`,
    );
    console.log(`\nUsage:`);
    console.log(`   GET http://localhost:${port}/sim/status — sim state`);
    console.log(`   POST http://localhost:${port}/sim/reset — reset clock`);
    console.log(
      `   GET http://localhost:${port}/sim-event/sim-key?course=42KM — RR API mock`,
    );
    console.log(`\nBE env override:`);
    console.log(`   RACERESULT_API_BASE_URL=http://localhost:${port}`);
    console.log(
      `\nTimer:\n   sim_seconds will tick from 0 → ${state.scenario.raceDurationSeconds}`,
    );

    // Periodic console log
    setInterval(() => {
      const sec = state.getSimSeconds();
      if (state.isRaceEnded()) {
        console.log(
          `[sim] race ENDED at sim ${secondsToHms(state.scenario.raceDurationSeconds)} (clamping)`,
        );
        return;
      }
      const finishedAthletes = state.scenario.athletes.filter((a) => {
        const f = a.plannedElapsed.Finish;
        return f !== null && f !== undefined && sec >= f;
      }).length;
      console.log(
        `[sim] simTime=${secondsToHms(sec)} finished=${finishedAthletes}/${state.scenario.athletes.length}`,
      );
    }, 5000);
  });
}

// ─────────── Main ───────────

function main(): void {
  const args = parseArgs();
  const scenario = loadScenario(args.scenario);

  const startWallClockMs = Date.now();
  const state: SimState = {
    scenario,
    startWallClockMs,
    speedFactor: args.speed,
    getSimSeconds() {
      const wallElapsedMs = Date.now() - this.startWallClockMs;
      const sim = (wallElapsedMs / 1000) * this.speedFactor;
      // Clamp to race duration
      return Math.min(sim, scenario.raceDurationSeconds);
    },
    isRaceEnded() {
      return this.getSimSeconds() >= scenario.raceDurationSeconds;
    },
  };

  startServer(state, args.port);
}

main();
