import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RacesService } from './races.service';
import { SearchRacesDto } from './dto/search-races.dto';
import { CreateRaceDto } from './dto/create-race.dto';
import { UpdateRaceDto } from './dto/update-race.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AddCourseDto } from './dto/add-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Races')
@Controller('races')
export class RacesController {
  constructor(private readonly racesService: RacesService) {}

  // ─── Search / Read ────────────────────────────────────────────

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
            list: { type: 'array', items: { type: 'object' } },
          },
        },
        success: { type: 'boolean', example: true },
      },
    },
  })
  async searchRaces(@Query() dto: SearchRacesDto) {
    return this.racesService.searchRaces(dto);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get race by slug (SEO-friendly)' })
  @ApiParam({ name: 'slug', type: 'string', description: 'Race slug' })
  @ApiResponse({ status: 200, description: 'Returns race details' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async getRaceBySlug(@Param('slug') slug: string) {
    return this.racesService.getRaceBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get race by ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Race ID (MongoDB ObjectId)',
  })
  @ApiResponse({ status: 200, description: 'Returns race details with courses' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async getRaceById(@Param('id') id: string) {
    return this.racesService.getRaceById(id);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get race by product ID' })
  @ApiParam({
    name: 'productId',
    type: 'string',
    description: 'Product ID',
  })
  @ApiResponse({ status: 200, description: 'Returns race details with courses' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async getRaceByProductId(@Param('productId') productId: string) {
    return this.racesService.getRaceByProductId(productId);
  }

  // ─── Admin CRUD ───────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @ApiOperation({ summary: 'Create a new race (admin)' })
  @ApiResponse({ status: 201, description: 'Race created' })
  async createRace(@Body() dto: CreateRaceDto) {
    return this.racesService.createRace(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a race (admin)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Race updated' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async updateRace(@Param('id') id: string, @Body() dto: UpdateRaceDto) {
    return this.racesService.updateRace(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a race (admin)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Race deleted' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async deleteRace(@Param('id') id: string) {
    return this.racesService.deleteRace(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update race lifecycle status (admin)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.racesService.updateStatus(id, dto);
  }

  // ─── Course management ────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post(':id/courses')
  @ApiOperation({ summary: 'Add a course to a race (admin)' })
  @ApiParam({ name: 'id', type: 'string', description: 'Race ID' })
  @ApiResponse({ status: 201, description: 'Course added' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async addCourse(@Param('id') id: string, @Body() dto: AddCourseDto) {
    return this.racesService.addCourse(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch(':id/courses/:courseId')
  @ApiOperation({ summary: 'Update a course in a race (admin)' })
  @ApiParam({ name: 'id', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'courseId', type: 'string', description: 'Course ID' })
  @ApiResponse({ status: 200, description: 'Course updated' })
  @ApiResponse({ status: 404, description: 'Race or course not found' })
  async updateCourse(
    @Param('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.racesService.updateCourse(id, courseId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':id/courses/:courseId')
  @ApiOperation({ summary: 'Remove a course from a race (admin)' })
  @ApiParam({ name: 'id', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'courseId', type: 'string', description: 'Course ID' })
  @ApiResponse({ status: 200, description: 'Course removed' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async removeCourse(
    @Param('id') id: string,
    @Param('courseId') courseId: string,
  ) {
    return this.racesService.removeCourse(id, courseId);
  }

  // ─── Sync ─────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @ApiResponse({ status: 500, description: 'Sync failed' })
  async syncRaces() {
    return this.racesService.syncRacesFromSource();
  }
}
