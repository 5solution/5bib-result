import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { env } from 'src/config';
import { RaceResultController } from './race-result.controller';
import { RaceElasticsearchService } from './services/elasticsearch.service';
import { RaceResultService } from './services/race-result.service';
import { RaceSyncCron } from './services/race-sync.cron';

@Module({
  imports: [
    ElasticsearchModule.register({
      node: env.elasticsearch.node,
      auth:
        env.elasticsearch.username && env.elasticsearch.password
          ? {
              username: env.elasticsearch.username,
              password: env.elasticsearch.password,
            }
          : undefined,
    }),
  ],
  controllers: [RaceResultController],
  providers: [RaceElasticsearchService, RaceResultService, RaceSyncCron],
  exports: [RaceResultService],
})
export class RaceResultModule {}
