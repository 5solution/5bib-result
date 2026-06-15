/**
 * FEATURE-085 — Igloo Insurance admin API wrapper.
 *
 * Mirrors the F-083 `landing-api.ts` / F-068 `course-data-ops-api.ts` pattern:
 * hand-typed thin wrappers over the runtime `/api/*` proxy + a named
 * `InsuranceApiError`. SDK regen (`pnpm --filter admin generate:api`) to be run
 * against the backend on :8081 in the QC phase; until then these typed wrappers
 * are the contract.
 */

export interface IglooConfig {
  dailyEnabled: boolean;
  submitEnabled: boolean;
  dailyCount: number;
}

export interface IglooRace {
  mysqlRaceId: number;
  title: string | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  raceType: string | null;
}

export interface EligibleAthlete {
  athletesId: number;
  fullName: string;
  bib: string | null;
  gender: string;
  dateOfBirth: string | null;
  idCard: string;
  phone: string;
  email: string;
  hasOrder: boolean;
}

export interface EligibleAthleteList {
  items: EligibleAthlete[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IglooRequest {
  id: string;
  status: string;
  packageCode: string;
  insuredName: string;
  insuredIdCard: string;
  bib: string | null;
  raceTitle: string | null;
  mysqlRaceId: number;
  totalPayment: number;
  source: string;
  gicContractNo: string | null;
  certificateUrl: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
}

export interface IglooRequestList {
  items: IglooRequest[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateRequestsResult {
  created: number;
  skipped: Array<{
    athletesId: number;
    reason: "ALREADY_HAS_ORDER" | "NOT_ELIGIBLE";
  }>;
  totalPremium: number;
}

export class InsuranceApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "InsuranceApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let code: string | undefined;
    let message = `Lỗi ${res.status}`;
    try {
      const body = (await res.json()) as {
        message?: string | string[];
        code?: string;
      };
      code = body.code;
      if (typeof body.message === "string") message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(", ");
    } catch {
      /* non-JSON error body */
    }
    throw new InsuranceApiError(res.status, message, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const qs = (params: Record<string, string | number | undefined>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export function getIglooConfig(): Promise<IglooConfig> {
  return request<IglooConfig>("/igloo-insurance/config");
}

export function listIglooRaces(): Promise<IglooRace[]> {
  return request<IglooRace[]>("/igloo-insurance/races");
}

export function listEligibleAthletes(params: {
  raceId: number;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<EligibleAthleteList> {
  return request<EligibleAthleteList>(
    `/igloo-insurance/eligible-athletes${qs(params)}`,
  );
}

export function createIglooRequests(body: {
  raceId: number;
  athleteIds: number[];
}): Promise<CreateRequestsResult> {
  return request<CreateRequestsResult>("/igloo-insurance/requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listIglooRequests(params: {
  status?: string;
  raceId?: number;
  page?: number;
  pageSize?: number;
}): Promise<IglooRequestList> {
  return request<IglooRequestList>(`/igloo-insurance/requests${qs(params)}`);
}

export function retryIglooRequest(id: string): Promise<IglooRequest> {
  return request<IglooRequest>(`/igloo-insurance/requests/${id}/retry`, {
    method: "POST",
  });
}
