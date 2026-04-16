import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { OpsJwtAuthGuard } from '../common/guards/ops-jwt-auth.guard';
import { OpsRoleGuard } from '../common/guards/ops-role.guard';
import { OpsRoles } from '../common/decorators/ops-roles.decorator';
import { OpsUserCtx } from '../common/decorators/ops-user.decorator';
import { OpsUserContext } from '../common/types/ops-jwt-payload.type';
import { TeamsService } from './teams.service';
import {
  AssignLeaderDto,
  CreateTeamDto,
  TeamListResponseDto,
  TeamResponseDto,
  UpdateTeamDto,
} from './dto/team.dto';

@ApiTags('race-ops/teams')
@Controller('race-ops/admin/events/:eventId/teams')
@UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
@ApiBearerAuth()
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @OpsRoles('ops_admin')
  @ApiOperation({ summary: 'Tạo team mới trong event' })
  @ApiCreatedResponse({ type: TeamResponseDto })
  create(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Body() dto: CreateTeamDto,
    @Req() req: Request,
  ): Promise<TeamResponseDto> {
    return this.teamsService.create(
      user.tenant_id,
      eventId,
      user.userId,
      dto,
      req,
    );
  }

  @Get()
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Danh sách teams của event' })
  @ApiOkResponse({ type: TeamListResponseDto })
  list(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
  ): Promise<TeamListResponseDto> {
    return this.teamsService.list(user.tenant_id, eventId);
  }

  @Get(':teamId')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Chi tiết team' })
  @ApiOkResponse({ type: TeamResponseDto })
  getOne(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('teamId') teamId: string,
  ): Promise<TeamResponseDto> {
    return this.teamsService.findOne(user.tenant_id, eventId, teamId);
  }

  @Patch(':teamId')
  @OpsRoles('ops_admin')
  @ApiOperation({ summary: 'Update team (name, targets, stations, UI meta)' })
  @ApiOkResponse({ type: TeamResponseDto })
  update(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
    @Req() req: Request,
  ): Promise<TeamResponseDto> {
    return this.teamsService.update(
      user.tenant_id,
      eventId,
      teamId,
      user.userId,
      dto,
      req,
    );
  }

  @Patch(':teamId/leader')
  @OpsRoles('ops_admin')
  @ApiOperation({
    summary: 'Gán/gỡ leader cho team (leader phải là ops_leader cùng event)',
  })
  @ApiOkResponse({ type: TeamResponseDto })
  assignLeader(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('teamId') teamId: string,
    @Body() dto: AssignLeaderDto,
    @Req() req: Request,
  ): Promise<TeamResponseDto> {
    return this.teamsService.assignLeader(
      user.tenant_id,
      eventId,
      teamId,
      user.userId,
      dto,
      req,
    );
  }

  @Delete(':teamId')
  @OpsRoles('ops_admin')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Archive team (chặn nếu còn user hoặc event đang LIVE)',
  })
  @ApiNoContentResponse()
  async archive(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('teamId') teamId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.teamsService.archive(
      user.tenant_id,
      eventId,
      teamId,
      user.userId,
      req,
    );
  }
}
