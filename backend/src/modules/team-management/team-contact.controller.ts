import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClerkAdminGuard } from 'src/modules/clerk-auth';
import { CreateEventContactDto } from './dto/create-event-contact.dto';
import { UpdateEventContactDto } from './dto/update-event-contact.dto';
import {
  EventContactDto,
  PublicEventContactsResponseDto,
} from './dto/event-contact.dto';
import { TeamContactService } from './services/team-contact.service';
import { TeamDirectoryService } from './services/team-directory.service';

/**
 * v1.5 THAY ĐỔI 3 — Emergency contact management.
 *
 * Admin endpoints (JWT): CRUD + toggle-active.
 * Public endpoint (token): grouped, active-only list. Visible to any valid
 * registration token regardless of status — safety info (BR-EMR-01).
 */
@ApiTags('Team Management (contacts)')
@Controller()
export class TeamContactController {
  constructor(
    private readonly contacts: TeamContactService,
    private readonly directory: TeamDirectoryService,
  ) {}

  // ---------- Admin (JWT) ----------

  @Get('team-management/events/:eventId/contacts')
  @ApiBearerAuth()
  @UseGuards(ClerkAdminGuard)
  @ApiOperation({
    summary: 'List all emergency contacts for event (admin, includes inactive)',
  })
  @ApiResponse({ status: 200, type: [EventContactDto] })
  listAdmin(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<EventContactDto[]> {
    return this.contacts.listForAdmin(eventId);
  }

  @Post('team-management/events/:eventId/contacts')
  @ApiBearerAuth()
  @UseGuards(ClerkAdminGuard)
  @ApiOperation({ summary: 'Create emergency contact for event' })
  @ApiResponse({ status: 201, type: EventContactDto })
  create(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: CreateEventContactDto,
  ): Promise<EventContactDto> {
    return this.contacts.create(eventId, dto);
  }

  @Patch('team-management/contacts/:id')
  @ApiBearerAuth()
  @UseGuards(ClerkAdminGuard)
  @ApiOperation({ summary: 'Update emergency contact' })
  @ApiResponse({ status: 200, type: EventContactDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventContactDto,
  ): Promise<EventContactDto> {
    return this.contacts.update(id, dto);
  }

  @Patch('team-management/contacts/:id/toggle-active')
  @ApiBearerAuth()
  @UseGuards(ClerkAdminGuard)
  @ApiOperation({ summary: 'Flip is_active flag on a contact' })
  @ApiResponse({ status: 200, type: EventContactDto })
  toggleActive(@Param('id', ParseIntPipe) id: number): Promise<EventContactDto> {
    return this.contacts.toggleActive(id);
  }

  @Delete('team-management/contacts/:id')
  @ApiBearerAuth()
  @UseGuards(ClerkAdminGuard)
  @ApiOperation({ summary: 'Delete emergency contact (hard-delete)' })
  @ApiResponse({ status: 200 })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: true }> {
    await this.contacts.remove(id);
    return { success: true };
  }

  // ---------- Public (magic token) ----------

  @Get('public/team-registration/:token/contacts')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'v1.5 — Emergency contacts grouped by type for the registered TNV. ' +
      'Token-gated (member OR leader); independent of registration status.',
  })
  @ApiResponse({ status: 200, type: PublicEventContactsResponseDto })
  async publicContacts(
    @Param('token') token: string,
  ): Promise<PublicEventContactsResponseDto> {
    // Re-use the directory validator — it accepts member + leader tokens.
    const reg = await this.directory.validateMemberToken(token);
    const grouped = await this.contacts.listForPublic(reg.event_id);
    return { contacts: grouped };
  }
}
