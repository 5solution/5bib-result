import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LogtoAuthModule } from '../logto-auth';
import { ShortLink, ShortLinkSchema } from './schemas/short-link.schema';
import { ShortLinksController } from './short-links.controller';
import { ShortLinksService } from './short-links.service';

/**
 * FEATURE-089 — ShortLinksModule. Pure Mongo + Redis (port F-083 pattern).
 * KHÔNG cross-module DI, KHÔNG platform DB → load unconditional.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShortLink.name, schema: ShortLinkSchema },
    ]),
    LogtoAuthModule,
  ],
  controllers: [ShortLinksController],
  providers: [ShortLinksService],
  exports: [ShortLinksService],
})
export class ShortLinksModule {}
