/**
 * Admin SDK wrapper cho Timing Alert Simulator.
 */
import { client } from './api-generated/client.gen';

export type SimulationStatus = 'created' | 'running' | 'paused' | 'completed';

export type ScenarioType =
  | 'MISS_FINISH'
  | 'MISS_MIDDLE_CP'
  | 'MISS_START'
  | 'MAT_FAILURE'
  | 'TOP_N_MISS_FINISH'
  | 'LATE_FINISHER'
  | 'PHANTOM_RUNNER';

export interface SimulationScenario {
  id: string;
  type: ScenarioType;
  enabled: boolean;
  count: number;
  checkpointKey?: string;
  topN?: number;
  shiftMinutes?: number;
  scopeSimCourseId?: string;
  description?: string;
}

export interface CreateScenarioInput {
  type: ScenarioType;
  enabled?: boolean;
  count: number;
  checkpointKey?: string;
  topN?: number;
  shiftMinutes?: number;
  scopeSimCourseId?: string;
  description?: string;
}

export interface UpdateScenarioInput {
  enabled?: boolean;
  count?: number;
  checkpointKey?: string;
  topN?: number;
  shiftMinutes?: number;
  scopeSimCourseId?: string;
  description?: string;
}

export interface SimulationCourse {
  simCourseId: string;
  label: string;
  sourceUrl: string;
  snapshotFetchedAt: string | null;
  snapshotItems: number;
  earliestSeconds: number | null;
  latestSeconds: number | null;
  publicUrl: string;
}

export interface Simulation {
  id: string;
  name: string;
  description: string | null;
  speedFactor: number;
  startOffsetSeconds: number;
  status: SimulationStatus;
  startedAt: string | null;
  pausedAt: string | null;
  accumulatedSeconds: number;
  currentSimSeconds: number;
  courses: SimulationCourse[];
  scenarios: SimulationScenario[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSimulationInput {
  name: string;
  description?: string;
  speedFactor?: number;
  startOffsetSeconds?: number;
  courses: Array<{ label: string; sourceUrl: string }>;
}

export interface UpdateSimulationInput {
  name?: string;
  description?: string;
  speedFactor?: number;
  startOffsetSeconds?: number;
}

async function clientGet<T>(url: string): Promise<T> {
  const res = await client.get({ url });
  if (res.error) throw new Error(extractError(res.error, res.response?.status));
  if (!res.data) throw new Error('Empty response');
  return res.data as T;
}

async function clientPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await client.post({ url, body });
  if (res.error) throw new Error(extractError(res.error, res.response?.status));
  if (!res.data) throw new Error('Empty response');
  return res.data as T;
}

async function clientPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await client.patch({ url, body });
  if (res.error) throw new Error(extractError(res.error, res.response?.status));
  if (!res.data) throw new Error('Empty response');
  return res.data as T;
}

async function clientDelete<T>(url: string): Promise<T> {
  const res = await client.delete({ url });
  if (res.error) throw new Error(extractError(res.error, res.response?.status));
  return (res.data ?? { deleted: true }) as T;
}

const BASE = '/api/admin/timing-alert/simulator';

export const simulatorApi = {
  list: () => clientGet<Simulation[]>(BASE),
  get: (id: string) => clientGet<Simulation>(`${BASE}/${id}`),
  create: (input: CreateSimulationInput) => clientPost<Simulation>(BASE, input),
  update: (id: string, patch: UpdateSimulationInput) =>
    clientPatch<Simulation>(`${BASE}/${id}`, patch),
  delete: (id: string) =>
    clientDelete<{ deleted: boolean }>(`${BASE}/${id}`),
  refreshSnapshot: (id: string, simCourseId: string) =>
    clientPost<{ items: number; earliestSeconds: number | null; latestSeconds: number | null }>(
      `${BASE}/${id}/refresh-snapshot/${simCourseId}`,
    ),
  play: (id: string) => clientPost<Simulation>(`${BASE}/${id}/play`),
  pause: (id: string) => clientPost<Simulation>(`${BASE}/${id}/pause`),
  reset: (id: string) => clientPost<Simulation>(`${BASE}/${id}/reset`),
  seek: (id: string, seconds: number) =>
    clientPost<Simulation>(`${BASE}/${id}/seek`, { seconds }),
  addScenario: (id: string, input: CreateScenarioInput) =>
    clientPost<Simulation>(`${BASE}/${id}/scenarios`, input),
  updateScenario: (id: string, scenarioId: string, patch: UpdateScenarioInput) =>
    clientPatch<Simulation>(`${BASE}/${id}/scenarios/${scenarioId}`, patch),
  deleteScenario: (id: string, scenarioId: string) =>
    clientDelete<Simulation>(`${BASE}/${id}/scenarios/${scenarioId}`),
};

export const SCENARIO_LABELS: Record<ScenarioType, { label: string; description: string }> = {
  MISS_FINISH: {
    label: 'VĐV miss vạch đích',
    description: 'N athletes random bị mất time Finish — fire alerts severity = HIGH/CRITICAL nếu trong projected Top N',
  },
  MISS_MIDDLE_CP: {
    label: 'VĐV miss checkpoint giữa',
    description: 'N athletes random bị mất 1 checkpoint giữa course (TM1/TM2/...)',
  },
  MISS_START: {
    label: 'VĐV miss vạch xuất phát',
    description: 'N athletes random bị mất time Start (rare edge case, sequence broken)',
  },
  MAT_FAILURE: {
    label: 'Mat failure (đầu đọc lỗi)',
    description: 'N athletes liên tiếp mất time tại 1 checkpoint cụ thể — test mat anomaly detection (drop > 30%)',
  },
  TOP_N_MISS_FINISH: {
    label: 'Top N miss vạch đích',
    description: 'Top N athletes chạy nhanh nhất bị drop Finish → force CRITICAL alerts (severity dựa Top N projection)',
  },
  LATE_FINISHER: {
    label: 'Athletes về đích muộn',
    description: 'N athletes có Finish nhưng dời thời gian +X phút → test overdue threshold',
  },
  PHANTOM_RUNNER: {
    label: 'Phantom runner (mất Start)',
    description: 'N athletes có time tại TM1+ nhưng KHÔNG có Start → data sequence broken',
  },
};

function extractError(err: unknown, status?: number): string {
  if (status === 401) return 'Token không hợp lệ';
  if (status === 404) return '404 not found';
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return status ? `HTTP ${status}` : 'Request failed';
}
