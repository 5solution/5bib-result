import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';

export type SseEventName =
  | 'alert.created'
  | 'alert.updated'
  | 'alert.resolved'
  | 'poll.completed'
  | 'poll.failed'
  | 'race.reset'
  | 'heartbeat';

export interface SseEvent {
  event: SseEventName;
  /** race_id để filter per-race subscribers */
  raceId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Phase 1C — SSE realtime push service.
 *
 * Single global RxJS Subject — all subscribers (admin tabs) listen, filter
 * by `raceId` ở controller side trước khi push xuống browser EventSource.
 *
 * **Memory safety:** RxJS Subject KHÔNG buffer. Subscriber pipe `filter +
 * map` clean lên-xuống mỗi connection. Controller PHẢI `subscribe.unsubscribe()`
 * khi client disconnect — handled bằng `Observable.takeUntil(disconnect$)`.
 */
@Injectable()
export class TimingAlertSseService {
  private readonly logger = new Logger(TimingAlertSseService.name);
  private readonly events$ = new Subject<SseEvent>();

  /**
   * Emit event tới tất cả subscriber. Per-race filter chạy ở pipeline reader.
   */
  emit(event: SseEventName, raceId: string, data: Record<string, unknown>): void {
    const payload: SseEvent = {
      event,
      raceId,
      data,
      timestamp: new Date().toISOString(),
    };
    this.events$.next(payload);
  }

  /**
   * Subscribe filtered stream cho 1 race. Controller wrap qua `Sse()` decorator
   * → return MessageEvent observable.
   *
   * RxJS pipeline:
   *   1. `filter` keep events khớp raceId
   *   2. `map` shape sang Nest MessageEvent format
   *
   * Returns cold Observable — re-subscribed mỗi SSE connection (safe).
   */
  subscribe(raceId: string): Observable<{
    type: SseEventName;
    data: string;
    id: string;
  }> {
    // Heartbeat mỗi 25s — chống proxy/load balancer drop idle connection.
    // Next.js dev server + nginx default idle timeout ~60s. Heartbeat <
    // timeout đảm bảo SSE stream stay alive khi không có alert events.
    const heartbeat$ = interval(25_000).pipe(
      map((tick) => ({
        type: 'heartbeat' as SseEventName,
        data: JSON.stringify({ tick, ts: Date.now() }),
        id: `hb-${Date.now()}-${tick}`,
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
