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

  /** POST tạo đơn. Trả requestId (202). Throw nếu lỗi. */
  async createRequest(
    payload: CreateIglooRequestPayload,
  ): Promise<IglooCreateResult> {
    const url = `${this.baseUrl}${IGLOO_API.createRequest}`;
    const res = await firstValueFrom(
      this.http.post<{ requestId?: string; id?: string }>(url, payload, {
        headers: this.headers(),
        timeout: 15000,
      }),
    );
    const requestId = res.data?.requestId ?? res.data?.id;
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
      this.http.get<{
        status?: string;
        gicContractNo?: string | null;
        certificateUrl?: string | null;
      }>(url, { headers: this.headers(), timeout: 15000 }),
    );
    return {
      status: res.data?.status ?? 'PENDING',
      gicContractNo: res.data?.gicContractNo ?? null,
      certificateUrl: res.data?.certificateUrl ?? null,
    };
  }
}
