import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';
import { SSE_HEARTBEAT_MS } from '../constants/awards-thresholds';

/**
 * F-019 — Awards SSE broadcaster.
 *
 * Pattern verbatim port từ F-018 MedicalIncidentSseService:
 *  - single global RxJS Subject (per-race filter at subscribe)
 *  - 25s heartbeat keepalive (defeats nginx 60s idle drop)
 *  - cold Observable returned to controller (Nest auto-cleanup on disconnect)
 *
 * Phase 1 NOT wired to controller — admin manual refresh + 60s Redis TTL đủ
 * (Manager Plan §6 confirm). File maintained for Phase 2 readiness — when SSE
 * needed, controller adds `@Sse('stream')` endpoint and DI this service.
 */
export type AwardsSseEventName =
  | 'podium.computed'
  | 'podium.state_changed'
  | 'warning.created'
  | 'warning.acked'
  | 'warning.resolved'
  | 'heartbeat';

export interface AwardsSseEvent {
  event: AwardsSseEventName;
  raceId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class AwardsSseService {
  private readonly logger = new Logger(AwardsSseService.name);
  private readonly events$ = new Subject<AwardsSseEvent>();

  emit(
    event: AwardsSseEventName,
    raceId: string,
    data: Record<string, unknown>,
  ): void {
    this.events$.next({
      event,
      raceId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  subscribe(raceId: string): Observable<{
    type: AwardsSseEventName;
    data: string;
    id: string;
  }> {
    const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(
      map((tick) => ({
        type: 'heartbeat' as AwardsSseEventName,
        data: JSON.stringify({ tick, ts: Date.now() }),
        id: `awards-hb-${Date.now()}-${tick}`,
      })),
    );

    const events$ = this.events$.asObservable().pipe(
      filter((e) => e.raceId === raceId),
      map((e, idx) => ({
        type: e.event,
        data: JSON.stringify(e.data),
        id: `${Date.now()}-${idx}`,
      })),
    );

    return merge(events$, heartbeat$);
  }
}
