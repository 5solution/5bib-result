import {
  Body,
  Controller,
  Get,
  Param,
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
import { LogtoAdminGuard } from '../../logto-auth';
import { CostSuggestionsService } from '../services/cost-suggestions.service';
import {
  BulkCreateCostItemsDto,
  CostSuggestionDto,
} from '../dto/cost-suggestion.dto';
import { CostItemResponseDto } from '../dto/pnl-response.dto';

/**
 * F-028 Phase 3 — endpoints gợi ý chi phí từ HĐ ↔ Service Catalog.
 *
 *   GET  /finance/contracts/:contractId/cost-suggestions
 *   POST /finance/contracts/:contractId/cost-items/bulk
 *
 * Admin-only (LogtoAdminGuard) — pattern CostItemsController.
 */
@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('finance/contracts/:contractId')
export class CostSuggestionsController {
  constructor(private readonly service: CostSuggestionsService) {}

  private actor(req: any): string {
    return req?.user?.sub ?? req?.user?.email ?? 'admin';
  }

  @Get('cost-suggestions')
  @ApiOperation({
    summary: 'Gợi ý chi phí từ HĐ ↔ Service Catalog (BR-PNL Phase 3)',
  })
  @ApiParam({ name: 'contractId' })
  @ApiResponse({ status: 200, type: [CostSuggestionDto] })
  async getSuggestions(
    @Param('contractId') contractId: string,
  ): Promise<CostSuggestionDto[]> {
    return this.service.getSuggestions(contractId);
  }

  @Post('cost-items/bulk')
  @ApiOperation({
    summary: 'Bulk tạo cost items từ suggestions admin đã tick (Phase 3)',
  })
  @ApiParam({ name: 'contractId' })
  @ApiResponse({ status: 201, type: [CostItemResponseDto] })
  async bulkCreate(
    @Param('contractId') contractId: string,
    @Body() dto: BulkCreateCostItemsDto,
    @Req() req: any,
  ): Promise<CostItemResponseDto[]> {
    return this.service.bulkCreate(contractId, dto.items, this.actor(req));
  }
}
