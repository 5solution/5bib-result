// Mirror backend DTOs (manual since this app doesn't use openapi-ts).
// Keep in sync with backend/src/modules/articles/dto/*.ts

export type ArticleType = "news" | "help";
export type ArticleProduct = "5bib" | "5sport" | "5ticket" | "5pix" | "all";
export type CategoryType = "news" | "help" | "both";

export interface ArticleCardDto {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string;
  type: ArticleType;
  products: string[];
  category: string;
  authorName: string;
  authorAvatar: string;
  publishedAt: string | null;
  readTimeMinutes: number;
  featured: boolean;
}

export interface TableOfContentsItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface ArticleDetailDto extends ArticleCardDto {
  content: string;
  seoTitle: string;
  seoDescription: string;
  tableOfContents: TableOfContentsItem[];
  related: ArticleCardDto[];
  helpfulYes: number;
  helpfulNo: number;
  viewCount: number;
}

export interface PaginatedArticles {
  items: ArticleCardDto[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ArticleCategory {
  id: string;
  slug: string;
  name: string;
  type: CategoryType;
  icon: string;
  tint: string;
  description: string;
  order: number;
  isActive: boolean;
  articleCount: number;
}

export interface HelpfulVoteResponse {
  helpfulYes: number;
  helpfulNo: number;
  alreadyVoted: boolean;
}

export interface ViewCountResponse {
  viewCount: number;
  alreadyCounted: boolean;
}
