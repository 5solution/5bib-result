import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TimingService } from './timing.service';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import {
  TimingLeadListResponseDto,
  TimingLeadResponseDto,
} from './dto/lead-response.dto';

@ApiTags('Timing (admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/timing/leads')
export class TimingAdminController {
  constructor(private readonly service: TimingService) {}

  @Get()
  @ApiOperation({ summary: 'List timing leads (paginated, filterable)' })
  @ApiOkResponse({ type: TimingLeadListResponseDto })
  async list(@Query() query: ListLeadsQueryDto) {
    return this.service.listLeads(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export leads CSV (up to 10k rows)' })
  async export(@Query() query: ListLeadsQueryDto, @Res() res: Response) {
    const csv = await this.service.exportCsv(query);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="timing-leads-${stamp}.csv"`,
    );
    res.send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single lead' })
  @ApiOkResponse({ type: TimingLeadResponseDto })
  async get(@Param('id') id: string) {
    return this.service.getLead(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead (status / staff_notes / archive)' })
  @ApiOkResponse({ type: TimingLeadResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.service.updateLead(id, dto);
  }
}
