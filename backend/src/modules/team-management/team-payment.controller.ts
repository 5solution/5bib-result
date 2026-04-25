import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  ParseIntPipe,
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
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ForcePaidDto, MarkPaidResponseDto } from './dto/payment.dto';
import { TeamPaymentService } from './services/team-payment.service';

interface JwtRequest extends Request {
  user?: {
    username?: string;
    email?: string;
    sub?: string;
    role?: string;
  };
}

function actorOf(req: JwtRequest): string {
  return req.user?.username ?? req.user?.email ?? req.user?.sub ?? 'admin';
}

/**
 * Canonical payment-status-transition API. All three routes go through
 * TeamPaymentService which enforces the acceptance-signed gate for the
 * standard mark-paid path.
 *
 * Routes:
 *   POST /registrations/:id/payment/mark-paid   — 409 if acceptance unsigned
 *   POST /registrations/:id/payment/force-paid  — escape hatch, 10-char reason
 *   POST /registrations/:id/payment/revert      — paid → pending, clears audit
 *
 * Legacy PATCH /registrations/:id accepting payment_status='paid' is blocked
 * at the service layer (see TeamRegistrationService.updateRegistration) —
 * admins must come through these routes to flip to paid.
 */
@ApiTags('Team Management — Payment (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team-management/registrations')
export class TeamPaymentController {
  constructor(private readonly payment: TeamPaymentService) {}

  @Post(':id/payment/mark-paid')
  @ApiOperation({
    summary:
      'Standard mark-paid. Requires acceptance_status=signed (else 409 with prompt to sign or use force-paid). Rejects 400 when suspicious_checkin is set. Idempotent: re-call on a paid row returns the current state.',
  })
  @ApiResponse({ status: 201, type: MarkPaidResponseDto })
  markPaid(
    @Param('id', ParseIntPipe) regId: number,
    @Req() req: JwtRequest,
  ): Promise<MarkPaidResponseDto> {
    return this.payment.markPaid(regId, actorOf(req));
  }

  @Post(':id/payment/force-paid')
  @ApiOperation({
    summary:
      'Force-paid escape hatch — bypasses the signed-acceptance gate. Requires force_reason (≥10 chars), persisted to vol_registration + emitted as PAYMENT_FORCE_PAID audit log line. Still blocks on suspicious_checkin.',
  })
  @ApiResponse({ status: 201, type: MarkPaidResponseDto })
  forcePaid(
    @Param('id', ParseIntPipe) regId: number,
    @Body() dto: ForcePaidDto,
    @Req() req: JwtRequest,
  ): Promise<MarkPaidResponseDto> {
    // Defense in depth: force-paid bypasses the signed-acceptance gate, so
    // only admins may call it. JwtAuthGuard alone would let any valid crew
    // token hit this route.
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException(
        'Chỉ admin mới có quyền force-paid (bỏ qua gate biên bản nghiệm thu).',
      );
    }
    return this.payment.forcePaid(regId, dto.force_reason, actorOf(req));
  }

  @Post(':id/payment/revert')
  @ApiOperation({
    summary:
      'Revert paid → pending. Clears all three force-paid audit columns so a later mark-paid via the standard gate starts fresh. Rare — use when admin discovered a clerical mistake.',
  })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
  })
  async revert(
    @Param('id', ParseIntPipe) regId: number,
    @Req() req: JwtRequest,
  ): Promise<{ success: true }> {
    await this.payment.revertPaid(regId, actorOf(req));
    return { success: true };
  }
}
