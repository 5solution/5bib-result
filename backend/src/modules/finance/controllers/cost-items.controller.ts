import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
import { CostItemsService } from '../services/cost-items.service';
import { CreateCostItemDto } from '../dto/create-cost-item.dto';
import { UpdateCostItemDto } from '../dto/update-cost-item.dto';
import {
  CostItemResponseDto,
  PaginatedCostItemsDto,
} from '../dto/pnl-response.dto';
import { CostItemFilterDto } from '../dto/pnl-filter.dto';

/**
 * F-028 BR-PNL-12 — admin-only. KHÔNG dùng LogtoStaffGuard.
 *
 * Endpoint set:
 *   POST   /finance/contracts/:contractId/cost-items
 *   GET    /finance/contracts/:contractId/cost-items
 *   PATCH  /finance/contracts/:contractId/cost-items/:id
 *   DELETE /finance/contracts/:contractId/cost-items/:id  (soft)
 */
@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('finance/contracts/:contractId/cost-items')
export class CostItemsController {
  constructor(private readonly service: CostItemsService) {}

  private actor(req: any): string {
    return req?.user?.sub ?? req?.user?.email ?? 'admin';
  }

  @Post()
  @ApiOperation({ summary: 'Tạo cost item cho hợp đồng' })
  @ApiParam({ name: 'contractId' })
  @ApiResponse({ status: 201, type: CostItemResponseDto })
  async create(
    @Param('contractId') contractId: string,
    @Body() dto: CreateCostItemDto,
    @Req() req: any,
  ): Promise<CostItemResponseDto> {
    return this.service.create(contractId, dto, this.actor(req));
  }

  @Get()
  @ApiOperation({ summary: 'List cost items per contract (paginated)' })
  @ApiParam({ name: 'contractId' })
  @ApiResponse({ status: 200, type: PaginatedCostItemsDto })
  async list(
    @Param('contractId') contractId: string,
    @Query() filter: CostItemFilterDto,
  ): Promise<PaginatedCostItemsDto> {
    return this.service.list(contractId, filter.page ?? 1, filter.limit ?? 20);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update cost item (edit anytime — BR-PNL-11)' })
  @ApiParam({ name: 'contractId' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: CostItemResponseDto })
  async update(
    @Param('contractId') contractId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCostItemDto,
    @Req() req: any,
  ): Promise<CostItemResponseDto> {
    return this.service.update(contractId, id, dto, this.actor(req));
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Soft delete cost item (BR-PNL-10)' })
  @ApiParam({ name: 'contractId' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  async remove(
    @Param('contractId') contractId: string,
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<{ success: true }> {
    return this.service.softDelete(contractId, id, this.actor(req));
  }
}
