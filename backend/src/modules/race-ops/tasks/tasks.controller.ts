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
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  ImportTasksDto,
  ImportTasksResponseDto,
  TaskListQueryDto,
  TaskListResponseDto,
  TaskResponseDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto/task.dto';

@ApiTags('race-ops/tasks')
@Controller('race-ops/admin/events/:eventId/tasks')
@UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Post()
  @OpsRoles('ops_admin')
  @ApiOperation({ summary: 'Tạo task mới (admin)' })
  @ApiCreatedResponse({ type: TaskResponseDto })
  create(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Body() dto: CreateTaskDto,
    @Req() req: Request,
  ): Promise<TaskResponseDto> {
    return this.service.create(
      user.tenant_id,
      eventId,
      user.userId,
      dto,
      req,
    );
  }

  @Get()
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({
    summary: 'Danh sách tasks (filter status/team/assignee)',
    description:
      'BR-02: ops_leader thấy task của team mình + task event-wide (team_id=null).',
  })
  @ApiOkResponse({ type: TaskListResponseDto })
  list(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Query() query: TaskListQueryDto,
  ): Promise<TaskListResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.service.list(user.tenant_id, eventId, query, scopeTeamId);
  }

  @Get(':taskId')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Chi tiết task' })
  @ApiOkResponse({ type: TaskResponseDto })
  getOne(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
  ): Promise<TaskResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.service.findOne(user.tenant_id, eventId, taskId, scopeTeamId);
  }

  @Patch(':taskId')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Update task (full fields)' })
  @ApiOkResponse({ type: TaskResponseDto })
  update(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: Request,
  ): Promise<TaskResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.service.update(
      user.tenant_id,
      eventId,
      taskId,
      user.userId,
      dto,
      scopeTeamId,
      req,
    );
  }

  @Patch(':taskId/status')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Fast-path đổi status (PENDING/IN_PROGRESS/DONE/BLOCKED)' })
  @ApiOkResponse({ type: TaskResponseDto })
  updateStatus(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
    @Req() req: Request,
  ): Promise<TaskResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.service.updateStatus(
      user.tenant_id,
      eventId,
      taskId,
      user.userId,
      dto,
      scopeTeamId,
      req,
    );
  }

  @Delete(':taskId')
  @OpsRoles('ops_admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Archive task (soft-delete)' })
  @ApiNoContentResponse()
  async archive(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.archive(
      user.tenant_id,
      eventId,
      taskId,
      user.userId,
      req,
    );
  }

  @Post('import')
  @OpsRoles('ops_admin')
  @ApiOperation({
    summary:
      'Bulk import tasks từ Excel (TIMELINE sheet). Idempotent với replace_by_sheet=true.',
  })
  @ApiOkResponse({ type: ImportTasksResponseDto })
  importTasks(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Body() dto: ImportTasksDto,
    @Req() req: Request,
  ): Promise<ImportTasksResponseDto> {
    return this.service.importFromExcel(
      user.tenant_id,
      eventId,
      user.userId,
      dto,
      req,
    );
  }
}
