import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TeamDirectoryResponseDto } from './dto/team-directory.dto';
import { TeamDirectoryService } from './services/team-directory.service';

/**
 * v1.5 THAY ĐỔI 2 — Team phone directory (public, magic-token gated).
 * Separate controller (vs. team-registration) because the public-registration
 * controller is already large and the directory has distinct throttling/caching
 * characteristics.
 */
@ApiTags('Team Management (directory)')
@Controller('public/team-registration')
export class TeamDirectoryController {
  constructor(private readonly directory: TeamDirectoryService) {}

  @Get(':token/directory')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Return team directory: my team members + leaders of other teams. ' +
      'Leaders additionally see ALL members of other teams (BR-DIR-03).',
  })
  @ApiResponse({ status: 200, type: TeamDirectoryResponseDto })
  getDirectory(
    @Param('token') token: string,
  ): Promise<TeamDirectoryResponseDto> {
    return this.directory.getDirectory(token);
  }
}
