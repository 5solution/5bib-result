import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { LogtoAdminGuard, type AuthenticatedRequest } from 'src/modules/logto-auth';
import {
  CheckinLookupResponseDto,
  CheckinResponseDto,
  CheckinScanDto,
  CheckinStatsDto,
} from './dto/checkin.dto';
import { TeamCheckinService } from './services/team-checkin.service';


function identifyAdmin(req: AuthenticatedRequest): string {
  return req.user?.username ?? req.user?.email ?? req.user?.sub ?? 'admin';
}

@ApiTags('Team Management — Check-in (staff)')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('team-management/checkin')
export class TeamCheckinController {
  constructor(private readonly checkin: TeamCheckinService) {}

  @Post('scan')
  @ApiOperation({ summary: 'Scan a QR and check the person in' })
  @ApiResponse({ status: 201, type: CheckinResponseDto })
  scan(@Body() dto: CheckinScanDto): Promise<CheckinResponseDto> {
    return this.checkin.scanByQr(dto.qr_code, dto.event_id);
  }

  @Get('lookup')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Fallback lookup by name / phone / CCCD for race-day staff when QR scan fails',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Min 2 chars' })
  @ApiQuery({ name: 'event_id', required: true, type: Number })
  @ApiResponse({ status: 200, type: CheckinLookupResponseDto })
  lookup(
    @Query('q') q: string,
    @Query('event_id') eventIdRaw: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<CheckinLookupResponseDto> {
    const eventId = Number(eventIdRaw);
    if (!Number.isFinite(eventId) || eventId <= 0) {
      throw new BadRequestException('event_id is required');
    }
    return this.checkin.lookup(q ?? '', eventId, identifyAdmin(req));
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
