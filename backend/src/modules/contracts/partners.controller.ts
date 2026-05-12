import {
  Body,
  Controller,
  Delete,
  Get,
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
import { PartnersService } from './services/partners.service';
import {
  CreatePartnerDto,
  PartnerResponseDto,
  UpdatePartnerDto,
} from './dto/partner.dto';
import { LogtoStaffGuard } from '../logto-auth';

@ApiTags('Partners')
@ApiBearerAuth()
@UseGuards(LogtoStaffGuard)
@Controller('partners')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Post()
  @ApiOperation({ summary: 'Create partner' })
  @ApiResponse({ status: 201, type: PartnerResponseDto })
  async create(@Body() dto: CreatePartnerDto, @Req() req: any) {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.partners.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List partners' })
  async list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.partners.findAll({
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get partner detail' })
  @ApiResponse({ status: 200, type: PartnerResponseDto })
  async detail(@Param('id') id: string) {
    return this.partners.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update partner' })
  @ApiResponse({ status: 200, type: PartnerResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    return this.partners.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete partner (rejected if has contracts)' })
  async remove(@Param('id') id: string) {
    return this.partners.remove(id);
  }
}
