import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ClerkAdminGuard } from '../clerk-auth';
import { MerchantService } from './merchant.service';
import { SearchMerchantsDto } from './dto/search-merchants.dto';
import { UpdateMerchantFeeDto } from './dto/update-merchant-fee.dto';
import { UpdateMerchantCompanyDto } from './dto/update-merchant-company.dto';
import { ApproveMerchantDto } from './dto/approve-merchant.dto';

@ApiTags('merchants')
@ApiBearerAuth()
@UseGuards(ClerkAdminGuard)
@Controller('merchants')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách merchant từ platform MySQL (kèm config phí từ MongoDB)' })
  @ApiResponse({ status: 200, description: 'Danh sách merchant' })
  findAll(@Query() dto: SearchMerchantsDto) {
    return this.merchantService.findAll(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một merchant' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Merchant không tồn tại' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.merchantService.findOne(id);
  }

  @Patch(':id/fee')
  @ApiOperation({ summary: 'Cập nhật cấu hình phí (lưu vào MongoDB)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200 })
  updateFee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMerchantFeeDto,
    @Request() req: any,
  ) {
    const adminId: number | undefined = req.user?.id;
    return this.merchantService.updateFee(id, dto, adminId);
  }

  @Get(':id/fee-history')
  @ApiOperation({ summary: 'Lịch sử thay đổi phí của merchant (từ MongoDB)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200 })
  getFeeHistory(@Param('id', ParseIntPipe) id: number) {
    return this.merchantService.getFeeHistory(id);
  }

  @Patch(':id/star')
  @ApiOperation({ summary: 'Toggle đánh dấu merchant quan trọng' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200 })
  toggleStar(@Param('id', ParseIntPipe) id: number) {
    return this.merchantService.toggleStar(id);
  }

  @Patch(':id/company')
  @ApiOperation({ summary: 'Cập nhật thông tin công ty đối tác (lưu vào MongoDB)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200 })
  updateCompany(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMerchantCompanyDto,
  ) {
    return this.merchantService.updateCompany(id, dto);
  }

  @Get(':id/races')
  @ApiOperation({ summary: 'Danh sách giải đấu của merchant (từ MySQL platform)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200 })
  getRaces(@Param('id', ParseIntPipe) id: number) {
    return this.merchantService.getRaces(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Cập nhật contract status / approval tracking (lưu vào MongoDB)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200 })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveMerchantDto,
    @Request() req: any,
  ) {
    const adminId: number | undefined = req.user?.id;
    return this.merchantService.approve(id, dto, adminId);
  }
}
