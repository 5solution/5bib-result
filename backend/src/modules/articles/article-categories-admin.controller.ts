import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { ArticleCategoriesService } from './article-categories.service';
import {
  ArticleCategoryResponseDto,
  CreateArticleCategoryDto,
  ReorderArticleCategoriesDto,
  UpdateArticleCategoryDto,
} from './dto/article-category.dto';
import { LogtoAdminGuard } from '../logto-auth';

@ApiTags('Article Categories · Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(LogtoAdminGuard)
@Controller('admin/article-categories')
export class ArticleCategoriesAdminController {
  constructor(private readonly service: ArticleCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all categories with article counts (admin)' })
  @ApiResponse({ status: 200, type: [ArticleCategoryResponseDto] })
  async list(): Promise<ArticleCategoryResponseDto[]> {
    return this.service.listAdmin();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single category by ID' })
  @ApiResponse({ status: 200, type: ArticleCategoryResponseDto })
  async findOne(@Param('id') id: string): Promise<ArticleCategoryResponseDto> {
    return this.service.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new category' })
  @ApiResponse({ status: 201, type: ArticleCategoryResponseDto })
  async create(@Body() dto: CreateArticleCategoryDto): Promise<ArticleCategoryResponseDto> {
    return this.service.create(dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Bulk reorder categories (drag-drop in admin UI)' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
  })
  async reorder(@Body() dto: ReorderArticleCategoriesDto) {
    return this.service.reorder(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update category (slug rename cascades to articles)',
  })
  @ApiResponse({ status: 200, type: ArticleCategoryResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleCategoryDto,
  ): Promise<ArticleCategoryResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete category (blocked if any article still uses it)',
  })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
  })
  @ApiResponse({ status: 409, description: 'Category in use by articles' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
