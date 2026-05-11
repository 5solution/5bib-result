import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ContractTemplateService } from './services/contract-template.service';
import { ContractType } from './schemas/contract.schema';
import { LogtoAdminGuard } from '../logto-auth';

/**
 * F-024 Contract Templates controller — fix QC HIGH H-01.
 *
 * PRD US-07 requires admin to edit boilerplate articles per contract type
 * via UI. ContractTemplateService was implemented in Phase 1 but controller
 * was missing → admin templates page hit 404. This controller exposes
 * the service per Manager plan section "Endpoints" lines 730-732:
 *   - GET    /api/contract-templates              — list all
 *   - GET    /api/contract-templates/:type        — get by type
 *   - PATCH  /api/contract-templates/:type        — upsert (admin edit)
 *   - POST   /api/contract-templates/:type/reset  — reset to default
 *
 * All endpoints class-level guarded by LogtoAdminGuard per BR-CM-13.
 */
@ApiTags('Contract Templates')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('contract-templates')
export class ContractTemplatesController {
  constructor(private readonly templates: ContractTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'List all contract templates (one per type)' })
  @ApiResponse({ status: 200 })
  async list() {
    return this.templates.list();
  }

  @Get(':type')
  @ApiOperation({
    summary:
      'Get template by contract type (returns synthetic doc with defaults if not yet customized)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiResponse({ status: 200 })
  async getByType(@Param('type') type: ContractType) {
    return this.templates.getByType(type);
  }

  @Patch(':type')
  @ApiOperation({
    summary:
      'Upsert template articles for a contract type (BR-CM-11 admin edit boilerplate)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiResponse({ status: 200 })
  async upsert(
    @Param('type') type: ContractType,
    @Body() body: { articles: Record<string, string> },
    @Req() req: any,
  ) {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.templates.upsert(type, body.articles, userId);
  }

  @Post(':type/reset')
  @ApiOperation({
    summary:
      'Reset template to default (delete DB override, fallback to constants/default-templates.ts)',
  })
  @ApiParam({
    name: 'type',
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
  })
  @ApiResponse({ status: 200 })
  async reset(@Param('type') type: ContractType) {
    return this.templates.resetToDefault(type);
  }
}
