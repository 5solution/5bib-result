/**
 * FEATURE-047 Phase 1B — Athlete Admin endpoints (LogtoAdminGuard).
 *
 * BR-47-05 active toggle (privacy opt-out) + BR-47-16/17 photo moderation queue.
 */

import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { LogtoAdminGuard, CurrentUser, type LogtoUser } from '../../logto-auth';
import {
  AthleteProfile,
  AthleteProfileDocument,
} from '../schemas/athlete-profile.schema';
import { AthletePhotoService } from '../services/athlete-photo.service';
import { AthleteProfileService } from '../services/athlete-profile.service';
import {
  ModerationQueueItemDto,
  PhotoModerationActionDto,
  ToggleProfileActiveDto,
} from '../dto/upload-athlete-photo.dto';

@ApiTags('admin-athletes')
@ApiBearerAuth()
@Controller('admin/athletes')
@UseGuards(LogtoAdminGuard)
export class AthleteAdminController {
  private readonly logger = new Logger(AthleteAdminController.name);

  constructor(
    @InjectModel(AthleteProfile.name)
    private readonly profileModel: Model<AthleteProfileDocument>,
    private readonly photoService: AthletePhotoService,
    private readonly athleteProfileService: AthleteProfileService,
  ) {}

  /**
   * BR-47-05 Privacy opt-out toggle. active=false → public profile returns 404.
   */
  @Patch('profiles/:slug/active')
  @ApiOperation({
    summary:
      'F-047 Phase 1B — Toggle athlete profile active flag (privacy opt-out)',
  })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Active flag updated + cache invalidated',
  })
  @ApiResponse({ status: 404, description: 'Profile không tồn tại' })
  async toggleActive(
    @Param('slug') slug: string,
    @Body() body: ToggleProfileActiveDto,
    @CurrentUser() admin: LogtoUser,
  ): Promise<{ slug: string; active: boolean }> {
    const updated = await this.profileModel.findOneAndUpdate(
      { slug },
      { $set: { active: body.active } },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException('Profile không tồn tại');
    }

    await this.athleteProfileService.invalidateProfileCache(slug);

    this.logger.log(
      `[toggleActive] slug=${slug} active=${body.active} admin=${admin.sub}`,
    );

    return { slug, active: updated.active };
  }

  /** BR-47-16 — Photo moderation pending queue (paginated FIFO oldest first). */
  @Get('photos/pending')
  @ApiOperation({ summary: 'F-047 Phase 1B — Photo moderation queue' })
  @ApiQuery({ name: 'page', type: 'number', required: false })
  @ApiQuery({ name: 'limit', type: 'number', required: false })
  @ApiResponse({ status: 200, type: [ModerationQueueItemDto] })
  async getPendingQueue(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ items: ModerationQueueItemDto[]; total: number }> {
    const p = page ? Math.max(1, parseInt(page, 10)) : 1;
    const l = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 20;
    return this.photoService.getPendingQueue(p, l);
  }

  /** Pending count badge. */
  @Get('photos/pending-count')
  @ApiOperation({ summary: 'F-047 Phase 1B — Pending photo count badge' })
  @ApiResponse({ status: 200 })
  async getPendingCount(): Promise<{ count: number }> {
    return { count: await this.photoService.getPendingCount() };
  }

  /** Approve a pending photo. Atomic — fails 409 if already moderated. */
  @Patch('photos/:photoId/approve')
  @ApiOperation({ summary: 'F-047 Phase 1B — Approve athlete photo' })
  @ApiParam({ name: 'photoId', type: 'string' })
  @ApiResponse({ status: 200 })
  @ApiResponse({
    status: 409,
    description: 'Photo đã được duyệt/từ chối trước đó',
  })
  async approvePhoto(
    @Param('photoId') photoId: string,
    @CurrentUser() admin: LogtoUser,
  ): Promise<{ id: string; status: 'approved'; athleteSlug: string }> {
    return this.photoService.approve(photoId, admin.sub);
  }

  /** Reject a pending photo with optional reason. */
  @Patch('photos/:photoId/reject')
  @ApiOperation({ summary: 'F-047 Phase 1B — Reject athlete photo' })
  @ApiParam({ name: 'photoId', type: 'string' })
  @ApiResponse({ status: 200 })
  @ApiResponse({
    status: 409,
    description: 'Photo đã được duyệt/từ chối trước đó',
  })
  async rejectPhoto(
    @Param('photoId') photoId: string,
    @Body() body: PhotoModerationActionDto,
    @CurrentUser() admin: LogtoUser,
  ): Promise<{ id: string; status: 'rejected'; athleteSlug: string }> {
    return this.photoService.reject(photoId, admin.sub, body.reason);
  }
}
