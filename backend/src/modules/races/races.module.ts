import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { RacesService } from './races.service';
import { RacesController } from './races.controller';
import { RaceEntity } from './entities/race.entity';
import { RaceCourseEntity } from './entities/race-course.entity';
import { TicketTypeEntity } from './entities/ticket-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RaceEntity, RaceCourseEntity, TicketTypeEntity]),
    HttpModule,
  ],
  controllers: [RacesController],
  providers: [RacesService],
  exports: [RacesService],
})
export class RacesModule {}
