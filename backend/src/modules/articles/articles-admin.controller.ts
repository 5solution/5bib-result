import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ListArticlesAdminQueryDto } from './dto/list-articles-query.dto';
import { RestoreArticleDto } from './dto/restore-article.dto';
import {
  ArticleAdminDto,
  ArticleStatsDto,
  PaginatedAdminArticlesDto,
} from './dto/article-response.dto';
import { CurrentUser, LogtoAdminGuard } from '../logto-auth';
import type { LogtoUser } from '../logto-auth/types';
import {
  LogtoOrApiKeyWriteGuard,
  RequireScope,
} from '../api-keys/logto-or-api-key-write.guard';

@ApiTags('Articles · Admin')
@ApiBearerAuth('JWT-auth')
// Class-level guard accepts EITHER Logto admin JWT, OR X-API-Key carrying
// the `articles:write` scope (issued via admin /api-keys with the scopes
// field set in DB). The scope grants both read + write on this controller —
// AI agents need read access to dedupe before creating new articles.
@UseGuards(LogtoOrApiKeyWriteGuard)
@RequireScope('articles:write')
@Controller('admin/articles')
export class ArticlesAdminController {
  constructor(private readonly service: ArticlesService) {}

  @Get()
  @ApiOperation({ summary: 'List all articles (admin) — incl. drafts and optionally deleted' })
  @ApiResponse({ status: 200, type: PaginatedAdminArticlesDto })
  async list(@Query() query: ListArticlesAdminQueryDto): Promise<PaginatedAdminArticlesDto> {
    return this.service.listAdmin(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Stats for admin dashboard cards' })
  @ApiResponse({ status: 200, type: ArticleStatsDto })
  async stats(): Promise<ArticleStatsDto> {
    return this.service.stats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single article by ID (admin)' })
  @ApiResponse({ status: 200, type: ArticleAdminDto })
  async findOne(@Param('id') id: string): Promise<ArticleAdminDto> {
    return this.service.findAdminById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create draft article' })
  @ApiResponse({ status: 201, type: ArticleAdminDto })
  async create(
    @Body() dto: CreateArticleDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<ArticleAdminDto> {
    return this.service.create(dto, {
      id: user.userId,
      name: user.name ?? user.username ?? user.email,
      avatar: user.picture,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update article (autosave-friendly partial update)' })
  @ApiResponse({ status: 200, type: ArticleAdminDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
  ): Promise<ArticleAdminDto> {
    return this.service.update(id, dto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish article — validates required fields, sets publishedAt' })
  @ApiResponse({ status: 200, type: ArticleAdminDto })
  @ApiResponse({ status: 422, description: 'Missing required fields when publishing' })
  async publish(@Param('id') id: string): Promise<ArticleAdminDto> {
    return this.service.publish(id);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish — set status back to draft (publishedAt preserved)' })
  @ApiResponse({ status: 200, type: ArticleAdminDto })
  async unpublish(@Param('id') id: string): Promise<ArticleAdminDto> {
    return this.service.unpublish(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete — sets isDeleted, frees slug for reuse' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
  })
  async remove(@Param('id') id: string) {
    return this.service.softDelete(id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore soft-deleted article (slug rebuilt to be unique)' })
  @ApiResponse({ status: 200, type: ArticleAdminDto })
  async restore(
    @Param('id') id: string,
    @Body() body: RestoreArticleDto,
  ): Promise<ArticleAdminDto> {
    return this.service.restore(id, body.slug);
  }
}
