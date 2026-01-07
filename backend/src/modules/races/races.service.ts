import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RaceEntity } from './entities/race.entity';
import { RaceCourseEntity } from './entities/race-course.entity';
import { TicketTypeEntity } from './entities/ticket-type.entity';
import { SearchRacesDto } from './dto/search-races.dto';

@Injectable()
export class RacesService {
  private readonly logger = new Logger(RacesService.name);

  constructor(
    @InjectRepository(RaceEntity)
    private readonly raceRepository: Repository<RaceEntity>,
    @InjectRepository(RaceCourseEntity)
    private readonly raceCourseRepository: Repository<RaceCourseEntity>,
    @InjectRepository(TicketTypeEntity)
    private readonly ticketTypeRepository: Repository<TicketTypeEntity>,
    private readonly httpService: HttpService,
  ) {}

  async searchRaces(dto: SearchRacesDto) {
    const {
      title,
      status,
      province,
      season,
      race_type,
      page = 0,
      pageSize = 10,
    } = dto;

    const where: FindOptionsWhere<RaceEntity> = {};

    if (title) {
      where.title = Like(`%${title}%`);
    }

    if (status) {
      where.status = status;
    }

    if (province) {
      where.province = province;
    }

    if (season) {
      where.season = season;
    }

    if (race_type) {
      where.race_type = race_type;
    }

    const [list, totalItems] = await this.raceRepository.findAndCount({
      where,
      relations: ['race_courses', 'race_courses.ticket_types'],
      skip: page * pageSize,
      take: pageSize,
      order: {
        event_start_date: 'DESC',
        created_at: 'DESC',
      },
    });

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      data: {
        totalPages,
        currentPage: page,
        totalItems,
        list,
      },
      success: true,
    };
  }

  async getRaceById(id: number) {
    const race = await this.raceRepository.findOne({
      where: { id },
      relations: ['race_courses', 'race_courses.ticket_types'],
    });

    if (!race) {
      return {
        data: null,
        success: false,
        message: 'Race not found',
      };
    }

    return {
      data: race,
      success: true,
    };
  }

  async getRaceByProductId(productId: number) {
    const race = await this.raceRepository.findOne({
      where: { product_id: productId },
      relations: ['race_courses', 'race_courses.ticket_types'],
    });

    if (!race) {
      return {
        data: null,
        success: false,
        message: 'Race not found',
      };
    }

    return {
      data: race,
      success: true,
    };
  }

  async syncRacesFromSource() {
    try {
      this.logger.log('Starting race sync from source API...');

      const sourceUrl = 'https://api.5bib.com/pub/race';
      const params = { pageSize: 100 };

      const response = await firstValueFrom(
        this.httpService.get(sourceUrl, { params }),
      );

      const races = response.data?.data?.list || [];

      if (!races.length) {
        this.logger.warn('No races found from source API');
        return {
          message: 'No races found from source',
          count: 0,
          success: true,
        };
      }

      let syncedCount = 0;

      for (const raceData of races) {
        await this.saveRaceData(raceData);
        syncedCount++;
      }

      this.logger.log(`Successfully synced ${syncedCount} races`);

      return {
        message: `Successfully synced ${syncedCount} races`,
        count: syncedCount,
        success: true,
      };
    } catch (error) {
      this.logger.error('Failed to sync races from source', error.stack);
      throw error;
    }
  }

  private async saveRaceData(raceData: any) {
    const { race_course_bases, ...raceFields } = raceData;

    // Remove fields we don't need to save
    delete raceFields.id;
    delete raceFields.race_extenstion;
    delete raceFields.race_virtual_extenstion;

    // Save or update race
    let race = await this.raceRepository.findOne({
      where: { product_id: raceFields.product },
    });

    if (race) {
      Object.assign(race, {
        ...raceFields,
        product_id: raceFields.product,
        synced_at: new Date(),
      });
      await this.raceRepository.save(race);
    } else {
      race = await this.raceRepository.save({
        ...raceFields,
        product_id: raceFields.product,
        synced_at: new Date(),
      } as any);
    }

    // Save race courses
    if (race_course_bases && Array.isArray(race_course_bases)) {
      for (const courseData of race_course_bases) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ticket_types, ...courseFields } = courseData;

        let raceCourse = await this.raceCourseRepository.findOne({
          where: {
            race_id: race.id,
            variant_id: courseFields.variant_id,
          },
        });

        if (raceCourse) {
          Object.assign(raceCourse, courseFields);
          await this.raceCourseRepository.save(raceCourse);
        } else {
          raceCourse = await this.raceCourseRepository.save({
            ...courseFields,
            race_id: race.id,
          } as any);
        }

        // Save ticket types
        if (ticket_types && Array.isArray(ticket_types)) {
          for (const ticketData of ticket_types) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...ticketFields } = ticketData;

            let ticketType = await this.ticketTypeRepository.findOne({
              where: {
                unique_code: ticketFields.unique_code,
              },
            });

            if (ticketType) {
              Object.assign(ticketType, {
                ...ticketFields,
                race_course_id: raceCourse.id,
              });
              await this.ticketTypeRepository.save(ticketType);
            } else {
              ticketType = await this.ticketTypeRepository.save({
                ...ticketFields,
                race_course_id: raceCourse.id,
              } as any);
            }
          }
        }
      }
    }

    this.logger.log(`Synced race: ${race.title} (ID: ${race.id})`);
  }
}
