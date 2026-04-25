import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { LogtoAdminGuard, type AuthenticatedRequest } from 'src/modules/logto-auth';
import {
  ScheduleEmailResponseDto,
  ScheduleEmailRoleSummaryDto,
  SendBulkScheduleEmailResponseDto,
  SendTestResponseDto,
  SendTestScheduleEmailDto,
  UpsertScheduleEmailDto,
} from './dto/schedule-email.dto';
import { TeamScheduleEmailService } from './services/team-schedule-email.service';


@ApiTags('Team Schedule Email')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('team-management/events/:eventId/schedule-emails')
export class TeamScheduleEmailController {
  constructor(private readonly service: TeamScheduleEmailService) {}

  @Get()
  @ApiOperation({
    summary:
      'List every role in the event with its schedule-email config + eligible member count',
  })
  @ApiResponse({ status: 200, type: [ScheduleEmailRoleSummaryDto] })
  list(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ScheduleEmailRoleSummaryDto[]> {
    return this.service.listForEvent(eventId);
  }

  @Get(':roleId')
  @ApiOperation({ summary: 'Get schedule-email config for a single role' })
  @ApiResponse({ status: 200, type: ScheduleEmailResponseDto })
  @ApiResponse({ status: 404, description: 'No config for this role yet' })
  async get(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ): Promise<ScheduleEmailResponseDto> {
    const cfg = await this.service.getForRole(eventId, roleId);
    if (!cfg) {
      throw new NotFoundException(
        'Chưa có cấu hình email lịch trình cho role này',
      );
    }
    return cfg;
  }

  @Put(':roleId')
  @ApiOperation({
    summary: 'Upsert schedule-email config for a role (sanitizes body_html)',
  })
  @ApiResponse({ status: 200, type: ScheduleEmailResponseDto })
  upsert(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() dto: UpsertScheduleEmailDto,
  ): Promise<ScheduleEmailResponseDto> {
    return this.service.upsert(eventId, roleId, dto);
  }

  @Post(':roleId/send-test')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Render with SAMPLE_DATA + role customs and send a single preview email',
  })
  @ApiResponse({ status: 201, type: SendTestResponseDto })
  sendTest(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() dto: SendTestScheduleEmailDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SendTestResponseDto> {
    const adminEmail = req.user?.email ?? '';
    return this.service
      .sendTest(eventId, roleId, dto.test_email, adminEmail)
      .then((r) => ({ sent: r.sent, delivered_to: r.delivered_to }));
  }

  @Post(':roleId/send-bulk')
  // Throttle to 3 req/min per admin — prevents an accidental double-click
  // from spamming the crew with duplicate blasts.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Send the schedule email to every eligible registration in the role',
  })
  @ApiResponse({ status: 201, type: SendBulkScheduleEmailResponseDto })
  sendBulk(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ): Promise<SendBulkScheduleEmailResponseDto> {
    return this.service.sendBulk(eventId, roleId);
  }
}
