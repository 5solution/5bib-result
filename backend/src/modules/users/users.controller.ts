import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
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
  LogtoAuthGuard,
  LogtoService,
  CurrentUser,
  type LogtoUser,
} from '../logto-auth';
import { UploadService } from '../upload/upload.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly logto: LogtoService,
  ) {}

  /**
   * TEMP debug — dump the raw Authorization header (decoded JWT) so we can
   * see every claim Logto injects into the access token. Remove once RBAC
   * is working end-to-end.
   */
  @Get('me/debug')
  async meDebug(@Req() req: import('express').Request) {
    const header = req.headers.authorization || '';
    const token = header.replace(/^Bearer\s+/i, '');
    if (!token) return { error: 'no token' };
    // Decode (NOT verified) — purely for diagnostics
    const parts = token.split('.');
    if (parts.length !== 3) return { error: 'malformed token' };
    try {
      const header = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf8'),
      );
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      );
      return { header, payload };
    } catch (e) {
      return { error: 'decode failed', message: (e as Error).message };
    }
  }

  @UseGuards(LogtoAuthGuard)
  @ApiBearerAuth('Logto')
  @Get('me')
  @ApiOperation({
    summary: 'Get current user — networkless, from OIDC access token claims',
    description:
      'Claims populated by Logto access token (sub, email, roles, scope). Extra profile fields (username, name, picture) require the matching OIDC scopes on the application.',
  })
  @ApiResponse({ status: 200, description: 'User info from verified JWT' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: LogtoUser) {
    return { data: user };
  }

  @UseGuards(LogtoAuthGuard)
  @ApiBearerAuth('Logto')
  @Post('me/avatar')
  @ApiOperation({
    summary:
      'Upload custom avatar → S3 → persist URL into Logto user customData',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Avatar uploaded and synced' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: LogtoUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file is required');

    const url = await this.uploadService.uploadFile(file);
    if (!url) throw new BadRequestException('Upload failed');

    try {
      await this.logto.mergeCustomData(user.userId, {
        customAvatarUrl: url,
        avatarUpdatedAt: new Date().toISOString(),
      });
    } catch (err) {
      // Management API not configured or failing — keep S3 URL anyway so the
      // user at least has the uploaded asset. Frontend should read from a
      // local mirror or /users/me response to display the custom avatar.
      // We log the failure for observability but don't fail the upload.
      // eslint-disable-next-line no-console
      console.warn('Failed to sync avatar to Logto customData:', err);
    }

    return { data: { url } };
  }
}
