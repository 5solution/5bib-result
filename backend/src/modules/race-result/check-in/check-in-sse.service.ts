import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';
import { CheckInSseEventDto } from './dto/check-in-stats.dto';

export type CheckInSseEventName = 'pickup' | 'heartbeat';

interface InternalEvent {
  event: CheckInSseEventName;
  raceId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * F-015 BR-CK-08 — SSE pub/sub for check-in events.
 *
 * Pattern reuse: F-005 `timing-alert-sse.service.ts` (one global RxJS Subject;
 * subscribers filter by raceId at controller subscribe time).
 *
 * Memory safety: `Subject` does NOT buffer. Per-connection observable is cold
 * (re-subscribed each EventSource). Heartbeat every 25s prevents proxy idle
 * timeout drop (matches F-005 cadence).
 */
@Injectable()
export class CheckInSseService {
  private readonly events$ = new Subject<InternalEvent>();

  /**
   * Emit a pickup event from the atomic check-in mutation. Per-race filter
   * happens in the consumer pipeline.
   */
  emitPickup(raceId: string, data: Record<string, unknown>): void {
    this.events$.next({
      event: 'pickup',
      raceId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Subscribe filtered stream for one race. Returned shape is consumed by
   * NestJS `@Sse()` decorator → MessageEvent.
   */
  subscribe(raceId: string): Observable<{
    type: CheckInSseEventName;
    data: string;
    id: string;
  }> {
    const heartbeat$ = interval(25_000).pipe(
      map((tick) => ({
        type: 'heartbeat' as CheckInSseEventName,
        data: JSON.stringify({ tick, ts: Date.now(), type: 'heartbeat' }),
        id: `hb-${Date.now()}-${tick}`,
      })),
    );

    const events$ = this.events$.asObservable().pipe(
      filter((e) => e.raceId === raceId),
      map((e, idx) => {
        const payload: CheckInSseEventDto = {
          type: e.event,
          ...(e.data as Partial<CheckInSseEventDto>),
        };
        return {
          type: e.event,
          data: JSON.stringify(payload),
          id: `${Date.now()}-${idx}`,
        };
      }),
    );

    return merge(events$, heartbeat$);
  }
}
