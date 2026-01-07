import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { RacesService } from './races.service';
import { SearchRacesDto } from './dto/search-races.dto';

@ApiTags('Races')
@Controller('races')
export class RacesController {
  constructor(private readonly racesService: RacesService) {}

  @Get()
  @ApiOperation({
    summary: 'Search and list races with filters and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of races',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            totalPages: { type: 'number', example: 5 },
            currentPage: { type: 'number', example: 0 },
            totalItems: { type: 'number', example: 42 },
            list: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
        success: { type: 'boolean', example: true },
      },
    },
  })
  async searchRaces(@Query() dto: SearchRacesDto) {
    return this.racesService.searchRaces(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get race by ID' })
  @ApiParam({ name: 'id', type: 'number', description: 'Race ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns race details with courses and ticket types',
  })
  @ApiResponse({
    status: 404,
    description: 'Race not found',
  })
  async getRaceById(@Param('id', ParseIntPipe) id: number) {
    return this.racesService.getRaceById(id);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get race by product ID' })
  @ApiParam({ name: 'productId', type: 'number', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns race details with courses and ticket types',
  })
  @ApiResponse({
    status: 404,
    description: 'Race not found',
  })
  async getRaceByProductId(
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.racesService.getRaceByProductId(productId);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Manually sync races from source API' })
  @ApiResponse({
    status: 200,
    description: 'Sync completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Successfully synced 10 races' },
        count: { type: 'number', example: 10 },
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Sync failed',
  })
  async syncRaces() {
    return this.racesService.syncRacesFromSource();
  }
}
