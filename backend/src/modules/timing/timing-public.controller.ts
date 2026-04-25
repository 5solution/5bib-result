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

@ApiTags('Timing (public)')
@Controller('timing')
export class TimingPublicController {
  constructor(private readonly service: TimingService) {}

  @Post('leads')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } }) // 3 / IP / hour
  @ApiOperation({ summary: 'Submit timing lead (landing form)' })
  @ApiResponse({ status: 200, type: TimingLeadCreateResponseDto })
  @ApiResponse({ status: 429, description: 'Quá nhiều yêu cầu' })
  async createLead(
    @Body() dto: CreateLeadDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<TimingLeadCreateResponseDto> {
    return this.service.createLead(dto, { ip, userAgent: userAgent || '' }, 'timing');
  }
}
