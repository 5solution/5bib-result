import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ClerkAuthGuard,
  ClerkService,
  CurrentUser,
  type ClerkUser,
} from '../clerk-auth';
import { UploadService } from '../upload/upload.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly clerk: ClerkService,
  ) {}

  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth('Clerk')
  @Get('me')
  @ApiOperation({
    summary: 'Get current user — networkless, data from JWT claims only',
    description:
      'Cần config Custom Session Token trong Clerk Dashboard để JWT có đủ email/image/name. Xem Dashboard → Sessions → Customize session token.',
  })
  @ApiResponse({ status: 200, description: 'User info from verified JWT' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: ClerkUser) {
    return { data: user };
  }

  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth('Clerk')
  @Post('me/avatar')
  @ApiOperation({
    summary: 'Upload custom avatar → S3 → save URL to Clerk publicMetadata',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Avatar uploaded and synced' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: ClerkUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file is required');

    const url = await this.uploadService.uploadFile(file);
    if (!url) throw new BadRequestException('Upload failed');

    await this.clerk.mergePublicMetadata(user.clerkId, {
      customAvatarUrl: url,
      avatarUpdatedAt: new Date().toISOString(),
    });

    return { data: { url } };
  }
}
