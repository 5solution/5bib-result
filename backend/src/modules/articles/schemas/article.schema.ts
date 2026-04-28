import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ArticleDocument = HydratedDocument<Article>;

export const ARTICLE_TYPES = ['news', 'help'] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const ARTICLE_PRODUCTS = ['5bib', '5sport', '5ticket', '5pix', 'all'] as const;
export type ArticleProduct = (typeof ARTICLE_PRODUCTS)[number];

export const ARTICLE_STATUSES = ['draft', 'published'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

@Schema({
  collection: 'articles',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class Article {
  _id: string;

  @Prop({ required: true }) title: string;

  @Prop({ required: true, unique: true, index: true }) slug: string;

  @Prop({ required: true, enum: ARTICLE_TYPES }) type: ArticleType;

  @Prop({ type: [String], default: [], index: true }) products: ArticleProduct[];

  @Prop() category: string;

  @Prop({ default: '' }) content: string;

  @Prop({ default: '' }) excerpt: string;

  @Prop({ default: '' }) coverImageUrl: string;

  @Prop({ default: '' }) seoTitle: string;

  @Prop({ default: '' }) seoDescription: string;

  @Prop({ default: 'draft', enum: ARTICLE_STATUSES, index: true })
  status: ArticleStatus;

  // Set on first publish; preserved across unpublish → publish cycles (BR-09).
  @Prop({ index: true }) publishedAt: Date | null;

  @Prop({ default: false }) featured: boolean;

  @Prop() authorId: string;

  @Prop() authorName: string;

  @Prop() authorAvatar: string;

  // Computed at write time (Math.ceil(wordCount / 200)) — cached for listing queries.
  @Prop({ default: 0 }) readTimeMinutes: number;

  @Prop({ default: 0 }) viewCount: number;

  @Prop({ default: 0 }) helpfulYes: number;

  @Prop({ default: 0 }) helpfulNo: number;

  @Prop({ default: false, index: true }) isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const ArticleSchema = SchemaFactory.createForClass(Article);

// Compound indexes for common queries
ArticleSchema.index({ status: 1, type: 1, publishedAt: -1 });
ArticleSchema.index({ status: 1, products: 1, publishedAt: -1 });
ArticleSchema.index({ status: 1, featured: -1, publishedAt: -1 });
ArticleSchema.index({ status: 1, category: 1, publishedAt: -1 });
