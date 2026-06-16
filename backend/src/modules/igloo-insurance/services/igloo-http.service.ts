import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { env } from '../../../config';
import { IGLOO_API } from '../igloo-insurance.constants';
import { CreateIglooRequestPayload } from '../utils/igloo-helpers';

export interface IglooCreateResult {
  iglooRequestId: string;
}

export interface IglooStatusResult {
  status: string; // PENDING | PROCESSING | GET_CERTI_PROCESSING | SUCCESS | FAILED | CANCELLED
  gicContractNo: string | null;
  certificateUrl: string | null;
}

/**
 * FEATURE-085 — HTTP client gọi Igloo partner API. Header `X-API-Key`.
 * KHÔNG retry tự động (FAILED → admin retry thủ công, BR-IGL-11).
 */
@Injectable()
export class IglooHttpService {
  private readonly logger = new Logger(IglooHttpService.name);

  constructor(private readonly http: HttpService) {}

  private get baseUrl(): string {
    return env.igloo.baseUrl.replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': env.igloo.apiKey,
    };
  }

  /**
   * Igloo bọc response trong envelope `{ success, data: {...} }` (verified
   * PROD 2026-06-16). Đọc `.data` lồng; fallback flat phòng API đổi.
   */
  private unwrap<T extends Record<string, unknown>>(body: unknown): T {
    const b = (body ?? {}) as { data?: T } & T;
    return (b.data ?? b) as T;
  }

  /** POST tạo đơn. Trả requestId (202). Throw nếu lỗi. */
  async createRequest(
    payload: CreateIglooRequestPayload,
  ): Promise<IglooCreateResult> {
    const url = `${this.baseUrl}${IGLOO_API.createRequest}`;
    const res = await firstValueFrom(
      this.http.post(url, payload, {
        headers: this.headers(),
        timeout: 15000,
      }),
    );
    const d = this.unwrap<{ requestId?: string; id?: string }>(res.data);
    const requestId = d.requestId ?? d.id;
    if (!requestId) {
      throw new Error(
        `Igloo createRequest: thiếu requestId trong response (status ${res.status})`,
      );
    }
    return { iglooRequestId: String(requestId) };
  }

  /** GET trạng thái đơn. */
  async getStatus(iglooRequestId: string): Promise<IglooStatusResult> {
    const url = `${this.baseUrl}${IGLOO_API.getRequest(iglooRequestId)}`;
    const res = await firstValueFrom(
      this.http.get(url, { headers: this.headers(), timeout: 15000 }),
    );
    const d = this.unwrap<{
      status?: string;
      gicContractNo?: string | null;
      certificateUrl?: string | null;
    }>(res.data);
    return {
      status: d.status ?? 'PENDING',
      gicContractNo: d.gicContractNo ?? null,
      certificateUrl: d.certificateUrl ?? null,
    };
  }
}
