import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetRaceResultsDto } from './dto/get-race-results.dto';
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

  @Post('sync')
  @ApiOperation({ summary: 'Manually trigger race results sync' })
  @ApiResponse({
    status: 200,
    description: 'Sync completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Sync completed successfully' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Sync failed',
  })
  async manualSync() {
    await this.raceResultService.syncAllRaceResults();
    return {
      message: 'Sync completed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
