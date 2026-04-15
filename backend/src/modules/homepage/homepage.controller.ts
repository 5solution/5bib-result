import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { HomepageService } from './homepage.service';
import {
  EndedRacesResponseDto,
  HomepageSummaryResponseDto,
} from './dto/homepage-summary.dto';
import { EndedRacesQueryDto } from './dto/ended-races-query.dto';

@ApiTags('homepage')
@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Homepage summary — stats + live/upcoming/ended(page 1) races',
    description:
      'Public endpoint. Cached via Redis (TTL 300s). Use X-Cache response header to verify HIT/MISS.',
  })
  @ApiOkResponse({ type: HomepageSummaryResponseDto })
  async getSummary(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HomepageSummaryResponseDto> {
    const { data, cache } = await this.homepageService.getSummary();
    res.setHeader('X-Cache', cache);
    return { data, success: true, cache };
  }

  @Get('ended')
  @ApiOperation({
    summary: 'Paginated ended races for homepage "Xem thêm" button',
    description:
      'Public endpoint. Cached per-page via Redis (TTL 120s). Default limit 9.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 9 })
  @ApiOkResponse({ type: EndedRacesResponseDto })
  async getEndedRaces(
    @Query() query: EndedRacesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EndedRacesResponseDto> {
    const { data, cache } = await this.homepageService.getEndedRacesPage(
      query.page ?? 1,
      query.limit ?? 9,
    );
    res.setHeader('X-Cache', cache);
    return { data, success: true, cache };
  }
}
