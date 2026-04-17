import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { env } from 'src/config';
import { OpsJwtAuthGuard } from '../common/guards/ops-jwt-auth.guard';
import { OpsRoleGuard } from '../common/guards/ops-role.guard';
import { OpsRoles } from '../common/decorators/ops-roles.decorator';
import { OpsUserCtx } from '../common/decorators/ops-user.decorator';
import { OpsUserContext } from '../common/types/ops-jwt-payload.type';
import { resolveScopeTeamId } from '../common/utils/resolve-scope-team.util';
import { ApplicationsService } from './applications.service';
import {
  AdminCreateUserDto,
  AdminUpdateUserDto,
  ApplicationListQueryDto,
  ApproveApplicationDto,
  PublicApplyDto,
  PublicApplyResponseDto,
  RejectApplicationDto,
  UserListResponseDto,
  UserQrBadgeResponseDto,
  UserResponseDto,
} from './dto/application.dto';

/* ───────────── PUBLIC ───────────── */

@ApiTags('race-ops/public')
@Controller('race-ops/public/events/:slug/apply')
export class PublicApplicationController {
  constructor(private readonly appService: ApplicationsService) {}

  @Post()
  @ApiOperation({
    summary: 'TNV đăng ký tình nguyện viên (không cần auth)',
    description:
      'Tạo ops_user role=ops_tnv, status=PENDING. Leader/admin duyệt sau.',
  })
  @ApiBody({ type: PublicApplyDto })
  @ApiCreatedResponse({ type: PublicApplyResponseDto })
  apply(
    @Param('slug') slug: string,
    @Body() dto: PublicApplyDto,
  ): Promise<PublicApplyResponseDto> {
    return this.appService.publicApply(env.ops.defaultTenantId, slug, dto);
  }
}

/* ───────────── ADMIN ───────────── */

@ApiTags('race-ops/users')
@Controller('race-ops/admin/events/:eventId/users')
@UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly appService: ApplicationsService) {}

  @Post()
  @OpsRoles('ops_admin')
  @ApiOperation({
    summary: 'Admin tạo crew/leader trực tiếp (auto APPROVED)',
  })
  @ApiCreatedResponse({ type: UserResponseDto })
  createUser(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Body() dto: AdminCreateUserDto,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    return this.appService.adminCreateUser(
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
    summary: 'Danh sách users/applications — filter theo status/role/team',
    description:
      'BR-02: ops_leader chỉ thấy user trong team của mình. ops_admin thấy tất cả.',
  })
  @ApiOkResponse({ type: UserListResponseDto })
  list(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Query() query: ApplicationListQueryDto,
  ): Promise<UserListResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.appService.list(user.tenant_id, eventId, query, scopeTeamId);
  }

  @Patch(':userId/approve')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({
    summary: 'Duyệt đơn TNV (PENDING → APPROVED, gen QR token)',
    description:
      'Optionally gán team_id trong body nếu muốn assign team ngay lúc duyệt. ' +
      'BR-02: ops_leader chỉ duyệt được TNV đang thuộc team của mình; ' +
      'nếu body.team_id có thì phải bằng team_id của leader.',
  })
  @ApiBody({ type: ApproveApplicationDto, required: false })
  @ApiOkResponse({ type: UserResponseDto })
  approve(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() dto: ApproveApplicationDto,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.appService.approve(
      user.tenant_id,
      eventId,
      userId,
      user.userId,
      dto?.team_id,
      scopeTeamId,
      req,
    );
  }

  @Get('export.csv')
  @OpsRoles('ops_admin')
  @ApiOperation({
    summary: 'Export users CSV (filter status/role/team, UTF-8 BOM)',
  })
  @ApiProduces('text/csv')
  async exportCsv(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Query() query: ApplicationListQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.appService.exportCsv(user.tenant_id, eventId, {
      status: query.status,
      role: query.role,
      team_id: query.team_id,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="users-${eventId}.csv"`,
    );
    res.send(csv);
  }

  @Patch(':userId')
  @OpsRoles('ops_admin')
  @ApiOperation({
    summary: 'Admin update user profile / reassign team (partial)',
  })
  @ApiOkResponse({ type: UserResponseDto })
  updateUser(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() dto: AdminUpdateUserDto,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    return this.appService.adminUpdateUser(
      user.tenant_id,
      eventId,
      userId,
      user.userId,
      dto,
      req,
    );
  }

  @Post(':userId/qr-badge')
  @OpsRoles('ops_admin')
  @ApiOperation({
    summary: 'Rotate + issue QR token cho user (in badge)',
    description:
      'Tạo QR mới → physical badge cũ mất hiệu lực. Chỉ crew/tnv APPROVED/ACTIVE.',
  })
  @ApiOkResponse({ type: UserQrBadgeResponseDto })
  issueQrBadge(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ): Promise<UserQrBadgeResponseDto> {
    return this.appService.issueQrBadge(
      user.tenant_id,
      eventId,
      userId,
      user.userId,
      req,
    );
  }

  @Patch(':userId/reject')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({
    summary: 'Từ chối đơn (PENDING → REJECTED)',
    description:
      'BR-02: ops_leader chỉ reject được TNV đang thuộc team của mình.',
  })
  @ApiBody({ type: RejectApplicationDto })
  @ApiOkResponse({ type: UserResponseDto })
  reject(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() dto: RejectApplicationDto,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.appService.reject(
      user.tenant_id,
      eventId,
      userId,
      user.userId,
      dto,
      scopeTeamId,
      req,
    );
  }
}
