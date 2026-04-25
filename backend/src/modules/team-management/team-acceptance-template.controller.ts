import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoAdminGuard, type AuthenticatedRequest } from 'src/modules/logto-auth';
import { VolAcceptanceTemplate } from './entities/vol-acceptance-template.entity';
import {
  CreateAcceptanceTemplateDto,
  UpdateAcceptanceTemplateDto,
} from './dto/acceptance-template.dto';
import { TeamAcceptanceTemplateService } from './services/team-acceptance-template.service';


/**
 * Admin CRUD for biên bản nghiệm thu templates. Mirrors the shape of
 * TeamContractTemplateController but kept in a separate file so the two
 * template types stay independent (contracts use VolContractTemplate,
 * acceptances use VolAcceptanceTemplate).
 *
 * Default template (is_default=TRUE, event_id=NULL, seeded by migration 031)
 * cannot be deleted — admin must edit in place. Per-event templates fall
 * back to the default when absent; this is handled by the resolveForEvent()
 * call at send-time.
 */
@ApiTags('Team Management — Acceptance Templates (admin)')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('team-management/acceptance-templates')
export class TeamAcceptanceTemplateController {
  constructor(
    private readonly templates: TeamAcceptanceTemplateService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List acceptance templates. Pass event_id to see event-scoped + the global default; omit for all.',
  })
  @ApiResponse({ status: 200, type: [VolAcceptanceTemplate] })
  list(
    @Query('event_id') eventIdRaw?: string,
  ): Promise<VolAcceptanceTemplate[]> {
    // Query params arrive as strings; parse manually so an empty / malformed
    // event_id degrades to "list all" rather than 400.
    const eventId =
      eventIdRaw != null && /^\d+$/.test(eventIdRaw)
        ? Number(eventIdRaw)
        : undefined;
    return this.templates.listTemplates(eventId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get acceptance template detail' })
  @ApiResponse({ status: 200, type: VolAcceptanceTemplate })
  get(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<VolAcceptanceTemplate> {
    return this.templates.getTemplate(id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create acceptance template. Scoped to an event via event_id, or omit for a custom global template (is_default stays false — only the seeded row owns that flag).',
  })
  @ApiResponse({ status: 201, type: VolAcceptanceTemplate })
  create(
    @Body() dto: CreateAcceptanceTemplateDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<VolAcceptanceTemplate> {
    const createdBy =
      req.user?.username ?? req.user?.email ?? req.user?.sub ?? 'admin';
    return this.templates.createTemplate(dto, createdBy);
  }

  @Put(':id')
  @ApiOperation({
    summary:
      'Update acceptance template. Editing the default template is allowed but logged at WARN level — affects all events without a scoped template.',
  })
  @ApiResponse({ status: 200, type: VolAcceptanceTemplate })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAcceptanceTemplateDto,
  ): Promise<VolAcceptanceTemplate> {
    return this.templates.updateTemplate(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete acceptance template. Fails 400 if is_default; fails 409 if referenced by any registration (deactivate via PUT is_active=false instead).',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: true }> {
    await this.templates.deleteTemplate(id);
    return { success: true };
  }

  @Post('validate')
  @ApiOperation({
    summary:
      'Scan HTML for unknown {{placeholders}} (not in VALID_ACCEPTANCE_VARIABLES). Returns valid=false with the unknown list so the admin UI can warn.',
  })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        unknownVars: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  validate(@Body() body: { content_html: string }): {
    valid: boolean;
    unknownVars: string[];
  } {
    return this.templates.validateTemplate(body?.content_html ?? '');
  }
}
