// POST /leads/5solution — lead capture for the 5Solution umbrella landing
// (5solution.vn). Source is HARD-CODED server-side; clients cannot inject it.
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Ip,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TimingService } from './timing.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { TimingLeadCreateResponseDto } from './dto/lead-response.dto';

@ApiTags('5Solution Umbrella (public)')
@Controller('leads')
export class Solution5PublicController {
  constructor(private readonly service: TimingService) {}

  /**
   * Public lead capture for 5solution.vn — phone required, organization optional.
   * Throttle: 1 lead / IP / 60s + 5 leads / IP / 1h (the lower of the two
   * applies because module-level guard already enforces 100/min globally).
   */
  @Post('5solution')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @ApiOperation({
    summary: 'Submit 5Solution umbrella lead (5solution.vn form)',
  })
  @ApiResponse({ status: 200, type: TimingLeadCreateResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 429, description: 'Quá nhiều yêu cầu' })
  async createLead(
    @Body() dto: CreateLeadDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<TimingLeadCreateResponseDto> {
    // Source is fixed — never trust dto.* for source assignment.
    return this.service.createLead(
      dto,
      { ip, userAgent: userAgent || '' },
      '5solution-umbrella',
    );
  }
}
