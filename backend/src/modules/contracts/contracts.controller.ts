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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ContractsService } from './services/contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractFilterDto } from './dto/contract-filter.dto';
import {
  ContractResponseDto,
  PaginatedContractsDto,
} from './dto/contract-response.dto';
import {
  CreateAcceptanceReportDto,
  CreatePaymentRequestDto,
} from './dto/acceptance-payment.dto';
import { LogtoAdminGuard } from '../logto-auth';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Post()
  @ApiOperation({ summary: 'Create contract or quotation' })
  @ApiResponse({ status: 201, type: ContractResponseDto })
  async create(@Body() dto: CreateContractDto, @Req() req: any) {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.contracts.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List contracts with filter + pagination' })
  @ApiResponse({ status: 200, type: PaginatedContractsDto })
  async list(@Query() filter: ContractFilterDto) {
    return this.contracts.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract detail' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async detail(@Param('id') id: string) {
    return this.contracts.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contract (DRAFT only)' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.contracts.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete contract' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string) {
    return this.contracts.remove(id);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate DRAFT contract → ACTIVE' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async activate(@Param('id') id: string) {
    return this.contracts.activate(id);
  }

  @Post(':id/convert')
  @HttpCode(200)
  @ApiOperation({ summary: 'Convert ACCEPTED quotation → new contract' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async convert(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.contracts.convertQuotation(id, userId);
  }

  @Post(':id/acceptance-report')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create or update acceptance report (DRAFT)' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async upsertAcceptance(
    @Param('id') id: string,
    @Body() dto: CreateAcceptanceReportDto,
  ) {
    return this.contracts.upsertAcceptanceReport(id, dto);
  }

  @Post(':id/acceptance-report/finalize')
  @HttpCode(200)
  @ApiOperation({ summary: 'Finalize acceptance report' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async finalizeAcceptance(@Param('id') id: string) {
    return this.contracts.finalizeAcceptanceReport(id);
  }

  @Post(':id/payment-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create payment request' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async upsertPayment(
    @Param('id') id: string,
    @Body() dto: CreatePaymentRequestDto,
  ) {
    return this.contracts.upsertPaymentRequest(id, dto);
  }

  @Patch(':id/payment-request/mark-paid')
  @ApiOperation({ summary: 'Mark payment as PAID — moves contract → COMPLETED' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  async markPaid(@Param('id') id: string) {
    return this.contracts.markPaymentPaid(id);
  }
}
