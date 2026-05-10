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
import { ServiceCatalogService } from './services/service-catalog.service';
import {
  CreateServiceCatalogDto,
  ServiceCatalogResponseDto,
  UpdateServiceCatalogDto,
} from './dto/service-catalog.dto';
import { LogtoAdminGuard } from '../logto-auth';

@ApiTags('Service Catalog')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('service-catalog')
export class ServiceCatalogController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Post()
  @ApiOperation({ summary: 'Create catalog item' })
  @ApiResponse({ status: 201, type: ServiceCatalogResponseDto })
  async create(@Body() dto: CreateServiceCatalogDto, @Req() req: any) {
    const userId = req?.user?.sub ?? req?.user?.email ?? 'admin';
    return this.catalog.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List catalog items' })
  @ApiResponse({ status: 200, type: [ServiceCatalogResponseDto] })
  async list(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.catalog.findAll({ category, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get catalog item detail' })
  @ApiResponse({ status: 200, type: ServiceCatalogResponseDto })
  async detail(@Param('id') id: string) {
    return this.catalog.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update catalog item' })
  @ApiResponse({ status: 200, type: ServiceCatalogResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateServiceCatalogDto) {
    return this.catalog.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete catalog item' })
  async remove(@Param('id') id: string) {
    return this.catalog.remove(id);
  }
}
