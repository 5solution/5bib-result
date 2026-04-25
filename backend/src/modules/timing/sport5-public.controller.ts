// POST /5sport/leads — lead capture for solution.5sport.vn landing page
// Single endpoint with track switch in body → routes to source '5sport-btc' | '5sport-athlete'
import {
  BadRequestException,
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
import { TimingLeadSource } from './schemas/timing-lead.schema';

@ApiTags('5Sport (public)')
@Controller('5sport')
export class Sport5PublicController {
  constructor(private readonly service: TimingService) {}

  @Post('leads')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Submit 5Sport lead (solution.5sport.vn form)' })
  @ApiResponse({ status: 200, type: TimingLeadCreateResponseDto })
  @ApiResponse({ status: 429, description: 'Quá nhiều yêu cầu' })
  async createLead(
    @Body() dto: CreateLeadDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<TimingLeadCreateResponseDto> {
    const track = dto.track;
    if (track !== '5sport-btc' && track !== '5sport-athlete') {
      throw new BadRequestException('track must be 5sport-btc or 5sport-athlete');
    }
    const source: TimingLeadSource = track;
    return this.service.createLead(
      dto,
      { ip, userAgent: userAgent || '' },
      source,
    );
  }
}
