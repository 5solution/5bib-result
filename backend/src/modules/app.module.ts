import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';

import dataSource from 'src/libs/typeorm.config';
import { env } from 'src/config';
import { RaceResultModule } from './race-result/race-result.module';
//import { BotModule } from './bot/bot.module';
import { RacesModule } from './races/races.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSource.options),
    TypeOrmModule.forFeature([]),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),
    RedisModule.forRoot({
      type: 'single',
      url: env.redisUrl,
      options: {},
    }),
    ConfigModule,
    RaceResultModule,
    RacesModule,
  ],
})
export class AppModule {}
