import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { RaceConfig, RaceResult } from '../interfaces/race-result.interface';
import { RaceResultEntity } from '../entities/race-result.entity';
import { GetRaceResultsDto } from '../dto/get-race-results.dto';

@Injectable()
export class RaceResultService {
  private readonly logger = new Logger(RaceResultService.name);

  private readonly raceConfigs: RaceConfig[] = [
    {
      race_id: 373872,
      distance: '100km',
      course_id: '100km',
      api_url:
        'https://api.raceresult.com/373872/DRUJ4JZIAZVR9HL3Z95VMT3N1EOUYRX6',
    },
    {
      race_id: 373872,
      distance: '70km',
      course_id: '70km',
      api_url:
        'https://api.raceresult.com/373872/L4OGZSDRG90JJB34CWIAM6I5BBQS744E',
    },
    {
      race_id: 373872,
      distance: '42km',
      course_id: '42km',
      api_url:
        'https://api.raceresult.com/373872/XNMXT8815X4PMOH8PIQJU9BMOILKSR7Q',
    },
    {
      race_id: 373872,
      distance: '25km',
      course_id: '25km',
      api_url:
        'https://api.raceresult.com/373872/OBZ7O5A02PGVHAOTJ2F7Y9QGE6VXDIZK',
    },
    {
      race_id: 373872,
      distance: '10km',
      course_id: '10km',
      api_url:
        'https://api.raceresult.com/373872/WKI4EML9T6R7Z582HRKDXOF2188697KX',
    },
  ];

  constructor(
    @InjectRepository(RaceResultEntity)
    private readonly raceResultRepo: Repository<RaceResultEntity>,
  ) {}

  async getRaceDistances() {
    return this.raceConfigs.map(config => ({
      race_id: config.race_id,
      distance: config.distance,
      course_id: config.course_id,
    }));
  }

  async syncAllRaceResults(): Promise<void> {
    this.logger.log('Starting race results sync...');

    for (const config of this.raceConfigs) {
      await this.syncRaceResult(config);
    }

    this.logger.log('Race results sync completed');
  }

  private normalizeRankValue(value: any): {
    original: string;
    numeric: number | null;
  } {
    const strValue = String(value);
    const numValue = parseInt(strValue, 10);

    // If it's -1 (racing/not finished), convert to a very high number for sorting
    // This ensures -1 ranks appear at the END when sorting ASC
    if (numValue === -1) {
      return {
        original: strValue,
        numeric: 999999,
      };
    }

    return {
      original: strValue,
      numeric: isNaN(numValue) ? null : numValue,
    };
  }

  private async syncRaceResult(config: RaceConfig): Promise<void> {
    try {
      this.logger.log(`Syncing ${config.distance} race results...`);

      const response = await axios.get<RaceResult[]>(config.api_url, {
        timeout: 30000,
      });

      if (!response.data || !Array.isArray(response.data)) {
        this.logger.warn(
          `Invalid data received for ${config.distance}: ${typeof response.data}`,
        );
        return;
      }

      const entities: RaceResultEntity[] = response.data.map((result) => {
        const overallRank = this.normalizeRankValue(result.OverallRank);
        const genderRank = this.normalizeRankValue(result.GenderRank);
        const catRank = this.normalizeRankValue(result.CatRank);
        const overrankLive = this.normalizeRankValue(result.OverrankLive);

        const entity = new RaceResultEntity();
        entity.bib = result.Bib;
        entity.name = result.Name;
        entity.overall_rank = overallRank.original;
        entity.overall_rank_numeric = overallRank.numeric;
        entity.gender_rank = genderRank.original;
        entity.gender_rank_numeric = genderRank.numeric;
        entity.cat_rank = catRank.original;
        entity.cat_rank_numeric = catRank.numeric;
        entity.gender = result.Gender;
        entity.category = result.Category;
        entity.chip_time = result.ChipTime;
        entity.gun_time = result.GunTime;
        entity.timing_point = result.TimingPoint;
        entity.pace = result.Pace;
        entity.certi = result.Certi;
        entity.certificate = result.Certificate;
        entity.overall_ranks = result.OverallRanks;
        entity.gender_ranks = result.GenderRanks;
        entity.chiptimes = result.Chiptimes;
        entity.guntimes = result.Guntimes;
        entity.paces = result.Paces;
        entity.tods = result.TODs;
        entity.sectors = result.Sectors;
        entity.overrank_live = overrankLive.original;
        entity.overrank_live_numeric = overrankLive.numeric;
        entity.gap = result.Gap;
        entity.nationality = result.Nationality;
        entity.nation = result.Nation;
        entity.race_id = config.race_id;
        entity.course_id = config.course_id;
        entity.distance = config.distance;
        entity.synced_at = new Date();

        return entity;
      });

      if (entities.length > 0) {
        // Use upsert to insert or update existing records
        await this.raceResultRepo.upsert(entities, {
          conflictPaths: ['race_id', 'course_id', 'bib'],
          skipUpdateIfNoValuesChanged: true,
        });

        this.logger.log(
          `Successfully synced ${entities.length} results for ${config.distance}`,
        );
      } else {
        this.logger.warn(`No results found for ${config.distance}`);
      }
    } catch (error) {
      this.logger.error(
        `Error syncing ${config.distance}: ${error.message}`,
        error.stack,
      );
    }
  }

