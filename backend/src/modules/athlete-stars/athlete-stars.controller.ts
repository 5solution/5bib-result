import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ClerkAuthGuard, CurrentUser, type ClerkUser } from '../clerk-auth';
import { AthleteStarsService } from './athlete-stars.service';
import { StarAthleteDto } from './dto/star-athlete.dto';
import {
  AthleteStarListResponseDto,
  AthleteStarResponseDto,
  ListStarsQueryDto,
} from './dto/list-stars.dto';

@ApiTags('athlete-stars')
@Controller('athlete-stars')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('Clerk')
export class AthleteStarsController {
  constructor(private readonly service: AthleteStarsService) {}

  @Post()
  @ApiOperation({ summary: 'Star an athlete (idempotent upsert)' })
  @ApiResponse({ status: 201, type: AthleteStarResponseDto })
  async star(@CurrentUser() user: ClerkUser, @Body() dto: StarAthleteDto) {
    const data = await this.service.star(
      user.clerkId,
      dto.raceId,
      dto.courseId,
      dto.bib,
    );
    return { data };
  }

  @Delete()
  @ApiOperation({ summary: 'Unstar an athlete' })
  @ApiResponse({ status: 200, description: '{ deleted: boolean }' })
  async unstar(@CurrentUser() user: ClerkUser, @Body() dto: StarAthleteDto) {
    return this.service.unstar(
      user.clerkId,
      dto.raceId,
      dto.courseId,
      dto.bib,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all starred athletes of current user' })
  @ApiResponse({ status: 200, type: AthleteStarListResponseDto })
  async list(
    @CurrentUser() user: ClerkUser,
    @Query() query: ListStarsQueryDto,
  ) {
    return this.service.list(
      user.clerkId,
      query.pageNo || 1,
      query.pageSize || 20,
    );
  }

  @Get('by-course')
  @ApiOperation({
    summary: 'List starred bibs in a course (for ranking page UI marking)',
  })
  @ApiResponse({
    status: 200,
    description: '{ data: string[] }',
  })
  async byCourse(
    @CurrentUser() user: ClerkUser,
    @Query('raceId') raceId: string,
    @Query('courseId') courseId: string,
  ) {
    const data = await this.service.listByCourse(
      user.clerkId,
      raceId,
      courseId,
    );
    return { data };
  }
}
