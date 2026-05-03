import {
  Controller,
  Param,
  ParseIntPipe,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { LogtoAdminGuard } from '../../logto-auth/logto-admin.guard';
import { TimingAlertSseService } from '../services/timing-alert-sse.service';

/**
 * Phase 1C — SSE realtime stream tới admin tab.
 *
 * Pattern Nest `@Sse()` returns Observable<MessageEvent>. Per-race filter
 * thực hiện ở service `subscribe(raceId)` qua RxJS pipe.
 *
 * Memory safety: SSE controller managed bởi Nest framework — khi client
 * disconnect (close tab), Nest unsubscribe Observable tự động → no memory leak.
 *
 * **Auth note:** Logto guard apply per-request. Browser EventSource KHÔNG
 * gửi Authorization header trong native API → admin UI phải gọi qua
 * Server-Sent fetch wrapper hoặc URL với token query param. Phase 2 admin
 * UI sẽ wire properly.
 */
@ApiTags('Timing Alert SSE')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('admin/races/:raceId/timing-alerts')
export class TimingAlertSseController {
  constructor(private readonly sseService: TimingAlertSseService) {}

  @Sse('sse')
  @ApiOperation({
    summary: 'SSE realtime alert stream',
    description:
      'Browser EventSource kết nối → nhận events: alert.created, alert.updated, alert.resolved, poll.completed, poll.failed.',
  })
  stream(
    @Param('raceId', ParseIntPipe) raceId: number,
  ): Observable<{ type: string; data: string; id: string }> {
    return this.sseService.subscribe(raceId);
  }
}
