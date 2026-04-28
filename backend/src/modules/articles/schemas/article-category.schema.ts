import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ArticleCategoryDocument = HydratedDocument<ArticleCategory>;

export const CATEGORY_TYPES = ['help', 'news', 'both'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

@Schema({
  collection: 'article_categories',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class ArticleCategory {
  _id: string;

  @Prop({ required: true, unique: true, index: true }) slug: string;

  @Prop({ required: true }) name: string;

  @Prop({ required: true, enum: CATEGORY_TYPES, default: 'both' })
  type: CategoryType;

  // Emoji or icon name for the hotro.5bib.com hero grid card
  @Prop({ default: '📁' }) icon: string;

  // Hex color used as card overlay tint in the public hero grid
  @Prop({ default: '#1D49FF' }) tint: string;

  // Sub-text shown under the category name in the hero card
  @Prop({ default: '' }) description: string;

  @Prop({ default: 0, index: true }) order: number;

  @Prop({ default: true, index: true }) isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const ArticleCategorySchema = SchemaFactory.createForClass(ArticleCategory);

ArticleCategorySchema.index({ isActive: 1, type: 1, order: 1 });
