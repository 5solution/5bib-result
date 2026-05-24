import { Module } from '@nestjs/common';
import { LogtoAuthModule } from '../logto-auth';
import { FlushFeeCacheController } from './flush-fee-cache.controller';

/**
 * F-061 — Admin internal endpoints (post-deploy ops trigger).
 *
 * Currently houses 1 endpoint: `POST /admin/internal/flush-fee-cache-f061`
 * (BR-61-12 + PAUSE-61-BA-C). Future admin-only ops endpoints có thể join
 * module này.
 *
 * Redis injection được provide bởi global `RedisModule.forRoot()` trong
 * app.module — module này chỉ cần import LogtoAuthModule cho guard.
 */
@Module({
  imports: [LogtoAuthModule],
  controllers: [FlushFeeCacheController],
})
export class AdminInternalModule {}
