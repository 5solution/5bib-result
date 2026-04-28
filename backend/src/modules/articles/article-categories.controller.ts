import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ArticleCategoriesService } from './article-categories.service';
import { ArticleCategoryResponseDto } from './dto/article-category.dto';
import { ApiKeyGuard } from '../api-keys/api-key.guard';

@ApiTags('Article Categories')
@Controller('article-categories')
export class ArticleCategoriesController {
  constructor(private readonly service: ArticleCategoriesService) {}

  @Get()
  @UseGuards(ApiKeyGuard)
  @ApiHeader({ name: 'X-API-Key', required: true })
  @ApiOperation({
    summary: 'List active article categories (requires X-API-Key)',
    description: 'Drives hero category grid on hotro.5bib.com / news.5bib.com.',
  })
  @ApiResponse({ status: 200, type: [ArticleCategoryResponseDto] })
  @ApiResponse({ status: 401, description: 'Missing/invalid X-API-Key' })
  async list(@Query('type') type?: 'news' | 'help'): Promise<ArticleCategoryResponseDto[]> {
    return this.service.listPublic(type);
  }
}
