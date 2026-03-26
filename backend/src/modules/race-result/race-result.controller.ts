import { Controller, Get, Post, Query, Param, Body } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { GetRaceResultsDto } from './dto/get-race-results.dto';
import { SubmitClaimDto } from './dto/submit-claim.dto';
import { RaceResultService } from './services/race-result.service';

@ApiTags('Race Results')
@Controller('race-results')
export class RaceResultController {
  constructor(private readonly raceResultService: RaceResultService) {}

  @Get('distances')
  @ApiOperation({ summary: 'Get available race distances/types' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of available race distances',
  })
  async getRaceDistances() {
    return this.raceResultService.getRaceDistances();
  }

  @Get()
  @ApiOperation({ summary: 'Get race results with filters and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated race results',
  })
  async getRaceResults(@Query() dto: GetRaceResultsDto) {
    return this.raceResultService.getRaceResults(dto);
  }

  @Get('leaderboard/:courseId')
  @ApiOperation({ summary: 'Get top N results for a course' })
  @ApiParam({ name: 'courseId', type: 'string', description: 'Course ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of top results (default 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns top results for the course',
  })
  async getLeaderboard(
    @Param('courseId') courseId: string,
    @Query('limit') limit?: number,
  ) {
    return this.raceResultService.getLeaderboard(courseId, limit || 10);
  }

  @Get('athlete/:raceId/:bib')
  @ApiOperation({ summary: 'Get athlete detail by race and bib' })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'bib', type: 'string', description: 'Bib number' })
  @ApiResponse({
    status: 200,
    description: 'Returns athlete result detail with splits',
  })
  async getAthleteDetail(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
  ) {
    const result = await this.raceResultService.getAthleteDetail(raceId, bib);
    if (!result) {
      return { data: null, success: false, message: 'Athlete not found' };
    }
    return { data: result, success: true };
  }

  @Get('compare/:raceId')
  @ApiOperation({ summary: 'Compare multiple athletes by bibs' })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiQuery({
    name: 'bibs',
    type: String,
    description: 'Comma-separated bib numbers',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns results for multiple athletes',
  })
  async compareAthletes(
    @Param('raceId') raceId: string,
    @Query('bibs') bibs: string,
  ) {
    const bibList = bibs ? bibs.split(',').map((b) => b.trim()) : [];
    const results = await this.raceResultService.compareAthletes(
      raceId,
      bibList,
    );
    return { data: results, success: true };
  }

  @Get('stats/:courseId')
  @ApiOperation({ summary: 'Get aggregated course stats (avg time, finishers, etc.)' })
  @ApiParam({ name: 'courseId', type: 'string', description: 'Course ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns aggregated stats for the course',
  })
  async getCourseStats(@Param('courseId') courseId: string) {
    const stats = await this.raceResultService.getCourseStats(courseId);
    return { data: stats, success: true };
  }

  @Post('claims')
  @ApiOperation({ summary: 'Submit a result claim' })
  @ApiResponse({ status: 201, description: 'Claim created' })
  async submitClaim(@Body() dto: SubmitClaimDto) {
    return this.raceResultService.submitClaim(dto);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Manually trigger race results sync' })
  @ApiResponse({
    status: 200,
    description: 'Sync completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Sync completed successfully',
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Sync failed' })
  async manualSync() {
    await this.raceResultService.syncAllRaceResults();
    return {
      message: 'Sync completed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
