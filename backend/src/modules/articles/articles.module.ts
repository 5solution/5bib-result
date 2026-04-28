import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from './schemas/article.schema';
import {
  ArticleCategory,
  ArticleCategorySchema,
} from './schemas/article-category.schema';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { ArticlesAdminController } from './articles-admin.controller';
import { ArticleCategoriesService } from './article-categories.service';
import { ArticleCategoriesController } from './article-categories.controller';
import { ArticleCategoriesAdminController } from './article-categories-admin.controller';
import { LogtoAuthModule } from '../logto-auth/logto-auth.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Article.name, schema: ArticleSchema },
      { name: ArticleCategory.name, schema: ArticleCategorySchema },
    ]),
    LogtoAuthModule,
    ApiKeysModule,
  ],
  controllers: [
    ArticlesController,
    ArticlesAdminController,
    ArticleCategoriesController,
    ArticleCategoriesAdminController,
  ],
  providers: [ArticlesService, ArticleCategoriesService],
  exports: [ArticlesService, ArticleCategoriesService],
})
export class ArticlesModule {}
