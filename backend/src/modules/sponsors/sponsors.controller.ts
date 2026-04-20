import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { SponsorsService } from './sponsors.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { ClerkAdminGuard } from '../clerk-auth';

@ApiTags('Sponsors')
@Controller('sponsors')
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  // ─── Public ──────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all active global sponsors (public)' })
  @ApiResponse({
    status: 200,
    description: 'Returns active global sponsors sorted by level then order',
  })
  async findAllActive() {
    return this.sponsorsService.findAllActive();
  }

  @Get('race/:raceId')
  @ApiOperation({ summary: 'List active sponsors for a specific race (public)' })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns active race-specific sponsors',
  })
  async findByRaceId(@Param('raceId') raceId: string) {
    return this.sponsorsService.findByRaceId(raceId);
  }

  // ─── Admin ───────────────────────────────────────────────────

  @Get('all')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(ClerkAdminGuard)
  @ApiOperation({ summary: 'List all sponsors including inactive (admin)' })
  @ApiResponse({ status: 200, description: 'Returns all sponsors' })
  async findAll() {
    return this.sponsorsService.findAll();
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(ClerkAdminGuard)
  @ApiOperation({ summary: 'Create a new sponsor (admin)' })
  @ApiResponse({ status: 201, description: 'Sponsor created' })
  async create(@Body() dto: CreateSponsorDto) {
    return this.sponsorsService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(ClerkAdminGuard)
  @ApiOperation({ summary: 'Update a sponsor (admin)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Sponsor updated' })
  @ApiResponse({ status: 404, description: 'Sponsor not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateSponsorDto) {
    return this.sponsorsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(ClerkAdminGuard)
  @ApiOperation({ summary: 'Soft delete a sponsor (admin)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Sponsor deactivated' })
  @ApiResponse({ status: 404, description: 'Sponsor not found' })
  async remove(@Param('id') id: string) {
    return this.sponsorsService.softDelete(id);
  }
}
