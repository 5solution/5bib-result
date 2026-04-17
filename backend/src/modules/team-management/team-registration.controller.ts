import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { VolEvent } from './entities/vol-event.entity';
import { RegisterDto } from './dto/register.dto';
import {
  UploadPhotoDto,
  UploadPhotoResponseDto,
} from './dto/upload-photo.dto';
import {
  PublicEventSummaryDto,
  RegisterResponseDto,
  StatusResponseDto,
} from './dto/response.dto';
import {
  ContractViewDto,
  SignContractDto,
  SignContractResponseDto,
} from './dto/sign-contract.dto';
import {
  CheckinResponseDto,
  SelfCheckinDto,
} from './dto/checkin.dto';
import { TeamEventService } from './services/team-event.service';
import { TeamRegistrationService } from './services/team-registration.service';
import { TeamPhotoService } from './services/team-photo.service';
import { TeamContractService } from './services/team-contract.service';
import { TeamCheckinService } from './services/team-checkin.service';
import { VolRole } from './entities/vol-role.entity';

@ApiTags('Team Management (public)')
@Controller('public')
export class TeamRegistrationController {
  constructor(
    private readonly events: TeamEventService,
    private readonly registrations: TeamRegistrationService,
    private readonly photos: TeamPhotoService,
    private readonly contracts: TeamContractService,
    private readonly checkin: TeamCheckinService,
  ) {}

  @Get('team-events')
  @ApiOperation({ summary: 'List open events' })
  @ApiResponse({ status: 200, type: [PublicEventSummaryDto] })
  async listPublicEvents(): Promise<PublicEventSummaryDto[]> {
    const events = await this.events.listPublicEvents();
    return Promise.all(events.map((e) => this.toPublicEventSummary(e)));
  }

  @Get('team-events/:id')
  @ApiOperation({ summary: 'Get open event with available roles' })
  @ApiResponse({ status: 200, type: PublicEventSummaryDto })
  async getPublicEvent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PublicEventSummaryDto> {
    const detail = await this.events.getPublicEvent(id);
    return this.toPublicEventSummary(detail, detail.roles);
  }

  @Post('team-register')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register for a role (public, no auth)' })
  @ApiResponse({ status: 201, type: RegisterResponseDto })
  register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.registrations.register(dto);
  }

  @Get('team-status/:token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get registration status via magic token' })
  @ApiResponse({ status: 200, type: StatusResponseDto })
  status(@Param('token') token: string): Promise<StatusResponseDto> {
    return this.registrations.getStatus(token);
  }

  @Get('team-contract/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'View contract HTML for signing (magic token)' })
  @ApiResponse({ status: 200, type: ContractViewDto })
  viewContract(@Param('token') token: string): Promise<ContractViewDto> {
    return this.contracts.viewContract(token);
  }

  @Post('team-contract/:token/sign')
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @ApiOperation({ summary: 'Sign contract — generates PDF, stores hash' })
  @ApiResponse({ status: 201, type: SignContractResponseDto })
  signContract(
    @Param('token') token: string,
    @Body() dto: SignContractDto,
    @Ip() ip: string,
  ): Promise<SignContractResponseDto> {
    return this.contracts.signContract(token, dto.confirmed_name, dto.ip ?? ip);
  }

  @Post('team-checkin/:token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Self check-in via GPS (magic token)' })
  @ApiResponse({ status: 201, type: CheckinResponseDto })
  selfCheckin(
    @Param('token') token: string,
    @Body() dto: SelfCheckinDto,
  ): Promise<CheckinResponseDto> {
    return this.checkin.selfCheckin(token, dto);
  }

  @Post('team-upload-photo')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload avatar or CCCD photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'photo_type'],
      properties: {
        file: { type: 'string', format: 'binary' },
        photo_type: { type: 'string', enum: ['avatar', 'cccd'] },
      },
    },
  })
  @ApiResponse({ status: 201, type: UploadPhotoResponseDto })
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadPhotoDto,
  ): Promise<UploadPhotoResponseDto> {
    const result = await this.photos.upload(file, dto.photo_type);
    return { url: result.url };
  }

  private async toPublicEventSummary(
    event: VolEvent,
    roles?: VolRole[],
  ): Promise<PublicEventSummaryDto> {
    const roleList = roles ?? (await this.events.listRoles(event.id));
    return {
      id: event.id,
      event_name: event.event_name,
      description: event.description,
      location: event.location,
      event_start_date: event.event_start_date,
      event_end_date: event.event_end_date,
      registration_open: event.registration_open.toISOString(),
      registration_close: event.registration_close.toISOString(),
      roles: roleList.map((r) => ({
        id: r.id,
        role_name: r.role_name,
        description: r.description ?? undefined,
        max_slots: r.max_slots,
        filled_slots: r.filled_slots,
        is_full: r.filled_slots >= r.max_slots,
        waitlist_enabled: r.waitlist_enabled,
        daily_rate: Number(r.daily_rate),
        working_days: r.working_days,
        form_fields: r.form_fields,
      })),
    };
  }
}
