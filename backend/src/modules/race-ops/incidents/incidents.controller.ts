import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
import { resolveScopeTeamId } from '../common/utils/resolve-scope-team.util';
import { IncidentsService } from './incidents.service';
import {
  AcknowledgeIncidentDto,
  CreateIncidentDto,
  IncidentListQueryDto,
  IncidentListResponseDto,
  IncidentResponseDto,
  ResolveIncidentDto,
} from './dto/incident.dto';

@ApiTags('race-ops/incidents')
@Controller('race-ops/admin/events/:eventId/incidents')
@UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
@ApiBearerAuth()
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Post()
  @OpsRoles('ops_admin', 'ops_leader', 'ops_crew')
  @ApiOperation({
    summary: 'Báo sự cố (OPEN). Leader chỉ báo cho team mình.',
  })
  @ApiCreatedResponse({ type: IncidentResponseDto })
  create(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Body() dto: CreateIncidentDto,
    @Req() req: Request,
  ): Promise<IncidentResponseDto> {
    const scopeTeamId =
      user.role === 'ops_admin' ? undefined : resolveScopeTeamId(user);
    return this.service.create(
      user.tenant_id,
      eventId,
      user.userId,
      dto,
      scopeTeamId,
      req,
    );
  }

  @Get()
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({
    summary: 'Danh sách incidents (filter status/priority/team)',
    description:
      'BR-02: ops_leader thấy incident team mình + event-wide (team_id=null).',
  })
  @ApiOkResponse({ type: IncidentListResponseDto })
  list(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Query() query: IncidentListQueryDto,
  ): Promise<IncidentListResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.service.list(user.tenant_id, eventId, query, scopeTeamId);
  }

  @Patch(':incidentId/acknowledge')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Acknowledge incident (OPEN → ACKNOWLEDGED)' })
  @ApiOkResponse({ type: IncidentResponseDto })
  acknowledge(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('incidentId') incidentId: string,
    @Body() dto: AcknowledgeIncidentDto,
    @Req() req: Request,
  ): Promise<IncidentResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.service.acknowledge(
      user.tenant_id,
      eventId,
      incidentId,
      user.userId,
      dto,
      scopeTeamId,
      req,
    );
  }

  @Patch(':incidentId/resolve')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Resolve incident với note' })
  @ApiOkResponse({ type: IncidentResponseDto })
  resolve(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('incidentId') incidentId: string,
    @Body() dto: ResolveIncidentDto,
    @Req() req: Request,
  ): Promise<IncidentResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.service.resolve(
      user.tenant_id,
      eventId,
      incidentId,
      user.userId,
      dto,
      scopeTeamId,
      req,
    );
  }

  @Delete(':incidentId')
  @OpsRoles('ops_admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Archive incident (admin only)' })
  @ApiNoContentResponse()
  async archive(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('incidentId') incidentId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.archive(
      user.tenant_id,
      eventId,
      incidentId,
      user.userId,
      req,
    );
  }
}
