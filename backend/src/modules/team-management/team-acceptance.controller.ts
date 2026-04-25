import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoAdminGuard, type AuthenticatedRequest } from 'src/modules/logto-auth';
import {
  DisputeAcceptanceDto,
  SendAcceptanceBatchDto,
  SendAcceptanceBatchResponseDto,
  SendAcceptanceSingleDto,
} from './dto/acceptance.dto';
import { TeamAcceptanceService } from './services/team-acceptance.service';

function actorOf(req: AuthenticatedRequest): string {
  return req.user?.username ?? req.user?.email ?? req.user?.sub ?? 'admin';
}

/**
 * Admin endpoints for the biên bản nghiệm thu workflow. Crew-facing endpoints
 * (view by token, sign, presigned PDF URL) live on TeamRegistrationController
 * under the /public prefix — same pattern as contract signing.
 *
 * All three routes here are admin-gated via LogtoAdminGuard. Guard applies at
 * the class level; every handler inherits it.
 */
@ApiTags('Team Management — Acceptance (admin)')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('team-management')
export class TeamAcceptanceController {
  constructor(private readonly acceptance: TeamAcceptanceService) {}

  @Post('events/:id/acceptance/send-batch')
  @ApiOperation({
    summary:
      'Send biên bản nghiệm thu to a batch of registrations. Eligible regs transition to pending_sign + get an email with the magic link. Ineligible regs surface in skipped[] + skip_reasons[] instead of aborting.',
  })
  @ApiResponse({ status: 201, type: SendAcceptanceBatchResponseDto })
  sendBatch(
    @Param('id', ParseIntPipe) eventId: number,
    @Body() dto: SendAcceptanceBatchDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SendAcceptanceBatchResponseDto> {
    return this.acceptance.sendAcceptanceBatch(eventId, dto, actorOf(req));
  }

  @Post('registrations/:id/acceptance/send')
  @ApiOperation({
    summary:
      'Send biên bản nghiệm thu for a single registration. Throws 400 with the specific ineligibility reason if the reg is not eligible (wrong status, missing Bên B fields, etc).',
  })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
  })
  async sendOne(
    @Param('id', ParseIntPipe) regId: number,
    @Body() dto: SendAcceptanceSingleDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true }> {
    await this.acceptance.sendAcceptanceForRegistration(
      regId,
      dto?.acceptance_value,
      dto?.template_id,
      actorOf(req),
    );
    return { success: true };
  }

  @Patch('registrations/:id/acceptance/dispute')
  @ApiOperation({
    summary:
      'Admin marks an acceptance as disputed with a reason. Works from pending_sign or signed. Admin must re-send to unblock crew re-signing.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
  })
  async dispute(
    @Param('id', ParseIntPipe) regId: number,
    @Body() dto: DisputeAcceptanceDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true }> {
    await this.acceptance.markDisputed(regId, dto.reason, actorOf(req));
    return { success: true };
  }
}
