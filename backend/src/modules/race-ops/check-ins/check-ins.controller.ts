import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
import { CheckInsService } from './check-ins.service';
import {
  CheckInListQueryDto,
  CheckInListResponseDto,
  CheckInResponseDto,
  CheckInSummaryResponseDto,
  CreateCheckInDto,
} from './dto/check-in.dto';

@ApiTags('race-ops/check-ins')
@Controller('race-ops/admin/events/:eventId/check-ins')
@UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
@ApiBearerAuth()
export class CheckInsController {
  constructor(private readonly service: CheckInsService) {}

  @Post()
  @OpsRoles('ops_admin', 'ops_leader', 'ops_crew')
  @ApiOperation({
    summary: 'Ghi nhận check-in TNV/crew (QR hoặc manual)',
    description:
      'BR-02: ops_leader chỉ check-in user trong team của mình. ops_crew ghi nhận QR scan.',
  })
  @ApiCreatedResponse({ type: CheckInResponseDto })
  create(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Body() dto: CreateCheckInDto,
    @Req() req: Request,
  ): Promise<CheckInResponseDto> {
    // Crew coi như leader scope (team_id từ JWT)
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
    summary: 'Danh sách check-in (filter team/user/method/since)',
    description: 'BR-02: ops_leader chỉ xem team của mình.',
  })
  @ApiOkResponse({ type: CheckInListResponseDto })
  list(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Query() query: CheckInListQueryDto,
  ): Promise<CheckInListResponseDto> {
    const scopeTeamId =
      user.role === 'ops_admin' ? undefined : resolveScopeTeamId(user);
    return this.service.list(user.tenant_id, eventId, query, scopeTeamId);
  }

  @Get('summary')
  @OpsRoles('ops_admin')
  @ApiOperation({ summary: 'Summary check-in theo team (admin overview)' })
  @ApiOkResponse({ type: CheckInSummaryResponseDto })
  summary(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
  ): Promise<CheckInSummaryResponseDto> {
    return this.service.summary(user.tenant_id, eventId);
  }

  @Delete(':checkInId')
  @OpsRoles('ops_admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa bản ghi check-in (admin — hard delete)' })
  @ApiNoContentResponse()
  async delete(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('checkInId') checkInId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.delete(
      user.tenant_id,
      eventId,
      checkInId,
      user.userId,
      req,
    );
  }
}
