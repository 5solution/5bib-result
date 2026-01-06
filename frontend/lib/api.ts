import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface RaceResult {
  Bib: number;
  Name: string;
  OverallRank: string;
  GenderRank: string;
  CatRank: string;
  Gender: string;
  Category: string;
  ChipTime: string;
  GunTime: string;
  Pace: string;
  Gap: string;
  Nationality: string;
  Nation: string;
  Certificate: string;
  race_id: number;
  course_id: string;
  distance: string;
  synced_at: string;
}

export interface Pagination {
  pageNo: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RaceResultsResponse {
  data: RaceResult[];
  pagination: Pagination;
}

export interface RaceResultsParams {
  course_id?: string;
  name?: string;
  gender?: string;
  category?: string;
  pageNo?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface RaceDistance {
  race_id: number;
  distance: string;
  course_id: string;
}

export const raceResultsApi = {
  async getDistances(): Promise<RaceDistance[]> {
    const response = await axios.get<RaceDistance[]>(
      `${API_BASE_URL}/api/race-results/distances`
    );
    return response.data;
  },

  async getResults(params: RaceResultsParams = {}): Promise<RaceResultsResponse> {
    const response = await axios.get<RaceResultsResponse>(
      `${API_BASE_URL}/api/race-results`,
      { params }
    );
    return response.data;
  },

  async syncResults(): Promise<{ message: string; timestamp: string }> {
    const response = await axios.post(`${API_BASE_URL}/api/race-results/sync`);
    return response.data;
  },
};
