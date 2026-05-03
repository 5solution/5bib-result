import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { RaceResultApiItem } from '../types/race-result-api.types';

/**
 * Phase 0 refactor — shared HTTP layer cho RaceResult Simple API.
 *
 * Chia tách từ `RaceResultService.syncRaceResult` để Timing Alert module
 * (poll engine race day) reuse cùng pattern axios + timeout + error handling
 * mà KHÔNG copy/paste hoặc tự maintain HTTP client riêng.
 *
 * Boundary contract:
 * - INPUT: full URL `https://api.raceresult.com/{eventId}/{token}` (caller
 *   build URL từ config — service KHÔNG biết gì về RR event ID hay key).
 * - OUTPUT: `RaceResultApiItem[]` đã validate là array, KHÔNG parse /
 *   normalize gì khác (status rank "-1", TimingPoint case mixed, vendor
 *   field bugs — tất cả delegate cho consumer).
 * - THROWS: `Error` với message clear cho caller log + retry decision.
 *
 * KHÔNG biết: Mongo, Redis, race_id, course_id, distance, bulkWrite.
 * Pure HTTP fetch + body validation.
 */
@Injectable()
export class RaceResultApiService {
  private readonly logger = new Logger(RaceResultApiService.name);

  /** axios timeout 30s — match value cũ trong `RaceResultService.syncRaceResult`. */
  static readonly DEFAULT_TIMEOUT_MS = 30_000;

  /**
   * Fetch race results array từ 1 RaceResult Simple API endpoint.
   *
   * @param apiUrl URL đầy đủ (caller build sẵn — VD `${baseUrl}/${eventId}/${apiKey}?...`)
   * @param timeoutMs override timeout (default 30s)
   * @returns mảng `RaceResultApiItem` (có thể rỗng nếu race chưa có data)
   * @throws Error nếu network fail / 5xx / response không phải array
   */
  async fetchRaceResults(
    apiUrl: string,
    timeoutMs: number = RaceResultApiService.DEFAULT_TIMEOUT_MS,
  ): Promise<RaceResultApiItem[]> {
    try {
      const response = await axios.get<RaceResultApiItem[]>(apiUrl, {
        timeout: timeoutMs,
      });

      if (!response.data || !Array.isArray(response.data)) {
        this.logger.warn(
          `RR API returned non-array body for ${this.maskUrl(apiUrl)}: typeof=${typeof response.data}`,
        );
        return [];
      }

      return response.data;
    } catch (err) {
      const error = err as AxiosError;
      const status = error.response?.status;
      const message = `RR API fetch failed for ${this.maskUrl(apiUrl)}: ${error.message}${status ? ` (HTTP ${status})` : ''}`;
      this.logger.error(message);
      // Re-throw để caller decide retry / mark sync FAILED.
      throw new Error(message);
    }
  }

  /**
   * Mask API key trong URL trước khi log để tránh leak credentials vào
   * stdout. RR Simple API URL pattern: `/{eventId}/{32-char-token}/...`
   * → replace token với `***`.
   */
  private maskUrl(url: string): string {
    return url.replace(/\/[A-Z0-9]{32}(\/|$|\?)/g, '/***$1');
  }
}
