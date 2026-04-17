import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import {
  CheckinResponseDto,
  CheckinScanDto,
  CheckinStatsDto,
} from './dto/checkin.dto';
import { TeamCheckinService } from './services/team-checkin.service';

@ApiTags('Team Management — Check-in (staff)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team-management/checkin')
export class TeamCheckinController {
  constructor(private readonly checkin: TeamCheckinService) {}

  @Post('scan')
  @ApiOperation({ summary: 'Scan a QR and check the person in' })
  @ApiResponse({ status: 201, type: CheckinResponseDto })
  scan(@Body() dto: CheckinScanDto): Promise<CheckinResponseDto> {
    return this.checkin.scanByQr(dto.qr_code, dto.event_id);
  }

  @Get('stats/:eventId')
  @ApiOperation({ summary: 'Realtime check-in stats for an event' })
  @ApiResponse({ status: 200, type: CheckinStatsDto })
  stats(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<CheckinStatsDto> {
    return this.checkin.statsForEvent(eventId);
  }
}
