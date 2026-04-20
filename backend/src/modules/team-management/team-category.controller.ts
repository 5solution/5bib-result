import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ClerkAdminGuard } from 'src/modules/clerk-auth';
import {
  CreateTeamCategoryDto,
  TeamCategoryDto,
  UpdateTeamCategoryDto,
} from './dto/team-category.dto';
import { TeamCategoryService } from './services/team-category.service';

// v1.8: Team (category) CRUD. Teams are the grouping unit above roles —
// a Team contains Leader/Crew/TNV roles + owns stations + supply plans.
@ApiTags('Team Management (team categories)')
@ApiBearerAuth()
@UseGuards(ClerkAdminGuard)
@Controller('team-management')
export class TeamCategoryController {
  constructor(private readonly categories: TeamCategoryService) {}

  @Get('events/:eventId/team-categories')
  @ApiOperation({ summary: 'List all Teams (categories) of an event' })
  @ApiResponse({ status: 200, type: [TeamCategoryDto] })
  list(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<TeamCategoryDto[]> {
    return this.categories.list(eventId);
  }

  @Post('events/:eventId/team-categories')
  @ApiOperation({ summary: 'Create a Team (category) under an event' })
  @ApiResponse({ status: 201, type: TeamCategoryDto })
  create(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: CreateTeamCategoryDto,
  ): Promise<TeamCategoryDto> {
    return this.categories.create(eventId, dto);
  }

  @Get('team-categories/:id')
  @ApiOperation({ summary: 'Get a Team (category) detail + counts' })
  @ApiResponse({ status: 200, type: TeamCategoryDto })
  getById(@Param('id', ParseIntPipe) id: number): Promise<TeamCategoryDto> {
    return this.categories.getById(id);
  }

  @Patch('team-categories/:id')
  @ApiOperation({ summary: 'Update a Team (category)' })
  @ApiResponse({ status: 200, type: TeamCategoryDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeamCategoryDto,
  ): Promise<TeamCategoryDto> {
    return this.categories.update(id, dto);
  }

  @Delete('team-categories/:id')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Delete a Team (category). 409 nếu còn trạm hoặc supply-plan attached. Roles thuộc team tự unlink (SET NULL).',
  })
  @ApiResponse({ status: 204 })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.categories.remove(id);
  }
}
