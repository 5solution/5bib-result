import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';

/**
 * F-018 BR-MI-35 — Race Director SSE realtime alerts.
 *
 * Reuses F-005/F-017 SSE pattern verbatim:
 *  - single global RxJS Subject
 *  - per-race filter at subscribe time
 *  - 25s heartbeat keepalive (defeats nginx 60s idle drop)
 *  - cold Observable returned to controller (Nest auto-cleanup on disconnect)
 *
 * Memory safety: Subject does NOT buffer; subscriber pipe `filter+map`
 * is constructed fresh per EventSource connection. When the client closes
 * the tab, Nest unsubscribes the Observable → no leak.
 */
export type MedicalSseEventName =
  | 'incident.created'
  | 'incident.updated'
  | 'incident.state_changed'
  | 'incident.severity_escalated'
  | 'heartbeat';

export interface MedicalSseEvent {
  event: MedicalSseEventName;
  raceId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class MedicalIncidentSseService {
  private readonly logger = new Logger(MedicalIncidentSseService.name);
  private readonly events$ = new Subject<MedicalSseEvent>();

  emit(
    event: MedicalSseEventName,
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
    type: MedicalSseEventName;
    data: string;
    id: string;
  }> {
    const heartbeat$ = interval(25_000).pipe(
      map((tick) => ({
        type: 'heartbeat' as MedicalSseEventName,
        data: JSON.stringify({ tick, ts: Date.now() }),
        id: `mhb-${Date.now()}-${tick}`,
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
