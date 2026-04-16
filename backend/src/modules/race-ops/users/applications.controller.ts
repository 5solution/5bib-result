import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { env } from 'src/config';
import { OpsJwtAuthGuard } from '../common/guards/ops-jwt-auth.guard';
import { OpsRoleGuard } from '../common/guards/ops-role.guard';
import { OpsRoles } from '../common/decorators/ops-roles.decorator';
import { OpsUserCtx } from '../common/decorators/ops-user.decorator';
import { OpsUserContext } from '../common/types/ops-jwt-payload.type';
import { ApplicationsService } from './applications.service';
import {
  AdminCreateUserDto,
  ApplicationListQueryDto,
  PublicApplyDto,
  PublicApplyResponseDto,
  RejectApplicationDto,
  UserListResponseDto,
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
  })
  @ApiOkResponse({ type: UserListResponseDto })
  list(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Query() query: ApplicationListQueryDto,
  ): Promise<UserListResponseDto> {
    return this.appService.list(user.tenant_id, eventId, query);
  }

  @Patch(':userId/approve')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({
    summary: 'Duyệt đơn TNV (PENDING → APPROVED, gen QR token)',
    description:
      'Optionally gán team_id trong body nếu muốn assign team ngay lúc duyệt.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  approve(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() body: { team_id?: string },
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    return this.appService.approve(
      user.tenant_id,
      eventId,
      userId,
      user.userId,
      body?.team_id,
      req,
    );
  }

  @Patch(':userId/reject')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Từ chối đơn (PENDING → REJECTED)' })
  @ApiBody({ type: RejectApplicationDto })
  @ApiOkResponse({ type: UserResponseDto })
  reject(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() dto: RejectApplicationDto,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    return this.appService.reject(
      user.tenant_id,
      eventId,
      userId,
      user.userId,
      dto,
      req,
    );
  }
}
