import { Body, Controller, Ip, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  RequestRecoverOtpDto,
  RequestRecoverOtpResponseDto,
  VerifyRecoverOtpDto,
  VerifyRecoverOtpResponseDto,
} from './dto/recover.dto';
import { TeamRecoverService } from './services/team-recover.service';

/**
 * Public magic-link recovery endpoints. Used by the crew UI's /recover page
 * when a TNV has lost the original magic-link email.
 *
 * Layered defence:
 * 1. `@Throttle` — NestJS rate limiter, per-IP coarse gate (5 req/min).
 * 2. Cloudflare Turnstile — blocks most bots before our service logic runs.
 * 3. Per-email + per-IP app-level counter in Redis (3/hour + 10/hour).
 * 4. OTP attempt ceiling — 5 wrong guesses burns the code.
 * 5. Anti-enumeration — 200 OK even if email doesn't exist.
 * 6. Audit log — every request/verify emits a structured log line.
 */
@ApiTags('Team Management (public)')
@Controller('public/recover')
export class TeamRecoverController {
  constructor(private readonly recover: TeamRecoverService) {}

  @Post('request')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Request an OTP to recover the magic link. Always returns 200 — does not confirm whether the email exists.',
  })
  @ApiResponse({ status: 200, type: RequestRecoverOtpResponseDto })
  request(
    @Body() dto: RequestRecoverOtpDto,
    @Ip() ip: string,
  ): Promise<RequestRecoverOtpResponseDto> {
    return this.recover.requestOtp(dto.email, ip, dto.turnstile_token);
  }

  @Post('verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Verify OTP and return all active registrations with their magic links.',
  })
  @ApiResponse({ status: 200, type: VerifyRecoverOtpResponseDto })
  verify(@Body() dto: VerifyRecoverOtpDto): Promise<VerifyRecoverOtpResponseDto> {
    return this.recover.verifyOtp(dto.email, dto.otp);
  }
}
