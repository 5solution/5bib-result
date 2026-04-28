import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BugReportsService } from './bug-reports.service';
import { CreateBugReportDto } from './dto/create-bug-report.dto';
import { CreateBugReportResponseDto } from './dto/bug-report-response.dto';

@ApiTags('Bug Reports · Public')
@Controller('bug-reports')
export class BugReportsController {
  constructor(private readonly service: BugReportsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a bug report (public, anonymous)',
    description:
      'Rate-limited per IP (5 reports/hour). Returns publicId immediately; honeypot triggers silent reject.',
  })
  @ApiResponse({ status: 201, type: CreateBugReportResponseDto })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async submit(
    @Body() dto: CreateBugReportDto,
    @Req() req: Request,
  ): Promise<CreateBugReportResponseDto> {
    const ip = this.extractIp(req);

    const limit = await this.service.checkAndConsumeRateLimit(ip);
    if (!limit.allowed) {
      throw new HttpException(
        {
          statusCode: 429,
          message: 'Bạn đã báo nhiều lỗi gần đây. Vui lòng thử lại sau.',
          retryAfterSec: limit.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.service.create(dto, ip);
  }

  /**
   * Express's `req.ip` honors the `trust proxy` setting on the app — already
   * configured in main.ts. We never trust raw `X-Forwarded-For` directly to
   * prevent spoofing past the rate-limit guard.
   */
  private extractIp(req: Request): string {
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
