import { Controller, Get, Param, Post, Query, Body, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ArticlesService } from './articles.service';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import {
  LatestArticlesQueryDto,
  ListArticlesPublicQueryDto,
} from './dto/list-articles-query.dto';
import {
  ArticleCardDto,
  ArticleDetailDto,
  HelpfulVoteResponseDto,
  PaginatedArticlesDto,
  ViewCountResponseDto,
} from './dto/article-response.dto';
import { HelpfulVoteDto } from './dto/helpful-vote.dto';
import { getClientIp } from './utils/client-ip.util';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly service: ArticlesService) {}

  @Get('latest')
  @UseGuards(ApiKeyGuard)
  @ApiHeader({ name: 'X-API-Key', required: true, description: 'Required — issued via /admin/api-keys' })
  @ApiOperation({ summary: 'Latest published articles for homepage widgets (requires X-API-Key)' })
  @ApiResponse({ status: 200, type: [ArticleCardDto] })
  @ApiResponse({ status: 401, description: 'Missing/invalid X-API-Key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded for this key' })
  async latest(@Query() query: LatestArticlesQueryDto): Promise<ArticleCardDto[]> {
    return this.service.listLatest(query);
  }

  @Get('categories')
  @UseGuards(ApiKeyGuard)
  @ApiHeader({ name: 'X-API-Key', required: true })
  @ApiOperation({
    summary: '[DEPRECATED] Aggregate-based categories — use /api/article-categories instead',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: { category: { type: 'string' }, count: { type: 'number' } },
      },
    },
  })
  async categories(@Query('type') type?: 'news' | 'help') {
    return this.service.listCategories(type);
  }

  @Get()
  @UseGuards(ApiKeyGuard)
  @ApiHeader({ name: 'X-API-Key', required: true })
  @ApiOperation({ summary: 'Paginated public article list (requires X-API-Key)' })
  @ApiResponse({ status: 200, type: PaginatedArticlesDto })
  async list(@Query() query: ListArticlesPublicQueryDto): Promise<PaginatedArticlesDto> {
    return this.service.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Article detail by slug (public, published only)' })
  @ApiResponse({ status: 200, type: ArticleDetailDto })
  @ApiResponse({ status: 404, description: 'Not found or not published' })
  async detail(@Param('slug') slug: string): Promise<ArticleDetailDto> {
    return this.service.findPublicBySlug(slug);
  }

  @Post(':slug/view')
  @ApiOperation({
    summary: 'Increment view count (rate-limited 1/IP/5min via Redis SETNX)',
    description: 'Anonymous OK. Same IP within 5 min returns alreadyCounted=true (no inc, no error).',
  })
  @ApiResponse({ status: 200, type: ViewCountResponseDto })
  async view(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<ViewCountResponseDto> {
    return this.service.incrementView(slug, getClientIp(req));
  }

  @Post(':slug/helpful')
  @ApiOperation({
    summary: 'Vote whether article was helpful (rate-limited 1/IP/24h)',
    description: 'Anonymous OK. Same IP within 24h returns alreadyVoted=true (no inc, frontend should disable button).',
  })
  @ApiResponse({ status: 200, type: HelpfulVoteResponseDto })
  async helpful(
    @Param('slug') slug: string,
    @Body() dto: HelpfulVoteDto,
    @Req() req: Request,
  ): Promise<HelpfulVoteResponseDto> {
    return this.service.voteHelpful(slug, dto.helpful, getClientIp(req));
  }
}
