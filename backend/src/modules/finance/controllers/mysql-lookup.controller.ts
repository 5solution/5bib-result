import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoAdminGuard } from '../../logto-auth';
import { FeeService } from '../services/fee.service';
import {
  RaceSearchResultDto,
  TenantSearchResultDto,
} from '../dto/mysql-lookup.dto';

/**
 * F-028 — admin Tenant + Race picker để link Contract TICKET_SALES với
 * MySQL platform. Đọc-only `tenant` + `races` tables (named connection
 * 'platform'). Cache 60s tránh hammering MySQL khi admin gõ vào search box.
 */
@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('finance/mysql')
export class MysqlLookupController {
  constructor(private readonly feeService: FeeService) {}

  @Get('tenants/search')
  @ApiOperation({
    summary:
      'Search MySQL platform tenants by name or tax_id. Empty q → 20 latest.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search substring (name OR tax_id)',
  })
  @ApiResponse({ status: 200, type: TenantSearchResultDto, isArray: true })
  async searchTenants(
    @Query('q') q?: string,
  ): Promise<TenantSearchResultDto[]> {
    return this.feeService.searchTenants(q);
  }

  @Get('races')
  @ApiOperation({
    summary: 'List races for a tenant (MySQL platform). Optional title filter.',
  })
  @ApiQuery({
    name: 'tenantId',
    required: true,
    type: Number,
    description: 'tenants.id (BIGINT)',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Optional title substring',
  })
  @ApiResponse({ status: 200, type: RaceSearchResultDto, isArray: true })
  async searchRaces(
    @Query('tenantId', ParseIntPipe) tenantId: number,
    @Query('q') q?: string,
  ): Promise<RaceSearchResultDto[]> {
    return this.feeService.searchRaces(tenantId, q);
  }
}