  async getRaceResults(dto: GetRaceResultsDto) {
    // Build order
    const sortFieldMap: Record<string, string> = {
      OverallRank: 'overall_rank_numeric',
      GenderRank: 'gender_rank_numeric',
      CatRank: 'cat_rank_numeric',
      OverrankLive: 'overrank_live_numeric',
      Name: 'name',
      ChipTime: 'chip_time',
      GunTime: 'gun_time',
    };

    const orderField = sortFieldMap[dto.sortField] || 'overall_rank_numeric';
    const orderDirection = dto.sortDirection;

    // Build query with QueryBuilder (WITHOUT pagination first)
    const queryBuilder = this.raceResultRepo
      .createQueryBuilder('race_result');

    // Add WHERE conditions
    if (dto.course_id) {
      queryBuilder.andWhere('race_result.course_id = :courseId', { courseId: dto.course_id });
    }

    if (dto.gender) {
      queryBuilder.andWhere('race_result.gender = :gender', { gender: dto.gender });
    }

    if (dto.category) {
      queryBuilder.andWhere('race_result.category = :category', { category: dto.category });
    }

    // Name search with ILIKE (case-insensitive)
    if (dto.name) {
      queryBuilder.andWhere('race_result.name ILIKE :name', { name: `%${dto.name}%` });
    }

    // Add ORDER BY
    // Note: -1 ranks are already converted to 999999 during sync, so they'll naturally appear at the end when sorting ASC
    queryBuilder.orderBy(`race_result.${orderField}`, orderDirection);

    // Get ALL results first
    const allResults = await queryBuilder.getMany();

    // Filter out duplicate ranks to avoid confusion with multiple people having same rank
    // Keep only the first occurrence of each rank
    const filteredResults = this.filterDuplicateRanks(allResults);

    // NOW apply pagination to the filtered results
    const skip = (dto.pageNo - 1) * dto.pageSize;
    const paginatedResults = filteredResults.slice(skip, skip + dto.pageSize);

    return {
      data: paginatedResults.map((entity) => this.mapEntityToResponse(entity)),
      pagination: {
        pageNo: dto.pageNo,
        pageSize: dto.pageSize,
        total: filteredResults.length,
        totalPages: Math.ceil(filteredResults.length / dto.pageSize),
      },
    };
  }

  private filterDuplicateRanks(results: RaceResultEntity[]): RaceResultEntity[] {
    const seenRanks = new Set<string>();
    return results.filter((result) => {
      // Always show if rank is -1 (racing/in progress) or invalid
      if (result.overall_rank === '-1' || result.overall_rank_numeric === null || result.overall_rank_numeric === 999999) {
        return true;
      }

      // Filter out duplicate ranks
      if (seenRanks.has(result.overall_rank)) {
        return false;
      }

      seenRanks.add(result.overall_rank);
      return true;
    });
  }

  private mapEntityToResponse(entity: RaceResultEntity) {
    return {
      Bib: entity.bib,
      Name: entity.name,
      OverallRank: entity.overall_rank,
      GenderRank: entity.gender_rank,
      CatRank: entity.cat_rank,
      Gender: entity.gender,
      Category: entity.category,
      ChipTime: entity.chip_time,
      GunTime: entity.gun_time,
      TimingPoint: entity.timing_point,
      Pace: entity.pace,
      Certi: entity.certi,
      Certificate: entity.certificate,
      OverallRanks: entity.overall_ranks,
      GenderRanks: entity.gender_ranks,
      Chiptimes: entity.chiptimes,
      Guntimes: entity.guntimes,
      Paces: entity.paces,
      TODs: entity.tods,
      Sectors: entity.sectors,
      OverrankLive: entity.overrank_live,
      Gap: entity.gap,
      Nationality: entity.nationality,
      Nation: entity.nation,
      race_id: entity.race_id,
      course_id: entity.course_id,
      distance: entity.distance,
      synced_at: entity.synced_at,
    };
  }
}
