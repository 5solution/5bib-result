import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TeamLeaderService } from './services/team-leader.service';
import type {
  LeaderCheckinBulkSummary,
  LeaderMemberView,
  LeaderPortalResponse,
} from './services/team-leader.service';

const CHECKIN_METHODS = ['qr_scan', 'manual'] as const;

class LeaderCheckinDto {
  @ApiProperty({ type: Number })
  @IsInt()
  member_registration_id!: number;

  @ApiProperty({ enum: CHECKIN_METHODS })
  @IsEnum(CHECKIN_METHODS)
  method!: (typeof CHECKIN_METHODS)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  qr_code?: string;
}

class LeaderConfirmCompletionDto {
  @ApiProperty({ type: Number })
  @IsInt()
  member_registration_id!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class LeaderConfirmCompletionBulkDto {
  @ApiProperty({ type: [Number], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  member_registration_ids!: number[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/**
 * Public (no JWT) leader portal — authorized by the registration magic
 * token. Every endpoint re-validates the token through
 * TeamLeaderService.validateLeaderToken which enforces four gates:
 *   1. magic_token must exist
 *   2. the owning role.is_leader_role === true
 *   3. event_end_date + 7d hasn't passed
 *   4. per-endpoint cross-event checks for target member_ids
 * Throttler is tighter than admin endpoints because these are unauthenticated.
 */
@ApiTags('Team Management (leader portal)')
@Controller('public/team-leader')
export class TeamLeaderController {
  constructor(private readonly leader: TeamLeaderService) {}

  @Get(':token/team')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Return the leader portal data: leader info + all members of the same event. CCCD photo URLs are presigned for 1h and access is audit-logged.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        leader: {
          type: 'object',
          additionalProperties: true,
        },
        members: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
  })
  async getTeam(@Param('token') token: string): Promise<LeaderPortalResponse> {
    const { registration } = await this.leader.validateLeaderToken(token);
    return this.leader.getTeamMembers(registration);
  }

  @Post(':token/checkin')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Leader checks in a member. Member must be in the same event, status=qr_sent. For qr_scan method, qr_code must match.',
  })
  @ApiResponse({ status: 201 })
  async checkin(
    @Param('token') token: string,
    @Body() dto: LeaderCheckinDto,
  ): Promise<{ success: true; member: LeaderMemberView }> {
    const { registration } = await this.leader.validateLeaderToken(token);
    const updated = await this.leader.leaderCheckin(
      registration,
      dto.member_registration_id,
      dto.method,
      dto.qr_code,
    );
    return {
      success: true,
      member: {
        id: updated.id,
        full_name: updated.full_name,
        phone: updated.phone,
        role_name: updated.role?.role_name ?? '',
        status: updated.status,
        checked_in_at: updated.checked_in_at
          ? updated.checked_in_at.toISOString()
          : null,
        avatar_url: updated.avatar_photo_url,
        id_card_url: null,
        suspicious_checkin: updated.suspicious_checkin === true,
      },
    };
  }

  @Post(':token/confirm-completion')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Leader confirms completion for one member (checked_in → completed). Flags suspicious if worked time < event.min_work_hours_for_completion.',
  })
  @ApiResponse({ status: 201 })
  async confirm(
    @Param('token') token: string,
    @Body() dto: LeaderConfirmCompletionDto,
  ): Promise<{ success: true; suspicious: boolean; member_id: number }> {
    const { registration } = await this.leader.validateLeaderToken(token);
    const { suspicious, member } = await this.leader.confirmCompletion(
      registration,
      dto.member_registration_id,
      dto.note,
    );
    return { success: true, suspicious, member_id: member.id };
  }

  @Post(':token/confirm-completion-bulk')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Bulk confirm — skips (no error) members not in checked_in or wrong event. Returns counts + suspicious tally.',
  })
  @ApiResponse({ status: 201 })
  async confirmBulk(
    @Param('token') token: string,
    @Body() dto: LeaderConfirmCompletionBulkDto,
  ): Promise<LeaderCheckinBulkSummary> {
    const { registration } = await this.leader.validateLeaderToken(token);
    return this.leader.confirmCompletionBulk(
      registration,
      dto.member_registration_ids,
      dto.note,
    );
  }
}
