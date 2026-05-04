import { Controller, Get, Param, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SimulatorService } from '../services/simulator.service';
import { RaceResultApiItem } from '../../race-result/types/race-result-api.types';

/**
 * Public endpoint để timing-alert poll service hit như là RR API thật.
 *
 * **Security model:**
 * - KHÔNG có auth header (poll service hit URL trực tiếp, match RR Simple API)
 * - 32-char hex `simCourseId` token serves as access control (unguessable)
 * - Read-only — endpoint không expose admin meta (status, speedFactor)
 *
 * **Response:** RR Simple API JSON array format (RaceResultApiItem[]).
 * Chiptimes được filter theo simulation clock hiện tại — pretend là RR
 * đang truyền data live.
 *
 * **Path đặc biệt:** `/api/timing-alert/simulator-data/{simCourseId}` —
 * không có path collision với RR (RR pattern `/{eventId}/{token}` không
 * có prefix `/api/timing-alert/`).
 */
@ApiTags('Timing Alert Simulator (Public)')
@Controller('timing-alert/simulator-data')
export class TimingAlertSimulatorPublicController {
  constructor(private readonly simulator: SimulatorService) {}

  @Get(':simCourseId')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'application/json; charset=utf-8')
  @ApiOperation({
    summary:
      'Serve filtered RR JSON array — paste URL này vào course.apiUrl của race test',
    description:
      'Trả `[]` nếu simCourseId không tồn tại (match vendor pattern khi event chưa có data). Filter Chiptimes theo simulation clock — chỉ giữ checkpoint times ≤ T hiện tại.',
  })
  async serve(
    @Param('simCourseId') simCourseId: string,
  ): Promise<RaceResultApiItem[]> {
    return this.simulator.serve(simCourseId);
  }
}
