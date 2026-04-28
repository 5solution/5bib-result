import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Compact card shape used in listings, widgets, related-articles. */
export class ArticleCardDto {
  @ApiProperty() id: string;
  @ApiProperty() slug: string;
  @ApiProperty() title: string;
  @ApiProperty() excerpt: string;
  @ApiProperty() coverImageUrl: string;
  @ApiProperty({ enum: ['news', 'help'] }) type: 'news' | 'help';
  @ApiProperty({ type: [String] }) products: string[];
  @ApiProperty() category: string;
  @ApiProperty() authorName: string;
  @ApiProperty() authorAvatar: string;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  publishedAt: Date | null;
  @ApiProperty() readTimeMinutes: number;
  @ApiProperty() featured: boolean;
}

export class TableOfContentsItemDto {
  @ApiProperty() id: string;
  @ApiProperty() text: string;
  @ApiProperty({ enum: [2, 3] }) level: 2 | 3;
}

/** Full detail shape returned by GET /api/articles/:slug. */
export class ArticleDetailDto extends ArticleCardDto {
  @ApiProperty({ description: 'Sanitized HTML' }) content: string;
  @ApiProperty() seoTitle: string;
  @ApiProperty() seoDescription: string;
  @ApiProperty({ type: [TableOfContentsItemDto], description: 'Auto-derived from <h2>/<h3>' })
  tableOfContents: TableOfContentsItemDto[];
  @ApiProperty({ type: [ArticleCardDto] }) related: ArticleCardDto[];
  @ApiProperty() helpfulYes: number;
  @ApiProperty() helpfulNo: number;
  @ApiProperty() viewCount: number;
}

/** Admin shape — exposes status, draft content, soft-delete flag. */
export class ArticleAdminDto extends ArticleCardDto {
  @ApiProperty() content: string;
  @ApiProperty() seoTitle: string;
  @ApiProperty() seoDescription: string;
  @ApiProperty({ enum: ['draft', 'published'] }) status: 'draft' | 'published';
  @ApiProperty() isDeleted: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
  @ApiPropertyOptional() authorId?: string;
  @ApiProperty() viewCount: number;
  @ApiProperty() helpfulYes: number;
  @ApiProperty() helpfulNo: number;
}

export class PaginatedArticlesDto {
  @ApiProperty({ type: [ArticleCardDto] }) items: ArticleCardDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() totalPages: number;
}

export class PaginatedAdminArticlesDto {
  @ApiProperty({ type: [ArticleAdminDto] }) items: ArticleAdminDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() totalPages: number;
}

export class ArticleStatsDto {
  @ApiProperty() total: number;
  @ApiProperty() published: number;
  @ApiProperty() draft: number;
  @ApiProperty() deleted: number;
}

export class HelpfulVoteResponseDto {
  @ApiProperty() helpfulYes: number;
  @ApiProperty() helpfulNo: number;
  @ApiProperty({ description: 'true nếu IP này đã vote trong 24h qua, vote không được tính' })
  alreadyVoted: boolean;
}

export class ViewCountResponseDto {
  @ApiProperty() viewCount: number;
  @ApiProperty({ description: 'true nếu IP này đã view trong 5 phút qua, không tính tăng' })
  alreadyCounted: boolean;
}
