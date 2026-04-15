import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OpsJwtAuthGuard } from '../common/guards/ops-jwt-auth.guard';
import { OpsUserCtx } from '../common/decorators/ops-user.decorator';
import { OpsUserContext } from '../common/types/ops-jwt-payload.type';
import { OpsAuthService } from './ops-auth.service';
import {
  OpsLoginDto,
  OpsLoginResponseDto,
  OpsMeResponseDto,
} from './dto/ops-auth.dto';

@ApiTags('race-ops/auth')
@Controller('race-ops/auth')
export class OpsAuthController {
  constructor(private readonly authService: OpsAuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login ops admin/leader bằng email + password',
    description:
      'Trả về JWT access token dùng cho tất cả ops endpoints. Crew/TNV KHÔNG login qua endpoint này.',
  })
  @ApiBody({ type: OpsLoginDto })
  @ApiOkResponse({ type: OpsLoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials hoặc role không được phép' })
  async login(@Body() dto: OpsLoginDto): Promise<OpsLoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(OpsJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profile của ops user đang login' })
  @ApiOkResponse({ type: OpsMeResponseDto })
  me(@OpsUserCtx() user: OpsUserContext): OpsMeResponseDto {
    return {
      user_id: user.userId,
      role: user.role,
      event_id: user.event_id,
      team_id: user.team_id ?? null,
      email: user.email,
      phone: user.phone,
      full_name: user.full_name,
    };
  }
}
