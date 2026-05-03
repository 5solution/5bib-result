import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';

export type SseEventName =
  | 'alert.created'
  | 'alert.updated'
  | 'alert.resolved'
  | 'poll.completed'
  | 'poll.failed';

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
    return this.events$.asObservable().pipe(
      filter((e) => e.raceId === raceId),
      map((e, idx) => ({
        type: e.event,
        data: JSON.stringify(e.data),
        id: `${Date.now()}-${idx}`,
      })),
    );
  }
}
